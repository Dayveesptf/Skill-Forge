import { Response } from "express";
import { AuthenticatedRequest } from "../../middleware/auth";
import { writeAuditLog } from "../../utils/audit";
import { bulkImportUsers } from "./userImport.service";

export async function importUsers(req: AuthenticatedRequest, res: Response) {
  if (!req.user?.organizationId) {
    res.status(400).json({ success: false, message: "Organization context is required" });
    return;
  }

  if (!Array.isArray(req.body.rows)) {
    res.status(400).json({ success: false, message: "rows must be an array" });
    return;
  }

  const result = await bulkImportUsers(
    req.user.organizationId,
    req.body.rows
  );

  await writeAuditLog(req, "USERS_BULK_IMPORTED", "Organization", req.user.organizationId, {
    created: result.created,
    skipped: result.skipped,
    failed: result.failed
  });

  res.status(201).json({ success: true, data: result });
}
