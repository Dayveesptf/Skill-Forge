import { Router } from "express";

import { authenticate } from "../../middleware/auth";

import {
  getAttempt,
  getDelivery,
  getResponses,
  saveResponse,
  startAttempt,
  submitAttempt
} from "./assessmentAttempt.controller";

const router = Router();

router.use(authenticate);

/*
 * Candidate starts an assigned assessment.
 */
router.post(
  "/assignments/:assignmentId/start",
  startAttempt
);

/*
 * Candidate gets the current attempt metadata.
 */
router.get(
  "/:id",
  getAttempt
);

/*
 * Candidate gets the actual assessment questions.
 *
 * Correct answers, scores and skill mappings
 * are deliberately excluded by the delivery service.
 */
router.get(
  "/:id/delivery",
  getDelivery
);

/*
 * Candidate saves/updates an answer.
 */
router.put(
  "/:id/questions/:questionId/response",
  saveResponse
);

/*
 * Candidate retrieves their saved responses.
 */
router.get(
  "/:id/responses",
  getResponses
);

/*
 * Candidate submits the attempt.
 */
router.post(
  "/:id/submit",
  submitAttempt
);

export default router;