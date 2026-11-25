import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';
import { Role, NotificationType } from 'prisma/generated/prisma/client';

export interface CreateNotificationDto {
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
  data?: any;
  userId?: string;
  targetRole?: Role;
}

const RETENTION_DAYS = 30;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
  ) {}

  /**
   * Helper to create notification with 30-day auto-expiry and emit via WebSocket
   */
  async createAndEmit(dto: CreateNotificationDto) {
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );

    const notification = await this.prisma.notification.create({
      data: {
        type: dto.type,
        title: dto.title,
        message: dto.message,
        actionUrl: dto.actionUrl,
        data: dto.data || undefined,
        userId: dto.userId || null,
        targetRole: dto.targetRole || null,
        expiresAt,
      },
    });

    const payload = {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      actionUrl: notification.actionUrl,
      createdAt: notification.createdAt.toISOString(),
      isRead: false,
    };

    // Emit live WebSocket notification
    if (dto.userId) {
      this.gateway.emitToUser(dto.userId, 'new_notification', payload);
    } else if (dto.targetRole) {
      this.gateway.emitToRole(dto.targetRole, 'new_notification', payload);
    } else {
      this.gateway.broadcast('new_notification', payload);
    }

    return notification;
  }

  /**
   * Notify users whose pet interests (Species or Breed) match a newly published guide
   */
  async notifyMatchingInterestUsers(guide: {
    id: string;
    title: string;
    slug: string;
    speciesId?: string | null;
    authorId?: string | null;
    breeds?: { id: string }[];
  }) {
    if (!guide.speciesId && (!guide.breeds || guide.breeds.length === 0)) {
      return;
    }

    const breedIds = guide.breeds?.map((b) => b.id) || [];

    // Find all active, non-banned users with matching interest
    const interestedUsers = await this.prisma.user.findMany({
      where: {
        isBanned: false,
        ...(guide.authorId ? { id: { not: guide.authorId } } : {}),
        OR: [
          ...(guide.speciesId ? [{ interestedSpeciesId: guide.speciesId }] : []),
          ...(breedIds.length > 0
            ? [{ interestedBreedId: { in: breedIds } }]
            : []),
        ],
      },
      select: { id: true },
    });

    if (interestedUsers.length === 0) {
      return;
    }

    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );

    const title = `New Guide: ${guide.title}`;
    const message = `A new care guide matching your pet interests was just published.`;
    const actionUrl = `/guides/${guide.slug}`;

    // Batch insert notifications for all matched users
    const records = interestedUsers.map((user) => ({
      type: NotificationType.NEW_INTEREST_GUIDE,
      title,
      message,
      actionUrl,
      userId: user.id,
      expiresAt,
    }));

    await this.prisma.notification.createMany({ data: records });

    // Emit live WebSocket event to each matched user
    for (const user of interestedUsers) {
      this.gateway.emitToUser(user.id, 'new_notification', {
        type: NotificationType.NEW_INTEREST_GUIDE,
        title,
        message,
        actionUrl,
        createdAt: now.toISOString(),
        isRead: false,
      });
    }

    this.logger.log(
      `Dispatched guide notification "${guide.title}" to ${interestedUsers.length} interested users`,
    );
  }

  /**
   * Notify user when their account is suspended (banned) or restored
   */
  async notifyAccountSuspension(
    userId: string,
    reason?: string | null,
    isBanned = true,
  ) {
    if (isBanned) {
      await this.createAndEmit({
        type: NotificationType.ACCOUNT_SUSPENDED,
        title: 'Account Suspended',
        message: reason
          ? `Your account access has been restricted. Reason: ${reason}`
          : 'Your account access has been restricted by an administrator.',
        actionUrl: '/user/help/support',
        userId,
      });
    } else {
      await this.createAndEmit({
        type: NotificationType.ACCOUNT_RESTORED,
        title: 'Account Access Restored',
        message:
          'Your account suspension has been lifted. Full platform access is restored.',
        actionUrl: '/',
        userId,
      });
    }
  }

  /**
   * Notify user when their verification application is approved or rejected
   */
  async notifyVerificationStatus(
    userId: string,
    approved: boolean,
    notes?: string,
  ) {
    if (approved) {
      await this.createAndEmit({
        type: NotificationType.VERIFICATION_APPROVED,
        title: 'Verification Approved',
        message:
          'Your verification credentials have been approved! You now have a verified seller/breeder badge.',
        actionUrl: '/user/profile',
        userId,
      });
    } else {
      await this.createAndEmit({
        type: NotificationType.VERIFICATION_REJECTED,
        title: 'Verification Not Approved',
        message: notes
          ? `Your verification request was not approved: ${notes}`
          : 'Your verification request was not approved. You can review and resubmit.',
        actionUrl: '/user/settings',
        userId,
      });
    }
  }

  /**
   * Fetch paginated notifications for current user (direct + role broadcast within 30-day window)
   */
  async getNotifications(
    userId: string,
    role: string,
    page = 1,
    limit = 20,
  ) {
    const now = new Date();
    const skip = (page - 1) * limit;

    const whereClause: any = {
      expiresAt: { gt: now },
      OR: [
        { userId },
        { targetRole: role as Role },
      ],
    };

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          reads: {
            where: { userId },
            select: { id: true, readAt: true },
          },
        },
      }),
      this.prisma.notification.count({ where: whereClause }),
    ]);

    const formatted = items.map((item) => {
      // Direct notification reads isRead flag; Broadcast notification checks reads table
      const isRead = item.userId
        ? item.isRead
        : item.reads && item.reads.length > 0;

      return {
        id: item.id,
        type: item.type,
        title: item.title,
        message: item.message,
        actionUrl: item.actionUrl,
        createdAt: item.createdAt.toISOString(),
        isRead,
      };
    });

    return {
      items: formatted,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Calculate unread notification count
   */
  async getUnreadCount(userId: string, role: string): Promise<number> {
    const now = new Date();

    const [unreadDirect, unreadBroadcast] = await Promise.all([
      // 1. Direct user unread notifications
      this.prisma.notification.count({
        where: {
          userId,
          isRead: false,
          expiresAt: { gt: now },
        },
      }),
      // 2. Broadcast role notifications not yet read by this user
      this.prisma.notification.count({
        where: {
          targetRole: role as Role,
          expiresAt: { gt: now },
          reads: {
            none: { userId },
          },
        },
      }),
    ]);

    return unreadDirect + unreadBroadcast;
  }

  /**
   * Mark a single notification as read
   */
  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) return { success: false };

    if (notification.userId === userId) {
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: { isRead: true, readAt: new Date() },
      });
    } else if (notification.targetRole) {
      await this.prisma.notificationRead.upsert({
        where: {
          notificationId_userId: { notificationId, userId },
        },
        create: { notificationId, userId },
        update: { readAt: new Date() },
      });
    }

    return { success: true };
  }

  /**
   * Mark all active notifications as read for current user
   */
  async markAllAsRead(userId: string, role: string) {
    const now = new Date();

    // 1. Mark direct notifications read
    await this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
        expiresAt: { gt: now },
      },
      data: { isRead: true, readAt: now },
    });

    // 2. Mark unread broadcast notifications
    const unreadBroadcasts = await this.prisma.notification.findMany({
      where: {
        targetRole: role as Role,
        expiresAt: { gt: now },
        reads: {
          none: { userId },
        },
      },
      select: { id: true },
    });

    if (unreadBroadcasts.length > 0) {
      await this.prisma.notificationRead.createMany({
        data: unreadBroadcasts.map((n) => ({
          notificationId: n.id,
          userId,
          readAt: now,
        })),
        skipDuplicates: true,
      });
    }

    return { success: true };
  }

  /**
   * Auto-purge notifications exceeding the 30-day retention window
   */
  async cleanupExpiredNotifications() {
    const now = new Date();
    const result = await this.prisma.notification.deleteMany({
      where: { expiresAt: { lte: now } },
    });
    this.logger.log(`Purged ${result.count} expired notifications (>30 days)`);
  }
}
