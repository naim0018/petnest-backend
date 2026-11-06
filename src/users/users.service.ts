import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Role } from 'prisma/generated/prisma/enums';
import { createPaginatedResponse } from 'src/common/dto/pagination.dto';
import type { AuthenticatedUser } from 'src/common/guards/jwt-auth.guard';
import { PrismaService } from 'src/prisma/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserRoleDto } from './dto/update-role.dto';
import { UserQueryDto } from './dto/user-query.dto';

const userSafeSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  interestedSpeciesId: true,
  interestedBreedId: true,
  interestedSpecies: { select: { id: true, name: true, image: true } },
  interestedBreed: { select: { id: true, name: true, image: true } },
  profile: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // 1. Get Logged-in User Profile
  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: userSafeSelect,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  // 2. Update Profile & Pet Preferences
  async updateMe(userId: string, dto: UpdateProfileDto) {
    const {
      name,
      phone,
      interestedSpeciesId,
      interestedBreedId,
      bio,
      specialization,
      avatar,
      address,
      city,
      country,
      zipCode,
    } = dto;

    // Determine target species and breed IDs to validate foreign keys & relationships
    const targetSpeciesId =
      interestedSpeciesId !== undefined ? interestedSpeciesId : undefined;
    const targetBreedId =
      interestedBreedId !== undefined ? interestedBreedId : undefined;

    let finalSpeciesId = targetSpeciesId;
    let finalBreedId = targetBreedId;

    // If only one was provided, we may need the other from the current user
    if (targetSpeciesId !== undefined || targetBreedId !== undefined) {
      const currentUser = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { interestedSpeciesId: true, interestedBreedId: true },
      });

      if (!currentUser) {
        throw new NotFoundException('User not found');
      }

      if (finalSpeciesId === undefined) {
        finalSpeciesId = currentUser.interestedSpeciesId ?? undefined;
      }
      if (finalBreedId === undefined) {
        finalBreedId = currentUser.interestedBreedId ?? undefined;
      }
    }

    if (targetSpeciesId) {
      const speciesExists = await this.prisma.petSpecies.findUnique({
        where: { id: targetSpeciesId },
      });
      if (!speciesExists) {
        throw new BadRequestException(
          'Selected interested species does not exist',
        );
      }
    }

    if (targetBreedId) {
      const breedExists = await this.prisma.petBreed.findUnique({
        where: { id: targetBreedId },
      });
      if (!breedExists) {
        throw new BadRequestException(
          'Selected interested breed does not exist',
        );
      }

      if (finalSpeciesId && breedExists.speciesId !== finalSpeciesId) {
        throw new BadRequestException(
          'Selected breed does not belong to the selected species',
        );
      }
    }

    const profileData = {
      ...(bio !== undefined && { bio }),
      ...(specialization !== undefined && { specialization }),
      ...(avatar !== undefined && { avatar }),
      ...(address !== undefined && { address }),
      ...(city !== undefined && { city }),
      ...(country !== undefined && { country }),
      ...(zipCode !== undefined && { zipCode }),
    };

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(name && { name }),
        ...(phone !== undefined && { phone }),
        ...(interestedSpeciesId !== undefined && { interestedSpeciesId }),
        ...(interestedBreedId !== undefined && { interestedBreedId }),
        profile: {
          upsert: {
            create: {
              city: city || 'Unknown',
              country: country || 'Unknown',
              ...profileData,
            },
            update: profileData,
          },
        },
      },
      select: userSafeSelect,
    });
  }

  // 3. Change Password
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    currentSessionId?: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isMatch = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isMatch) {
      throw new BadRequestException('Current password does not match');
    }

    const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 10;
    const hashedPassword = await bcrypt.hash(dto.newPassword, saltRounds);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          password: hashedPassword,
          resetPasswordToken: null,
          resetPasswordExpires: null,
        },
      }),
      this.prisma.session.updateMany({
        where: {
          userId,
          revokedAt: null,
          ...(currentSessionId ? { id: { not: currentSessionId } } : {}),
        },
        data: { revokedAt: new Date() },
      }),
    ]);

    return {
      message:
        'Password updated successfully. Other sessions have been logged out.',
    };
  }

  // 4. Admin: Find All Users (Multi-field Search, Role Filter, Column Sorting & Pagination)
  async findAll(query: UserQueryDto) {
    const {
      page = 1,
      limit = 10,
      search,
      role,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const skip = (page - 1) * limit;
    const where: any = {};

    // Filter by Role
    if (role) {
      where.role = role;
    }

    // Multi-field search
    if (search && search.trim() !== '') {
      const trimmedSearch = search.trim();
      where.OR = [
        { name: { contains: trimmedSearch, mode: 'insensitive' } },
        { email: { contains: trimmedSearch, mode: 'insensitive' } },
        { phone: { contains: trimmedSearch, mode: 'insensitive' } },
        {
          profile: {
            city: { contains: trimmedSearch, mode: 'insensitive' },
          },
        },
      ];
    }

    // Dynamic Column Sorting (handles direct User columns + related Profile columns)
    const orderBy: any = {};
    if (sortBy === 'city' || sortBy === 'country') {
      orderBy.profile = { [sortBy]: sortOrder };
    } else if (sortBy) {
      orderBy[sortBy] = sortOrder;
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: userSafeSelect,
        skip,
        take: limit,
        orderBy,
      }),
      this.prisma.user.count({ where }),
    ]);

    return createPaginatedResponse(
      users,
      total,
      page,
      limit,
      sortBy,
      sortOrder,
    );
  }

  // 5. Admin: Find User by ID
  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userSafeSelect,
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  // 6. Admin: Assign or Update User Role (e.g. granting AUTHOR or VET access for Guides)
  async updateRole(
    id: string,
    dto: UpdateUserRoleDto,
    requester: AuthenticatedUser,
  ) {
    if (id === requester.userId) {
      throw new BadRequestException('You cannot modify your own role');
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });

    if (!targetUser) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const privilegedRoles = new Set<string>([Role.ADMIN, Role.SUPERADMIN]);

    // Only SUPERADMIN may promote to ADMIN/SUPERADMIN or alter an existing ADMIN/SUPERADMIN
    if (
      requester.role !== Role.SUPERADMIN &&
      (privilegedRoles.has(targetUser.role) || privilegedRoles.has(dto.role))
    ) {
      throw new ForbiddenException(
        'Only SUPERADMIN can grant or modify ADMIN / SUPERADMIN roles',
      );
    }

    return this.prisma.user.update({
      where: { id },
      data: { role: dto.role },
      select: userSafeSelect,
    });
  }

  // 7. Superadmin: Delete User
  async remove(id: string, currentUserId: string) {
    if (id === currentUserId) {
      throw new BadRequestException('You cannot delete your own account');
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { _count: { select: { authoredGuides: true } } },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    if (user._count.authoredGuides > 0) {
      throw new BadRequestException(
        `Cannot delete user because they have authored ${user._count.authoredGuides} guide(s). Reassign or remove their guides first.`,
      );
    }

    await this.prisma.user.delete({ where: { id } });
    return { message: `User ${user.email} deleted successfully` };
  }
}
