import {
  Router,
} from "express";

import {
  authenticate,
  authorize,
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