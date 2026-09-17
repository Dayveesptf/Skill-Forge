import { Router } from "express";
import { z } from "zod";
import { authenticate, authorize, requireOrganization } from "../../middleware/auth";
import { UserRole } from "../../constants/roles";
import { accept, create, list, revoke } from "./invitation.controller";

const router = Router();

const createSchema = z.object({
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.enum([
    UserRole.ORGANIZATION_ADMIN,
    UserRole.MANAGER,
    UserRole.STAFF
  ]),
  managerId: z.string().optional()
});

const acceptSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(8)
});

router.post("/accept", (req, _res, next) => {
  try { acceptSchema.parse(req.body); next(); } catch (e) { next(e); }
}, accept);

router.use(
  authenticate,
  requireOrganization,
  authorize(UserRole.ORGANIZATION_ADMIN)
);

router.get("/", list);

router.post("/", (req, _res, next) => {
  try { createSchema.parse(req.body); next(); } catch (e) { next(e); }
}, create);

router.delete("/:id", revoke);

export default router;
