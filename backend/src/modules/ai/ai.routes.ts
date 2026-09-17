import { Router } from "express";

import {
  authenticate
} from "../../middleware/auth";

import {
  authorize
} from "../../middleware/auth";

import {
  UserRole
} from "../../constants/roles";

import {
  generateRoleMapping,
  generateQuestions,
  getGeneration,
  getGenerations,
  reviewGeneration
} from "./ai.controller";

const router =
  Router();

router.use(
  authenticate
);

/* -------------------------------------------------------------------------- */
/* AI Role Skill Mapping                                                      */
/* -------------------------------------------------------------------------- */

router.post(
  "/role-profiles/:roleProfileId/skill-mapping",
  authorize(
    UserRole.PLATFORM_ADMIN,
    UserRole.ORGANIZATION_ADMIN
  ),
  generateRoleMapping
);

/* -------------------------------------------------------------------------- */
/* AI Interview Questions                                                     */
/* -------------------------------------------------------------------------- */

router.post(
  "/assessments/:assessmentId/interview-questions",
  authorize(
    UserRole.PLATFORM_ADMIN,
    UserRole.ORGANIZATION_ADMIN
  ),
  generateQuestions
);

/* -------------------------------------------------------------------------- */
/* AI Generations                                                             */
/* -------------------------------------------------------------------------- */

router.get(
  "/generations",
  authorize(
    UserRole.PLATFORM_ADMIN,
    UserRole.ORGANIZATION_ADMIN
  ),
  getGenerations
);

router.get(
  "/generations/:id",
  authorize(
    UserRole.PLATFORM_ADMIN,
    UserRole.ORGANIZATION_ADMIN
  ),
  getGeneration
);

/* -------------------------------------------------------------------------- */
/* Human Review                                                               */
/* -------------------------------------------------------------------------- */

router.post(
  "/generations/:id/review",
  authorize(
    UserRole.PLATFORM_ADMIN,
    UserRole.ORGANIZATION_ADMIN
  ),
  reviewGeneration
);

export default router;