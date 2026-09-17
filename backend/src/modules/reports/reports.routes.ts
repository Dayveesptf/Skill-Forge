import { Router } from "express";

import {
  candidateRoleReport,
  candidateOverview,
  candidateCsv,
  organizationAnalytics,
  organizationCsv
} from "./reports.controller";

import {
  authenticate
} from "../../middleware/auth";

const router = Router();

router.use(authenticate);

/* -------------------------------------------------------------------------- */
/* Candidate Reports                                                          */
/* -------------------------------------------------------------------------- */

router.get(
  "/candidates/:candidateId/role-profiles/:roleProfileId",
  candidateRoleReport
);

router.get(
  "/candidates/:candidateId/overview",
  candidateOverview
);

router.get(
  "/candidates/:candidateId/role-profiles/:roleProfileId/export.csv",
  candidateCsv
);

/* -------------------------------------------------------------------------- */
/* Organization Reports                                                       */
/* -------------------------------------------------------------------------- */

router.get(
  "/organization/analytics",
  organizationAnalytics
);

router.get(
  "/organization/export.csv",
  organizationCsv
);

export default router;