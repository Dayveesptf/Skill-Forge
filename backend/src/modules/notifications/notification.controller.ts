import { Response } from "express";
import { AuthenticatedRequest } from "../../middleware/auth";
import {
  listNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  getUnreadNotificationCount
} from "./notification.service";

function getRouteParam(
  value: string | string[] | undefined,
  paramName: string
): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${paramName} is required`);
  }

  return value;
}

export async function getNotifications(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);

    const unreadOnly =
      req.query.unreadOnly === "true";

    const result = await listNotifications({
      recipientId: req.user!.userId,
      organizationId: req.user!.organizationId,
      page,
      limit,
      unreadOnly
    });

    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error("Get notifications error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve notifications"
    });
  }
}

export async function getUnreadCount(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const count = await getUnreadNotificationCount(
      req.user!.userId,
      req.user!.organizationId
    );

    return res.json({
      success: true,
      data: {
        unreadCount: count
      }
    });
  } catch (error) {
    console.error("Get unread notification count error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve unread notification count"
    });
  }
}

export async function readNotification(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const id = getRouteParam(req.params.id, "notification id");

    const notification = await markNotificationAsRead(
      id,
      req.user!.userId
    );

    return res.json({
      success: true,
      data: notification
    });
  } catch (error) {
    console.error("Mark notification as read error:", error);

    return res.status(404).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Notification not found"
    });
  }
}

export async function readAllNotifications(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const result = await markAllNotificationsAsRead(
      req.user!.userId,
      req.user!.organizationId
    );

    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error("Mark all notifications as read error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to mark notifications as read"
    });
  }
}