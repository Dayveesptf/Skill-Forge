import { Router } from "express";

import {
  authenticate,
  authorize,
} from "../../middleware/auth";

import { UserRole } from "../../constants/roles";

import {
  createRoleProfileHandler,
  getRoleProfiles,
  getRoleProfileHandler,
  updateRoleProfileHandler,
  publishRoleProfileHandler,
  archiveRoleProfileHandler,
} from "./roleProfile.controller";

const router = Router();

router.use(authenticate);

/* -------------------------------------------------------------------------- */
/* Role Profiles - Collection                                                 */
/* -------------------------------------------------------------------------- */

router.post(
  "/",
  authorize(
    UserRole.PLATFORM_ADMIN,
    UserRole.ORGANIZATION_ADMIN
  ),
  createRoleProfileHandler
);

router.get(
  "/",
  getRoleProfiles
);

/*
 * Career path management lives entirely under /api/career-paths
 * (see modules/careerPaths). It used to be duplicated here as well,
 * writing to the same CareerPath collection through a second set of
 * routes/controller/service with its own (and different) role rules —
 * that duplication has been removed. Use /api/career-paths for all
 * career path reads/writes.
 */

/* -------------------------------------------------------------------------- */
/* Role Profiles - Individual                                                 */
/* -------------------------------------------------------------------------- */

router.get(
  "/:id",
  getRoleProfileHandler
);

router.patch(
  "/:id",
  authorize(
    UserRole.PLATFORM_ADMIN,
    UserRole.ORGANIZATION_ADMIN
  ),
  updateRoleProfileHandler
);

router.post(
  "/:id/publish",
  authorize(
    UserRole.PLATFORM_ADMIN,
    UserRole.ORGANIZATION_ADMIN
  ),
  publishRoleProfileHandler
);

router.post(
  "/:id/archive",
  authorize(
    UserRole.PLATFORM_ADMIN,
    UserRole.ORGANIZATION_ADMIN
  ),
  archiveRoleProfileHandler
);

export default router;