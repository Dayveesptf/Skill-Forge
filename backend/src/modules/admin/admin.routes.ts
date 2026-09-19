import { Router } from "express";
import { authenticate, authorize } from "../../middleware/auth";
import { UserRole } from "../../constants/roles";
import {
  platformOverview,
  organizationOverview,
  listOrganizationUsers,
  updateUserStatus
} from "./admin.controller";

const router = Router();

router.use(authenticate);

/*
 * Platform-wide overview is platform-admin only — there is no
 * organization-scoped equivalent of this data.
 */
router.get(
  "/platform/overview",
  authorize(UserRole.PLATFORM_ADMIN),
  platformOverview
);

/*
 * These four routes are shared by platform admins (who pass an
 * explicit :organizationId) and organization admins (who always
 * act on their own organization, ignoring any :organizationId in
 * the URL) — see organizationOverview/listOrganizationUsers in the
 * controller for how the two are distinguished.
 */
router.get(
  "/organizations/:organizationId/overview",
  authorize(UserRole.PLATFORM_ADMIN, UserRole.ORGANIZATION_ADMIN),
  organizationOverview
);

router.get(
  "/organizations/:organizationId/users",
  authorize(UserRole.PLATFORM_ADMIN, UserRole.ORGANIZATION_ADMIN),
  listOrganizationUsers
);

router.get(
  "/organization/overview",
  authorize(UserRole.PLATFORM_ADMIN, UserRole.ORGANIZATION_ADMIN),
  organizationOverview
);

router.get(
  "/organization/users",
  authorize(UserRole.PLATFORM_ADMIN, UserRole.ORGANIZATION_ADMIN),
  listOrganizationUsers
);

router.patch(
  "/users/:userId/status",
  authorize(UserRole.PLATFORM_ADMIN, UserRole.ORGANIZATION_ADMIN),
  updateUserStatus
);

export default router;