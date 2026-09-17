import { Router } from "express";
import { z } from "zod";

import {
  authenticate,
  authorize,
  requireOrganization
} from "../../middleware/auth";

import { UserRole } from "../../constants/roles";

import {
  create,
  deactivate,
  getOne,
  list,
  listMyTeam,
  update
} from "./user.controller";

const router = Router();

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

const createSchema =
  z.object({
    firstName:
      z.string().min(1),

    lastName:
      z.string().min(1),

    email:
      z.string().email(),

    password:
      z.string().min(8),

    role:
      z.enum([
        UserRole.ORGANIZATION_ADMIN,
        UserRole.MANAGER,
        UserRole.STAFF
      ]),

    managerId:
      z.string().optional(),

    jobTitle:
      z.string().optional(),

    department:
      z.string().optional()
  });

const updateSchema =
  z.object({
    firstName:
      z.string().min(1).optional(),

    lastName:
      z.string().min(1).optional(),

    role:
      z.enum([
        UserRole.ORGANIZATION_ADMIN,
        UserRole.MANAGER,
        UserRole.STAFF
      ]).optional(),

    managerId:
      z.string().nullable().optional(),

    jobTitle:
      z.string().optional(),

    department:
      z.string().optional(),

    isActive:
      z.boolean().optional()
  });

/* -------------------------------------------------------------------------- */
/* Authentication                                                             */
/* -------------------------------------------------------------------------- */

router.use(
  authenticate,
  requireOrganization
);

/* -------------------------------------------------------------------------- */
/* Manager: My Team                                                           */
/* -------------------------------------------------------------------------- */

/**
 * IMPORTANT:
 * This route must appear before "/:id".
 */
router.get(
  "/my-team",
  authorize(UserRole.MANAGER),
  listMyTeam
);

/* -------------------------------------------------------------------------- */
/* Organization Admin: User Management                                        */
/* -------------------------------------------------------------------------- */

router.use(
  authorize(
    UserRole.ORGANIZATION_ADMIN
  )
);

router.get(
  "/",
  list
);

router.get(
  "/:id",
  getOne
);

router.post(
  "/",
  (req, _res, next) => {
    try {
      createSchema.parse(
        req.body
      );

      next();
    } catch (error) {
      next(error);
    }
  },
  create
);

router.patch(
  "/:id",
  (req, _res, next) => {
    try {
      updateSchema.parse(
        req.body
      );

      next();
    } catch (error) {
      next(error);
    }
  },
  update
);

router.delete(
  "/:id",
  deactivate
);

export default router;