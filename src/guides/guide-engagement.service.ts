import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
    const safeLimit = Math.min(1000, Math.max(1, Number(limit) || 12));
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

  // Logged-in User's Liked Guides
  async getMyLikes(userId: string, page = 1, limit = 12) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(1000, Math.max(1, Number(limit) || 12));
    const skip = (safePage - 1) * safeLimit;

    const where = {
      userId,
      guide: {
        status: GuideStatus.PUBLISHED,
        deletedAt: null,
      },
    };

    const [likes, total] = await Promise.all([
      this.prisma.guideLike.findMany({
        where,
        include: {
          guide: {
            select: {
              ...guideSummarySelect,
              bookmarks: { where: { userId }, select: { id: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: safeLimit,
      }),
      this.prisma.guideLike.count({ where }),
    ]);

    return {
      items: likes.map((l: any) => {
        const { bookmarks, ...guideRest } = l.guide;
        return {
          likedAt: l.createdAt,
          ...guideRest,
          isLiked: true,
          isBookmarked: Boolean(bookmarks?.length),
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

  // Get all comments for a published guide (flat list ordered chronologically for O(n) tree building)
  async getComments(guideId: string) {
    const comments = await this.prisma.guideComment.findMany({
      where: {
        guideId,
        guide: { status: GuideStatus.PUBLISHED, deletedAt: null },
      },
      select: {
        id: true,
        content: true,
        guideId: true,
        parentId: true,
        isEdited: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            name: true,
            role: true,
            profile: {
              select: {
                avatar: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      items: comments,
      total: comments.length,
    };
  }

  // Create a comment or infinite-level nested reply
  async createComment(
    guideId: string,
    userId: string,
    content: string,
    parentId?: string,
  ) {
    const trimmed = content?.trim();
    if (!trimmed) {
      throw new BadRequestException('Comment content cannot be empty');
    }

    const guide = await this.prisma.guide.findFirst({
      where: { id: guideId, status: GuideStatus.PUBLISHED, deletedAt: null },
      select: { id: true },
    });
    if (!guide) {
      throw new NotFoundException('Published guide not found');
    }

    if (parentId) {
      const parent = await this.prisma.guideComment.findFirst({
        where: { id: parentId, guideId },
        select: { id: true },
      });
      if (!parent) {
        throw new NotFoundException('Parent comment not found on this guide');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.guideComment.create({
        data: {
          content: trimmed,
          guideId,
          userId,
          parentId: parentId || null,
        },
        select: {
          id: true,
          content: true,
          guideId: true,
          parentId: true,
          isEdited: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              name: true,
              role: true,
              profile: {
                select: {
                  avatar: true,
                },
              },
            },
          },
        },
      });

      await tx.$queryRaw`
        UPDATE "Guide"
        SET "commentCount" = (
          SELECT COUNT(*)::int FROM "GuideComment" WHERE "guideId" = ${guideId}
        )
        WHERE "id" = ${guideId}
      `;

      return created;
    });
  }

  // Update own comment
  async updateComment(commentId: string, userId: string, content: string) {
    const trimmed = content?.trim();
    if (!trimmed) {
      throw new BadRequestException('Comment content cannot be empty');
    }

    const existing = await this.prisma.guideComment.findUnique({
      where: { id: commentId },
      select: { id: true, userId: true },
    });
    if (!existing) {
      throw new NotFoundException('Comment not found');
    }
    if (existing.userId !== userId) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    return this.prisma.guideComment.update({
      where: { id: commentId },
      data: { content: trimmed, isEdited: true },
      select: {
        id: true,
        content: true,
        guideId: true,
        parentId: true,
        isEdited: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            name: true,
            role: true,
            profile: {
              select: {
                avatar: true,
              },
            },
          },
        },
      },
    });
  }

  // Delete comment (Owner OR Admin/SuperAdmin)
  async deleteComment(commentId: string, userId: string, userRole?: string) {
    const existing = await this.prisma.guideComment.findUnique({
      where: { id: commentId },
      select: { id: true, userId: true, guideId: true },
    });
    if (!existing) {
      throw new NotFoundException('Comment not found');
    }

    const isAdmin = userRole === 'ADMIN' || userRole === 'SUPERADMIN';
    if (existing.userId !== userId && !isAdmin) {
      throw new ForbiddenException('You do not have permission to delete this comment');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.guideComment.delete({ where: { id: commentId } });

      const rows = await tx.$queryRaw<{ commentCount: number }[]>`
        UPDATE "Guide"
        SET "commentCount" = (
          SELECT COUNT(*)::int FROM "GuideComment" WHERE "guideId" = ${existing.guideId}
        )
        WHERE "id" = ${existing.guideId}
        RETURNING "commentCount"
      `;

      return {
        deleted: true,
        commentId,
        commentCount: rows[0]?.commentCount ?? 0,
      };
    });
  }
}
