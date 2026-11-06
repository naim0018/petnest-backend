import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from 'src/common/decorators/current-user.decerator';
import { Roles } from 'src/common/decorators/roles.decoretors';
import type { AuthenticatedUser } from 'src/common/guards/jwt-auth.guard';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RoleGuard } from 'src/common/guards/role.guard';
import type { MediaFolder } from './media.service';
import { MediaService } from './media.service';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
];

const ALLOWED_FOLDERS: MediaFolder[] = ['guides', 'pets', 'avatars'];
const GUIDE_UPLOAD_ROLES = new Set(['AUTHOR', 'VET', 'ADMIN', 'SUPERADMIN']);
const PET_UPLOAD_ROLES = new Set(['ADMIN', 'SUPERADMIN']);

@ApiTags('media')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RoleGuard)
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @ApiOperation({ summary: 'Upload and compress an image to Cloudflare R2' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        folder: {
          type: 'string',
          enum: ['guides', 'pets', 'avatars'],
          default: 'guides',
        },
        altText: { type: 'string', maxLength: 250 },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
      fileFilter: (_req, file, callback) => {
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          return callback(
            new BadRequestException(
              'Only JPEG, PNG, WebP, and AVIF images are allowed',
            ),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
    @Body('folder') folder?: MediaFolder,
    @Body('altText') altText?: string,
  ) {
    if (folder && !ALLOWED_FOLDERS.includes(folder)) {
      throw new BadRequestException(
        `folder must be one of: ${ALLOWED_FOLDERS.join(', ')}`,
      );
    }

    const targetFolder: MediaFolder =
      folder ?? (GUIDE_UPLOAD_ROLES.has(user.role) ? 'guides' : 'avatars');

    if (targetFolder === 'guides' && !GUIDE_UPLOAD_ROLES.has(user.role)) {
      throw new ForbiddenException(
        'Only Authors, Vets, and Admins can upload guide media',
      );
    }

    if (targetFolder === 'pets' && !PET_UPLOAD_ROLES.has(user.role)) {
      throw new ForbiddenException('Only Admins can upload pet catalog media');
    }

    if (altText && altText.length > 250) {
      throw new BadRequestException('altText cannot exceed 250 characters');
    }

    return this.mediaService.uploadImage(
      file,
      user.userId,
      targetFolder,
      altText,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an uploaded media asset' })
  deleteMedia(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.mediaService.deleteMedia(id, user.userId, user.role);
  }

  @Post('cleanup-orphans')
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiOperation({ summary: 'Admin: Purge unattached draft images older than 24h' })
  cleanupOrphans() {
    return this.mediaService.cleanupOrphanedMedia(24);
  }
}
