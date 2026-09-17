import {
  Router,
} from "express";

import {
  authenticate,
  authorize,
  requireOrganization,
} from "../../middleware/auth";

import {
  UserRole,
} from "../../constants/roles";

import {
  list,
  roleOptions,
  getOne,
  create,
  update,
  remove,
} from "./careerPath.controller";

const router = Router();

router.use(authenticate);

/*
 * Career paths are organization-scoped data.
 *
 * A PLATFORM_ADMIN has no organizationId, so without this
 * guard the controller would throw a raw Error and surface
 * as a 500. requireOrganization turns that into a clean 400.
 */
router.use(requireOrganization);

/*
 * All authenticated organization users can
 * view career paths and published role options.
 */
router.get(
  "/options/roles",
  roleOptions,
);

router.get(
  "/",
  list,
);

router.get(
  "/:id",
  getOne,
);

/*
 * Only Organization Admins can create,
 * edit or delete career paths.
 */
router.post(
  "/",
  authorize(
    UserRole.ORGANIZATION_ADMIN,
  ),
  create,
);

router.put(
  "/:id",
  authorize(
    UserRole.ORGANIZATION_ADMIN,
  ),
  update,
);

router.delete(
  "/:id",
  authorize(
    UserRole.ORGANIZATION_ADMIN,
  ),
  remove,
);

export default router;