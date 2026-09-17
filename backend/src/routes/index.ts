import { Router } from "express";

import healthRoutes from "./health.routes";

import authRoutes from "../modules/auth/auth.routes";

import organizationRoutes from "../modules/organizations/organization.routes";

import userRoutes from "../modules/users/user.routes";

import invitationRoutes from "../modules/invitations/invitation.routes";

import frameworkRoutes from "../modules/framework/framework.routes";

import assessmentRoutes from "../modules/assessments/assessment.routes";

import assessmentAttemptRoutes from "../modules/assessmentAttempts/assessmentAttempt.routes";

import assessmentAssignmentRoutes from "../modules/assessmentAttempts/assessmentAssignment.routes";

import userImportRoutes from "../modules/imports/userImport.routes";

import scoringRoutes from "../modules/scoring/scoring.routes";

import roleProfileRoutes from "../modules/roleProfiles/roleProfile.routes";

import aiRoutes from "../modules/ai/ai.routes";

import selfAssessmentRoutes from "../modules/selfAssessments/selfAssessment.routes";

import managerCorroborationRoutes from "../modules/managerCorroboration/managerCorroboration.routes";

import selfAssessmentCampaignRoutes from "../modules/selfAssessmentCampaigns/selfAssessmentCampaign.routes";

import gapAnalysisRoutes from "../modules/gapAnalysis/gapAnalysis.routes";

import reportsRoutes from "../modules/reports/reports.routes";

import notificationRoutes from "../modules/notifications/notification.routes";

import adminRoutes from "../modules/admin/admin.routes";

import auditRoutes from "../modules/audit/audit.routes";

import careerPathRoutes from "../modules/careerPaths/careerPath.routes";

import evidenceRoutes from "../modules/evidence/evidence.routes";

import learningResourceRoutes from "../modules/learningResource/learningResource.routes";
import infrastructureRoutes from "../modules/infrastructure/infrastructure.routes";

const router = Router();

router.use(
  "/health",
  healthRoutes
);

router.use(
  "/auth",
  authRoutes
);

router.use(
  "/organizations",
  organizationRoutes
);

router.use(
  "/users",
  userRoutes
);

router.use(
  "/invitations",
  invitationRoutes
);

router.use(
  "/frameworks",
  frameworkRoutes
);

router.use(
  "/assessments",
  assessmentRoutes
);

/*
 * Assessment assignment management.
 *
 * Organization/platform admins can create, view
 * and cancel assignments for the quiz-based
 * assessment engine.
 */
router.use(
  "/assessment-assignments",
  assessmentAssignmentRoutes
);

/*
 * Candidate assessment attempts.
 *
 * Handles starting an assigned assessment,
 * receiving the safe question delivery,
 * saving responses and submitting attempts.
 */
router.use(
  "/assessment-attempts",
  assessmentAttemptRoutes
);

/*
 * Bulk organization user import.
 *
 * Organization admins can import staff/managers
 * into their organization.
 */
router.use(
  "/user-imports",
  userImportRoutes
);

router.use(
  "/scoring",
  scoringRoutes
);

router.use(
  "/role-profiles",
  roleProfileRoutes
);

router.use(
  "/career-paths",
  careerPathRoutes
);

router.use(
  "/ai",
  aiRoutes
);

router.use(
  "/self-assessments",
  selfAssessmentRoutes
);

router.use(
  "/manager-corroborations",
  managerCorroborationRoutes
);

router.use(
  "/self-assessment-campaigns",
  selfAssessmentCampaignRoutes
);

router.use(
  "/gap-analysis",
  gapAnalysisRoutes
);

router.use(
  "/reports",
  reportsRoutes
);

router.use(
  "/notifications",
  notificationRoutes
);

router.use(
  "/admin",
  adminRoutes
);

router.use(
  "/audit",
  auditRoutes
);

/*
 * Evidence attachments for self-assessment responses.
 *
 * Presigned upload/download URLs for files supporting a
 * claimed competency level.
 */
router.use(
  "/evidence",
  evidenceRoutes
);

/*
 * Learning resource library + gap-based recommendations.
 */
router.use(
  "/learning-resources",
  learningResourceRoutes
);

router.use(
  "/infrastructure",
  infrastructureRoutes
);

export default router;