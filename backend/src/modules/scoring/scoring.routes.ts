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
  evaluateAttempt,
  getEvaluation,
  listEvaluations
} from "./scoring.controller";

const router = Router();

router.use(authenticate);

/*
 * Admin evaluation endpoint.
 */
router.post(
  "/attempts/:attemptId/evaluate",
  authorize(
    UserRole.PLATFORM_ADMIN,
    UserRole.ORGANIZATION_ADMIN
  ),
  evaluateAttempt
);

/*
 * Candidate can retrieve their own evaluation
 * when the assessment allows immediate results.
 *
 * Admins can retrieve any evaluation within
 * their organization.
 */
router.get(
  "/attempts/:attemptId",
  getEvaluation
);

/*
 * Assessment-level evaluation list.
 */
router.get(
  "/assessments/:assessmentId",
  authorize(
    UserRole.PLATFORM_ADMIN,
    UserRole.ORGANIZATION_ADMIN
  ),
  listEvaluations
);

export default router;