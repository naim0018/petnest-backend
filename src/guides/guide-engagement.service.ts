import { Injectable, NotFoundException } from '@nestjs/common';
import { GuideStatus } from 'prisma/generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import { guideSummarySelect } from './constants/guide.constants';

@Injectable()
export class GuideEngagementService {
  constructor(private readonly prisma: PrismaService) {}

  // Concurrency-safe Toggle Like (exact COUNT sync without mutating Guide @updatedAt)
  async toggleLike(guideId: string, userId: string) {
    const guide = await this.prisma.guide.findFirst({
      where: { id: guideId, status: GuideStatus.PUBLISHED, deletedAt: null },
      select: { id: true },
    });

    if (!guide) {
      throw new NotFoundException('Published guide not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const deleted = await tx.guideLike.deleteMany({
        where: { userId, guideId },
      });

      let liked = false;
      if (deleted.count === 0) {
        await tx.guideLike.createMany({
          data: [{ userId, guideId }],
          skipDuplicates: true,
        });
        liked = true;
      }

      const rows = await tx.$queryRaw<{ likeCount: number }[]>`
        UPDATE "Guide"
        SET "likeCount" = (
          SELECT COUNT(*)::int FROM "GuideLike" WHERE "guideId" = ${guideId}
        )
        WHERE "id" = ${guideId}
        RETURNING "likeCount"
      `;

      return {
        liked,
        likeCount: rows[0]?.likeCount ?? 0,
      };
    });
  }

  // Concurrency-safe Toggle Bookmark (exact COUNT sync without mutating Guide @updatedAt)
  async toggleBookmark(guideId: string, userId: string) {
    const guide = await this.prisma.guide.findFirst({
      where: { id: guideId, status: GuideStatus.PUBLISHED, deletedAt: null },
      select: { id: true },
    });

    if (!guide) {
      throw new NotFoundException('Published guide not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const deleted = await tx.guideBookmark.deleteMany({
        where: { userId, guideId },
      });

      let bookmarked = false;
      if (deleted.count === 0) {
        await tx.guideBookmark.createMany({
          data: [{ userId, guideId }],
          skipDuplicates: true,
        });
        bookmarked = true;
      }

      const rows = await tx.$queryRaw<{ bookmarkCount: number }[]>`
        UPDATE "Guide"
        SET "bookmarkCount" = (
          SELECT COUNT(*)::int FROM "GuideBookmark" WHERE "guideId" = ${guideId}
        )
        WHERE "id" = ${guideId}
        RETURNING "bookmarkCount"
      `;

      return {
        bookmarked,
        bookmarkCount: rows[0]?.bookmarkCount ?? 0,
      };
    });
  }

  // Logged-in User's Saved / Bookmarked Guides (hydrates both isBookmarked & isLiked)
  async getMyBookmarks(userId: string, page = 1, limit = 12) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(50, Math.max(1, Number(limit) || 12));
    const skip = (safePage - 1) * safeLimit;

    const where = {
      userId,
      guide: {
        status: GuideStatus.PUBLISHED,
        deletedAt: null,
      },
    };

    const [bookmarks, total] = await Promise.all([
      this.prisma.guideBookmark.findMany({
        where,
        include: {
          guide: {
            select: {
              ...guideSummarySelect,
              likes: { where: { userId }, select: { id: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: safeLimit,
      }),
      this.prisma.guideBookmark.count({ where }),
    ]);

    return {
      items: bookmarks.map((b: any) => {
        const { likes, ...guideRest } = b.guide;
        return {
          bookmarkedAt: b.createdAt,
          ...guideRest,
          isLiked: Boolean(likes?.length),
          isBookmarked: true,
        };
      }),
      meta: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
        hasNextPage: safePage * safeLimit < total,
        hasPrevPage: safePage > 1,
      },
    };
  }
}
