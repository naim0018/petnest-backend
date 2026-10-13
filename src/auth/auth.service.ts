import { ConflictException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor (private readonly prisma:PrismaService) {}
  login(dto: LoginDto) {
    // const user = this.prisma.user()
    return { message: 'Logged in successfully', email: dto.email };
  }
  logout() {
    return { message: 'Logged out successfully' };
  }
  async register(payload:RegisterDto){ 
    console.log(payload);

    const {name,email,password,phone,interestedBreed,interestedSpecies} = payload;

    const existingUser = await this.prisma.user.findUnique({
      where: {email}
    })

    console.log(existingUser)

    if (existingUser) throw new ConflictException("User already exists")

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds)
    if (interestedSpecies) {
      const speciesExists = await this.prisma.petSpecies.findUnique({
        where: { id: interestedSpecies },
      });
      if (!speciesExists) {
        throw new ConflictException('Selected interested species does not exist');
      }
    }

    if (interestedBreed) {
      const breedExists = await this.prisma.petBreed.findUnique({
        where: { id: interestedBreed },
      });
      if (!breedExists) {
        throw new ConflictException('Selected interested breed does not exist');
      }
    }

    try {
      const newUser = await this.prisma.user.create({
        data: {
          name,
          email,
          phone,
          password: hashedPassword,
          interestedSpeciesId: interestedSpecies || null,
          interestedBreedId: interestedBreed || null,
        },
        include: {
          interestedSpecies: true,
          interestedBreed: true,
        },
      });
      const { password: _, ...result } = newUser;
      return { message: 'User Register Successfully', data: result };
    } catch (error) {
      console.log('Error while user registration', error);
      throw new InternalServerErrorException('Failed to register user');
    }
  }
}
 