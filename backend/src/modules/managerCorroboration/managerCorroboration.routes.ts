import { Router } from "express";

import { UserRole } from "../../constants/roles";
import { authenticate, authorize } from "../../middleware/auth";

import {
  getPendingCorroborations,
  getMyCorroborations,
  getCorroboration,
  reviewCorroboration,
} from "./managerCorroboration.controller";

const router = Router();

router.use(authenticate);

router.use(
  authorize(UserRole.MANAGER)
);

router.get(
  "/pending",
  getPendingCorroborations
);

router.get(
  "/mine",
  getMyCorroborations
);

router.get(
  "/:id",
  getCorroboration
);

router.post(
  "/:id/review",
  reviewCorroboration
);

export default router;