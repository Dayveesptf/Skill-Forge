import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import {
  platformOverview,
  organizationOverview,
  listOrganizationUsers,
  updateUserStatus
} from "./admin.controller";

const router = Router();

router.use(authenticate);

router.get(
  "/platform/overview",
  platformOverview
);

router.get(
  "/organizations/:organizationId/overview",
  organizationOverview
);

router.get(
  "/organizations/:organizationId/users",
  listOrganizationUsers
);

router.get(
  "/organization/overview",
  organizationOverview
);

router.get(
  "/organization/users",
  listOrganizationUsers
);

router.patch(
  "/users/:userId/status",
  updateUserStatus
);

export default router;