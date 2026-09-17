import { Router } from "express";

import {
  authenticate,
  authorize
} from "../../middleware/auth";

import {
  UserRole
} from "../../constants/roles";

import {
  getAssessmentResult,
} from "./assessmentResult.controller";

import {
  create,
  get,
  listMine,
  start,
  saveResponse,
  removeResponse,
  submit,
  corroboration
} from "./selfAssessment.controller";

const router = Router();

/*
 * All self-assessment operations require authentication.
 */
router.use(authenticate);

/*
 * --------------------------------------------------------------------------
 * STAFF SELF-ASSESSMENT CREATION
 * --------------------------------------------------------------------------
 *
 * Only STAFF members can create their own self-assessment.
 *
 * The candidate is taken from req.user.userId in the controller.
 * A client cannot choose another candidate through the request body.
 *
 * POST
 * /api/self-assessments/role-profiles/:roleProfileId
 */
router.post(
  "/role-profiles/:roleProfileId",
  authorize(UserRole.STAFF),
  create
);

/*
 * --------------------------------------------------------------------------
 * SELF-ASSESSMENT LIST
 * --------------------------------------------------------------------------
 *
 * Staff:
 *   - receives their own self-assessments.
 *
 * Platform Admin / Organization Admin:
 *   - can request a candidate's assessments with ?candidateId=<id>.
 *
 * Manager:
 *   - will use the manager corroboration workflow rather than this
 *     staff self-assessment workflow.
 *
 * GET
 * /api/self-assessments
 */
router.get(
  "/",
  listMine
);

router.get(
  "/:id/result",
  getAssessmentResult,
);

/*
 * --------------------------------------------------------------------------
 * SELF-ASSESSMENT DETAIL
 * --------------------------------------------------------------------------
 *
 * Access is checked inside the controller because the permission depends
 * on ownership / administrative access to the candidate.
 *
 * GET
 * /api/self-assessments/:id
 */
router.get(
  "/:id",
  get
);

/*
 * --------------------------------------------------------------------------
 * STAFF START / RESUME
 * --------------------------------------------------------------------------
 *
 * Only the owner of the self-assessment should be able to start/resume it.
 * The controller performs the ownership check.
 *
 * POST
 * /api/self-assessments/:id/start
 */
router.post(
  "/:id/start",
  authorize(UserRole.STAFF),
  start
);

/*
 * --------------------------------------------------------------------------
 * STAFF SAVE RESPONSE
 * --------------------------------------------------------------------------
 *
 * Only STAFF can modify their self-assessment responses.
 *
 * POST
 * /api/self-assessments/:id/responses
 */
router.post(
  "/:id/responses",
  authorize(UserRole.STAFF),
  saveResponse
);

/*
 * --------------------------------------------------------------------------
 * STAFF DELETE RESPONSE
 * --------------------------------------------------------------------------
 *
 * Only STAFF can remove responses from their own self-assessment.
 *
 * DELETE
 * /api/self-assessments/:id/responses/:responseId
 */
router.delete(
  "/:id/responses/:responseId",
  authorize(UserRole.STAFF),
  removeResponse
);

/*
 * --------------------------------------------------------------------------
 * STAFF SUBMIT
 * --------------------------------------------------------------------------
 *
 * Only STAFF can submit their own self-assessment.
 *
 * POST
 * /api/self-assessments/:id/submit
 */
router.post(
  "/:id/submit",
  authorize(UserRole.STAFF),
  submit
);

/*
 * --------------------------------------------------------------------------
 * CORROBORATION RESULT
 * --------------------------------------------------------------------------
 *
 * This is currently the read-only comparison endpoint.
 *
 * Manager corroboration/write functionality will be implemented as a
 * separate manager workflow rather than giving managers permission to
 * modify staff self-assessment responses.
 *
 * GET
 * /api/self-assessments/:id/corroboration
 */
router.get(
  "/:id/corroboration",
  corroboration
);

export default router;