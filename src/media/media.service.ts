import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { PrismaService } from 'src/prisma/prisma.service';

export type MediaFolder = 'guides' | 'pets' | 'avatars';

const MAX_INPUT_PIXELS = 40_000_000; // ~40 MP cap against decompression-bomb DoS
const EDITORIAL_PRIVILEGED_ROLES = new Set(['VET', 'ADMIN', 'SUPERADMIN']);

@Injectable()
export class MediaService {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly publicUrl: string;
  private readonly isConfigured: boolean;

  constructor(private readonly prisma: PrismaService) {
    const accountId = process.env.R2_ACCOUNT_ID?.trim() || '';
    const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim() || '';
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim() || '';
    this.bucketName = process.env.R2_BUCKET_NAME?.trim() || '';
    this.publicUrl = (process.env.R2_PUBLIC_URL?.trim() || '').replace(/\/$/, '');

    this.isConfigured = Boolean(
      accountId &&
        accessKeyId &&
        secretAccessKey &&
        this.bucketName &&
        this.publicUrl,
    );

    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: accountId
        ? `https://${accountId}.r2.cloudflarestorage.com`
        : 'https://placeholder.r2.cloudflarestorage.com',
      credentials: {
        accessKeyId: accessKeyId || 'placeholder',
        secretAccessKey: secretAccessKey || 'placeholder',
      },
    });
  }

  private ensureConfigured() {
    if (!this.isConfigured) {
      throw new InternalServerErrorException(
        'Cloudflare R2 storage is not configured. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and R2_PUBLIC_URL in .env',
      );
    }
  }

  // 1. Compress to WebP -> Upload to Cloudflare R2 -> Track in MediaAsset
  async uploadImage(
    file: Express.Multer.File,
    uploadedById: string,
    folder: MediaFolder = 'guides',
    altText?: string,
  ) {
    this.ensureConfigured();

    if (!file) {
      throw new BadRequestException('Image file is required');
    }

    let processedBuffer: Buffer;
    let metadata: sharp.OutputInfo;

    try {
      const result = await sharp(file.buffer, {
        limitInputPixels: MAX_INPUT_PIXELS,
      })
        .rotate() // Auto-fix phone camera EXIF orientation & strip GPS metadata
        .resize({
          width: 1600,
          withoutEnlargement: true,
        })
        .webp({ quality: 82 })
        .toBuffer({ resolveWithObject: true });

      processedBuffer = result.data;
      metadata = result.info;
    } catch {
      throw new BadRequestException(
        'Invalid, corrupted, or oversized-dimension image file',
      );
    }

    const now = new Date();
    const yearMonth = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
    const objectKey = `${folder}/${yearMonth}/${randomUUID()}.webp`;
    const url = `${this.publicUrl}/${objectKey}`;

    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: objectKey,
          Body: processedBuffer,
          ContentType: 'image/webp',
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
    } catch (error) {
      console.error('R2 Upload Error:', error);
      throw new InternalServerErrorException('Failed to upload image to storage');
    }

    return this.prisma.mediaAsset.create({
      data: {
        objectKey,
        url,
        mimeType: 'image/webp',
        sizeBytes: metadata.size,
        width: metadata.width,
        height: metadata.height,
        altText: altText?.trim().slice(0, 250) || null,
        uploadedById,
      },
    });
  }

  // 2. Sync inline paragraph <img src="..."> + coverImage when a Guide is created/updated
  //    Prevents cross-guide media hijacking by never claiming assets already linked to another guide.
  async syncGuideMedia(
    guideId: string,
    coverImage?: string | null,
    htmlContent?: string,
    requester?: { userId: string; role: string },
  ) {
    const usedUrls = new Set<string>();

    if (coverImage) {
      usedUrls.add(coverImage.trim());
    }

    if (htmlContent) {
      const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
      let match: RegExpExecArray | null;
      while ((match = imgRegex.exec(htmlContent)) !== null) {
        if (match[1]) {
          usedUrls.add(match[1].trim());
        }
      }
    }

    const urlList = Array.from(usedUrls);
    const isPrivileged =
      !requester || EDITORIAL_PRIVILEGED_ROLES.has(requester.role);

    await this.prisma.$transaction([
      // Detach any previously linked image removed from THIS guide
      this.prisma.mediaAsset.updateMany({
        where: {
          guideId,
          ...(urlList.length > 0 ? { url: { notIn: urlList } } : {}),
        },
        data: { guideId: null },
      }),
      // Attach unattached images (never steal images already belonging to another guide)
      ...(urlList.length > 0
        ? [
            this.prisma.mediaAsset.updateMany({
              where: {
                url: { in: urlList },
                OR: [
                  { guideId },
                  {
                    guideId: null,
                    ...(!isPrivileged && requester
                      ? { uploadedById: requester.userId }
                      : {}),
                  },
                ],
              },
              data: { guideId },
            }),
          ]
        : []),
    ]);
  }

  // Detach all linked media when a guide is soft-deleted so orphan cleanup can reclaim storage
  async detachGuideMedia(guideId: string) {
    await this.prisma.mediaAsset.updateMany({
      where: { guideId },
      data: { guideId: null },
    });
  }

  // 3. Delete a single MediaAsset (from both R2 and DB)
  async deleteMedia(id: string, requesterId: string, requesterRole: string) {
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id },
      include: {
        guide: { select: { id: true, title: true, deletedAt: true } },
      },
    });

    if (!asset) {
      throw new NotFoundException('Media asset not found');
    }

    const isAdmin = requesterRole === 'ADMIN' || requesterRole === 'SUPERADMIN';
    if (!isAdmin && asset.uploadedById !== requesterId) {
      throw new ForbiddenException('You can only delete your own uploaded media');
    }

    if (asset.guide && !asset.guide.deletedAt) {
      throw new BadRequestException(
        `Cannot delete media currently used in guide "${asset.guide.title}". Remove the image from the guide and save first.`,
      );
    }

    if (this.isConfigured) {
      const deletedFromStorage = await this.deleteFromR2(asset.objectKey);
      if (!deletedFromStorage) {
        throw new InternalServerErrorException(
          'Failed to delete file from cloud storage. Please try again.',
        );
      }
    }

    await this.prisma.mediaAsset.delete({ where: { id } });

    return { message: 'Media deleted successfully' };
  }

  // 4. Admin Cleanup: Purge unattached draft images older than 24 hours
  async cleanupOrphanedMedia(olderThanHours = 24) {
    this.ensureConfigured();

    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);

    const orphans = await this.prisma.mediaAsset.findMany({
      where: {
        guideId: null,
        objectKey: { startsWith: 'guides/' },
        createdAt: { lt: cutoff },
      },
      take: 100,
    });

    let deletedCount = 0;
    for (const orphan of orphans) {
      const ok = await this.deleteFromR2(orphan.objectKey);
      if (ok) {
        await this.prisma.mediaAsset.delete({ where: { id: orphan.id } });
        deletedCount++;
      }
    }

    return {
      message: `Cleaned up ${deletedCount} orphaned media file(s)`,
      deletedCount,
    };
  }

  private async deleteFromR2(objectKey: string): Promise<boolean> {
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: objectKey,
        }),
      );
      return true;
    } catch (error) {
      console.error(`Failed to delete R2 object ${objectKey}:`, error);
      return false;
    }
  }
}
