import { Router } from "express";

import { authenticate, authorize } from "../../middleware/auth";
import { UserRole } from "../../constants/roles";

import {
  getUploadUrl,
  confirmUpload,
  listAttachments,
  removeAttachment,
} from "./evidence.controller";

const router = Router();

router.use(authenticate);

/*
 * Viewing evidence is allowed for STAFF (own), MANAGER (via the
 * corroboration workflow), ORGANIZATION_ADMIN and PLATFORM_ADMIN —
 * enforced inside the controller via canAccessCandidate,
 * not at the route level.
 */
router.get(
  "/responses/:responseId",
  listAttachments,
);

/*
 * Requesting an upload URL, confirming an upload, and deleting an
 * attachment are all writes to the candidate's own self-assessment,
 * so they're restricted to STAFF at the route level.
 */
router.post(
  "/responses/:responseId/upload-url",
  authorize(UserRole.STAFF),
  getUploadUrl,
);

router.post(
  "/responses/:responseId/confirm",
  authorize(UserRole.STAFF),
  confirmUpload,
);

router.delete(
  "/responses/:responseId/attachments/:key",
  authorize(UserRole.STAFF),
  removeAttachment,
);

export default router;