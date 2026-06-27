import { prisma } from "@/lib/prisma";
import type { NotificationType, Prisma } from "@prisma/client";

// In-app notifications (M8b / §3). DB logic lives here, mirroring claim.ts.

export interface NotificationView {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  url: string | null;
  readAt: Date | null;
  createdAt: Date;
}

const VIEW_SELECT = {
  id: true,
  type: true,
  title: true,
  body: true,
  url: true,
  readAt: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  url?: string | null;
  data?: Prisma.InputJsonValue;
}

export async function createNotification(input: CreateNotificationInput): Promise<{ id: string }> {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title.slice(0, 255),
      body: input.body ?? null,
      url: input.url ? input.url.slice(0, 512) : null,
      ...(input.data !== undefined ? { data: input.data } : {}),
    },
    select: { id: true },
  });
}

/** A user's notifications, newest first (most recent N). */
export async function listNotifications(userId: string, take = 50): Promise<NotificationView[]> {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    select: VIEW_SELECT,
  });
}

/** Count of unread notifications, for the bell badge. */
export function countUnread(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

/**
 * Mark notifications read. With no ids, marks ALL of the user's unread ones.
 * Scoped to the user so a caller can never read another user's rows.
 */
export async function markNotificationsRead(userId: string, ids?: string[]): Promise<number> {
  const where: Prisma.NotificationWhereInput = { userId, readAt: null };
  if (ids && ids.length) where.id = { in: ids };
  const result = await prisma.notification.updateMany({ where, data: { readAt: new Date() } });
  return result.count;
}
