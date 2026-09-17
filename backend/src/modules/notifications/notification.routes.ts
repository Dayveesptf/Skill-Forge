import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import {
  getNotifications,
  getUnreadCount,
  readNotification,
  readAllNotifications
} from "./notification.controller";

const router = Router();

router.use(authenticate);

router.get("/", getNotifications);

router.get("/unread-count", getUnreadCount);

router.patch("/:id/read", readNotification);

router.patch("/read-all", readAllNotifications);

export default router;