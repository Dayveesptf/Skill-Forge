import { Router } from "express";

import {
  authenticate,
  authorize,
} from "../../middleware/auth";

import { UserRole } from "../../constants/roles";

import {
  create,
  list,
  update,
  remove,
  recommendationsForGapAnalysis,
} from "../../modules/learningResource/learningResource.controller";

const router = Router();

router.use(authenticate);

/* -------------------------------------------------------------------------- */
/* Browse resources                                                           */
/* -------------------------------------------------------------------------- */

router.get(
  "/",
  list,
);

/* -------------------------------------------------------------------------- */
/* Gap recommendations                                                        */
/* -------------------------------------------------------------------------- */

router.get(
  "/recommendations/:gapAnalysisId",
  recommendationsForGapAnalysis,
);

/* -------------------------------------------------------------------------- */
/* Admin management                                                           */
/* -------------------------------------------------------------------------- */

router.post(
  "/",
  authorize(
    UserRole.ORGANIZATION_ADMIN,
    UserRole.PLATFORM_ADMIN,
  ),
  create,
);

router.patch(
  "/:id",
  authorize(
    UserRole.ORGANIZATION_ADMIN,
    UserRole.PLATFORM_ADMIN,
  ),
  update,
);

router.delete(
  "/:id",
  authorize(
    UserRole.ORGANIZATION_ADMIN,
    UserRole.PLATFORM_ADMIN,
  ),
  remove,
);

export default router;