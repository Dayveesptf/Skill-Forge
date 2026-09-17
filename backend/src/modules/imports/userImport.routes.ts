import { Router } from "express";
import { authenticate, authorize, requireOrganization } from "../../middleware/auth";
import { UserRole } from "../../constants/roles";
import { importUsers } from "./userImport.controller";

const router = Router();

router.post(
  "/users",
  authenticate,
  requireOrganization,
  authorize(UserRole.ORGANIZATION_ADMIN),
  importUsers
);

export default router;
