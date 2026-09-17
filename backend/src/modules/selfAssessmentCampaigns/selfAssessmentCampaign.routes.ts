import { Router } from "express";

import {
  authenticate,
  authorize,
  requireOrganization
} from "../../middleware/auth";

import {
  UserRole
} from "../../constants/roles";

import {
  create,
  list,
  get,
  launch,
  cancel
} from "./selfAssessmentCampaign.controller";

const router =
  Router();

/*
 * Campaign management belongs to the
 * Organization Admin workflow shown in
 * the requirements.
 */
router.use(
  authenticate,
  requireOrganization,
  authorize(
    UserRole.ORGANIZATION_ADMIN
  )
);

router.post(
  "/",
  create
);

router.get(
  "/",
  list
);

router.get(
  "/:id",
  get
);

router.post(
  "/:id/launch",
  launch
);

router.post(
  "/:id/cancel",
  cancel
);

export default router;