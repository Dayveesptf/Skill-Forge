import { Request, Response } from "express";

import {
  getCurrentUser,
  loginUser,
  logoutUser,
  refreshUserSession,
  registerUser,
} from "./auth.service";

import { AuthenticatedRequest } from "../../middleware/auth";
import { env } from "../../config/env";

const cookieOptions = {
  httpOnly: true,
  secure: env.nodeEnv === "production",
  sameSite: (env.nodeEnv === "production" ? "none" : "lax") as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/api/auth",
};

export async function register(
  req: Request,
  res: Response,
) {
  try {
    const user = await registerUser(req.body);

    /*
     * Automatically create an authenticated session
     * after successful registration.
     */
    const result = await loginUser(
      req.body.email,
      req.body.password,
    );

    if ("mfaRequired" in result && result.mfaRequired) {
      res.status(201).json({ success: true, data: { mfaRequired: true, mfaChallengeToken: result.mfaChallengeToken } });
      return;
    }

    res.cookie(
      "refreshToken",
      result.refreshToken!,
      cookieOptions,
    );

    res.status(201).json({
      success: true,
      data: {
        user,
        accessToken: result.accessToken,
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Registration failed";

    res.status(400).json({
      success: false,
      message,
    });
  }
}

export async function login(
  req: Request,
  res: Response,
) {
  try {
    const result = await loginUser(
      req.body.email,
      req.body.password,
    );

    if ("mfaRequired" in result && result.mfaRequired) {
      res.json({
        success: true,
        data: {
          mfaRequired: true,
          mfaChallengeToken: result.mfaChallengeToken,
        },
      });
      return;
    }

    res.cookie(
      "refreshToken",
      result.refreshToken,
      cookieOptions,
    );

    res.json({
      success: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Login failed";

    res.status(401).json({
      success: false,
      message,
    });
  }
}

export async function refresh(
  req: Request,
  res: Response,
) {
  try {
    const token = req.cookies?.refreshToken;

    if (!token) {
      res.status(401).json({
        success: false,
        message: "Refresh session required",
      });
      return;
    }

    const result =
      await refreshUserSession(token);

    res.cookie(
      "refreshToken",
      result.refreshToken,
      cookieOptions,
    );

    res.json({
      success: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Invalid refresh session";

    res.clearCookie("refreshToken", {
      path: "/api/auth",
    });

    res.status(401).json({
      success: false,
      message,
    });
  }
}

export async function logout(
  req: AuthenticatedRequest,
  res: Response,
) {
  if (req.user) {
    await logoutUser(req.user.userId);
  }

  res.clearCookie("refreshToken", {
    path: "/api/auth",
  });

  res.json({
    success: true,
    message: "Logged out successfully",
  });
}

export async function me(
  req: AuthenticatedRequest,
  res: Response,
) {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: "Authentication required",
    });
    return;
  }

  const user = await getCurrentUser(
    req.user.userId,
  );

  if (!user) {
    res.status(404).json({
      success: false,
      message: "User not found",
    });
    return;
  }

  res.json({
    success: true,
    data: user,
  });
}