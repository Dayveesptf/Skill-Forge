import { Router } from "express";
import ssoRoutes from "./sso.routes";
import { z } from "zod";

import { authenticate } from "../../middleware/auth";

import {
  login,
  logout,
  me,
  refresh,
  register
} from "./auth.controller";

const router = Router();

const registerSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

router.post(
  "/register",
  (req, _res, next) => {
    try {
      registerSchema.parse(
        req.body
      );

      next();
    } catch (error) {
      next(error);
    }
  },
  register
);

router.post(
  "/login",
  (req, _res, next) => {
    try {
      loginSchema.parse(
        req.body
      );

      next();
    } catch (error) {
      next(error);
    }
  },
  login
);

router.post(
  "/refresh",
  refresh
);

router.use("/sso", ssoRoutes);

router.post(
  "/logout",
  authenticate,
  logout
);

router.get(
  "/me",
  authenticate,
  me
);

export default router;