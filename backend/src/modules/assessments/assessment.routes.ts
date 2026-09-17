import { Router } from "express";

import { authenticate } from "../../middleware/auth";

import {
  UserRole
} from "../../constants/roles";

import {
  authorize
} from "../../middleware/auth";

import {
  archive,
  create,
  createAssessmentQuestionHandler,
  createSection,
  deleteQuestion,
  getOne,
  list,
  listQuestions,
  listSections,
  publish,
  update,
  updateQuestion
} from "./assessment.controller";

const router = Router();

router.use(authenticate);

/* =========================================================
   ASSESSMENTS
========================================================= */

router.post(
  "/",
  authorize(
    UserRole.PLATFORM_ADMIN,
    UserRole.ORGANIZATION_ADMIN
  ),
  create
);

router.get(
  "/",
  list
);

router.get(
  "/:id",
  getOne
);

router.patch(
  "/:id",
  authorize(
    UserRole.PLATFORM_ADMIN,
    UserRole.ORGANIZATION_ADMIN
  ),
  update
);

router.post(
  "/:id/publish",
  authorize(
    UserRole.PLATFORM_ADMIN,
    UserRole.ORGANIZATION_ADMIN
  ),
  publish
);

router.post(
  "/:id/archive",
  authorize(
    UserRole.PLATFORM_ADMIN,
    UserRole.ORGANIZATION_ADMIN
  ),
  archive
);

/* =========================================================
   SECTIONS
========================================================= */

router.post(
  "/:id/sections",
  authorize(
    UserRole.PLATFORM_ADMIN,
    UserRole.ORGANIZATION_ADMIN
  ),
  createSection
);

router.get(
  "/:id/sections",
  listSections
);

/* =========================================================
   QUESTIONS
========================================================= */

router.post(
  "/:id/questions",
  authorize(
    UserRole.PLATFORM_ADMIN,
    UserRole.ORGANIZATION_ADMIN
  ),
  createAssessmentQuestionHandler
);

router.get(
  "/:id/questions",
  listQuestions
);

router.patch(
  "/:id/questions/:questionId",
  authorize(
    UserRole.PLATFORM_ADMIN,
    UserRole.ORGANIZATION_ADMIN
  ),
  updateQuestion
);

router.delete(
  "/:id/questions/:questionId",
  authorize(
    UserRole.PLATFORM_ADMIN,
    UserRole.ORGANIZATION_ADMIN
  ),
  deleteQuestion
);

export default router;