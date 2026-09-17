import { Types } from "mongoose";
import Notification, {
  INotification,
  NotificationPriority,
  NotificationType
} from "../../models/Notification";

interface CreateNotificationInput {
  organizationId?: string;
  recipientId: string;
  type: NotificationType;
  priority?: NotificationPriority;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

interface ListNotificationsInput {
  recipientId: string;
  organizationId?: string;
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
}

export async function createNotification(
  input: CreateNotificationInput
): Promise<INotification> {
  const notification = await Notification.create({
    organizationId: input.organizationId
      ? new Types.ObjectId(input.organizationId)
      : undefined,
    recipientId: new Types.ObjectId(input.recipientId),
    type: input.type,
    priority: input.priority ?? NotificationPriority.NORMAL,
    title: input.title,
    message: input.message,
    entityType: input.entityType,
    entityId: input.entityId
      ? new Types.ObjectId(input.entityId)
      : undefined,
    metadata: input.metadata
  });

  return notification;
}

export async function createNotifications(
  inputs: CreateNotificationInput[]
): Promise<INotification[]> {
  if (inputs.length === 0) {
    return [];
  }

  const documents = inputs.map((input) => ({
    organizationId: input.organizationId
      ? new Types.ObjectId(input.organizationId)
      : undefined,
    recipientId: new Types.ObjectId(input.recipientId),
    type: input.type,
    priority: input.priority ?? NotificationPriority.NORMAL,
    title: input.title,
    message: input.message,
    entityType: input.entityType,
    entityId: input.entityId
      ? new Types.ObjectId(input.entityId)
      : undefined,
    metadata: input.metadata
  }));

  return Notification.insertMany(documents);
}

export async function listNotifications(
  input: ListNotificationsInput
) {
  const page = Math.max(1, input.page ?? 1);
  const limit = Math.min(100, Math.max(1, input.limit ?? 20));

  const filter: Record<string, unknown> = {
    recipientId: new Types.ObjectId(input.recipientId)
  };

  if (input.organizationId) {
    filter.organizationId = new Types.ObjectId(input.organizationId);
  }

  if (input.unreadOnly) {
    filter.readAt = { $exists: false };
  }

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),

    Notification.countDocuments(filter),

    Notification.countDocuments({
      ...filter,
      readAt: { $exists: false }
    })
  ]);

  return {
    notifications,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    },
    unreadCount
  };
}

export async function markNotificationAsRead(
  notificationId: string,
  recipientId: string
) {
  const notification = await Notification.findOneAndUpdate(
    {
      _id: notificationId,
      recipientId
    },
    {
      $set: {
        readAt: new Date()
      }
    },
    {
      new: true
    }
  );

  if (!notification) {
    throw new Error("Notification not found");
  }

  return notification;
}

export async function markAllNotificationsAsRead(
  recipientId: string,
  organizationId?: string
) {
  const filter: Record<string, unknown> = {
    recipientId,
    readAt: { $exists: false }
  };

  if (organizationId) {
    filter.organizationId = organizationId;
  }

  const result = await Notification.updateMany(
    filter,
    {
      $set: {
        readAt: new Date()
      }
    }
  );

  return {
    modifiedCount: result.modifiedCount
  };
}

export async function getUnreadNotificationCount(
  recipientId: string,
  organizationId?: string
) {
  const filter: Record<string, unknown> = {
    recipientId,
    readAt: { $exists: false }
  };

  if (organizationId) {
    filter.organizationId = organizationId;
  }

  return Notification.countDocuments(filter);
}