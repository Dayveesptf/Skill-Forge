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
  createCareerPathHandler,
  getCareerPaths,
  getCareerPathHandler,
  updateCareerPathHandler,
  deleteCareerPathHandler,
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

/* -------------------------------------------------------------------------- */
/* Career Paths                                                               */
/*                                                                            */
/* These routes MUST appear before "/:id".                                    */
/* Otherwise "/career-paths" can be interpreted as a role-profile ID.        */
/* -------------------------------------------------------------------------- */

router.post(
  "/career-paths",
  authorize(
    UserRole.PLATFORM_ADMIN,
    UserRole.ORGANIZATION_ADMIN
  ),
  createCareerPathHandler
);

router.get(
  "/career-paths",
  getCareerPaths
);

router.get(
  "/career-paths/:id",
  getCareerPathHandler
);

router.patch(
  "/career-paths/:id",
  authorize(
    UserRole.PLATFORM_ADMIN,
    UserRole.ORGANIZATION_ADMIN
  ),
  updateCareerPathHandler
);

router.delete(
  "/career-paths/:id",
  authorize(
    UserRole.PLATFORM_ADMIN,
    UserRole.ORGANIZATION_ADMIN
  ),
  deleteCareerPathHandler
);

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