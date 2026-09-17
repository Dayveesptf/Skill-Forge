import { Router } from "express";
import { z } from "zod";
import { authenticate, authorize } from "../../middleware/auth";
import { UserRole } from "../../constants/roles";
import { create, getOne, list, stats, update } from "./organization.controller";

const router = Router();

const createSchema = z.object({
  name: z.string().min(2),
  industry: z.string().optional(),
  plan: z.string().optional(),
  seatLimit: z.number().int().positive().optional()
});

router.post(
  "/",
  authenticate,
  authorize(UserRole.PLATFORM_ADMIN),
  (req, _res, next) => {
    try { createSchema.parse(req.body); next(); } catch (e) { next(e); }
  },
  create
);

router.get(
  "/",
  authenticate,
  authorize(UserRole.PLATFORM_ADMIN),
  list
);

router.get(
  "/me",
  authenticate,
  authorize(UserRole.ORGANIZATION_ADMIN, UserRole.MANAGER, UserRole.STAFF),
  getOne
);

router.get(
  "/me/stats",
  authenticate,
  authorize(UserRole.ORGANIZATION_ADMIN),
  stats
);

router.patch(
  "/me",
  authenticate,
  authorize(UserRole.ORGANIZATION_ADMIN),
  update
);

router.get(
  "/:id",
  authenticate,
  authorize(UserRole.PLATFORM_ADMIN),
  getOne
);

router.get(
  "/:id/stats",
  authenticate,
  authorize(UserRole.PLATFORM_ADMIN),
  stats
);

router.patch(
  "/:id",
  authenticate,
  authorize(UserRole.PLATFORM_ADMIN),
  update
);

export default router;
