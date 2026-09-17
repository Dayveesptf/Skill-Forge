import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import {
  getAuditLogs,
  getAuditLog
} from "./audit.controller";

const router = Router();

router.use(authenticate);

router.get("/", getAuditLogs);

router.get("/:id", getAuditLog);

export default router;