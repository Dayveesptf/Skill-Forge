import { Router } from "express";

import { authenticate } from "../../middleware/auth";
import { authorize } from "../../middleware/auth";
import { UserRole } from "../../constants/roles";

import {
  cancelAssignment,
  createAssignment,
  getAssignment,
  listAssignments
} from "./assessmentAssignment.controller";

const router = Router();

router.use(authenticate);

router.post(
  "/",
  authorize(
    UserRole.PLATFORM_ADMIN,
    UserRole.ORGANIZATION_ADMIN
  ),
  createAssignment
);

router.get(
  "/",
  authorize(
    UserRole.PLATFORM_ADMIN,
    UserRole.ORGANIZATION_ADMIN
  ),
  listAssignments
);

router.get(
  "/:id",
  authorize(
    UserRole.PLATFORM_ADMIN,
    UserRole.ORGANIZATION_ADMIN
  ),
  getAssignment
);

router.post(
  "/:id/cancel",
  authorize(
    UserRole.PLATFORM_ADMIN,
    UserRole.ORGANIZATION_ADMIN
  ),
  cancelAssignment
);

export default router;