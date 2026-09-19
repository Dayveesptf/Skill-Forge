import { Router } from "express";
import { authenticate, authorize } from "../../middleware/auth";
import { UserRole } from "../../constants/roles";
import {
  getAuditLogs,
  getAuditLog
} from "./audit.controller";

const router = Router();

router.use(authenticate);
router.use(authorize(UserRole.PLATFORM_ADMIN, UserRole.ORGANIZATION_ADMIN));

router.get("/", getAuditLogs);

router.get("/:id", getAuditLog);

export default router;