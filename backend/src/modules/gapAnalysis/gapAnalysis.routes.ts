import { Router } from "express";

import {
  generate,
  getLatest,
  getById,
  candidateDashboard,
  organizationDashboard
} from "./gapAnalysis.controller";

import { authenticate } from "../../middleware/auth";

const router = Router();

router.use(authenticate);

/*
 * Generate a new gap analysis.
 *
 * Optional body:
 * {
 *   "assessmentEvaluationId": "..."
 * }
 */
router.post(
  "/candidates/:candidateId/role-profiles/:roleProfileId/generate",
  generate
);

/*
 * Get the most recently generated analysis
 * for a candidate + role profile.
 */
router.get(
  "/candidates/:candidateId/role-profiles/:roleProfileId",
  getLatest
);

/*
 * Candidate dashboard.
 */
router.get(
  "/candidates/:candidateId/dashboard",
  candidateDashboard
);

/*
 * Organization/admin dashboard.
 */
router.get(
  "/organization/dashboard",
  organizationDashboard
);

/*
 * Get a specific gap analysis.
 *
 * Keep this after the more specific routes above.
 */
router.get("/:id", getById);

export default router;