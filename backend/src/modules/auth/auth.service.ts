import bcrypt from "bcryptjs";

import { User } from "../../models/User";
import {
  createAccessToken,
  createRefreshToken,
  verifyRefreshToken
} from "../../utils/jwt";

import { sha256 } from "../../utils/security";

import { UserRole } from "../../constants/roles";
import { MfaCredential } from "../infrastructure/infrastructure.models";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";

export async function registerUser(data: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  organizationId?: string;
}) {
  const email =
    data.email.toLowerCase().trim();

  const existing =
    await User.findOne({ email });

  if (existing) {
    throw new Error(
      "A user with this email already exists"
    );
  }

  const passwordHash =
    await bcrypt.hash(
      data.password,
      12
    );

  const user = await User.create({
    firstName: data.firstName,
    lastName: data.lastName,
    email,
    passwordHash,

    /*
     * Public registration can only create
     * a STAFF account.
     *
     * Organization admins/managers should be
     * created through the controlled organization
     * onboarding/invitation flows.
     */
    role: UserRole.STAFF,

    organizationId:
      data.organizationId
  });

  return sanitizeUser(user);
}

export async function loginUser(
  emailInput: string,
  password: string
) {
  const email =
    emailInput.toLowerCase().trim();

  const user =
    await User.findOne({ email })
      .select(
        "+passwordHash " +
        "+refreshTokenHash " +
        "+refreshTokenExpiresAt"
      );

  if (!user) {
    throw new Error(
      "Invalid email or password"
    );
  }

  if (!user.isActive) {
    throw new Error(
      "This account has been deactivated"
    );
  }

  const passwordMatches =
    await bcrypt.compare(
      password,
      user.passwordHash
    );

  if (!passwordMatches) {
    throw new Error(
      "Invalid email or password"
    );
  }

  const mfa = await MfaCredential.findOne({ userId: user._id }).select("enabled");
  if (mfa?.enabled) {
    return {
      mfaRequired: true as const,
      mfaChallengeToken: jwt.sign({ userId: user._id.toString(), purpose: "MFA_LOGIN" }, env.jwtAccessSecret, { expiresIn: "5m" }),
      user: sanitizeUser(user),
      accessToken: undefined,
      refreshToken: undefined
    };
  }

  const payload = {
    userId: user._id.toString(),

    role: user.role,

    organizationId:
      user.organizationId?.toString()
  };

  const accessToken =
    createAccessToken(payload);

  const refreshToken =
    createRefreshToken(payload);

  user.refreshTokenHash =
    sha256(refreshToken);

  user.refreshTokenExpiresAt =
    new Date(
      Date.now() +
        7 *
          24 *
          60 *
          60 *
          1000
    );

  user.lastLoginAt =
    new Date();

  await user.save();

  return {
    user: sanitizeUser(user),

    accessToken,

    refreshToken
  };
}

export async function refreshUserSession(
  refreshToken: string
) {
  const payload =
    verifyRefreshToken(
      refreshToken
    );

  const user =
    await User.findById(
      payload.userId
    ).select(
      "+refreshTokenHash " +
      "+refreshTokenExpiresAt"
    );

  if (
    !user ||
    !user.isActive
  ) {
    throw new Error(
      "Invalid refresh session"
    );
  }

  if (
    !user.refreshTokenHash ||
    user.refreshTokenHash !==
      sha256(refreshToken)
  ) {
    throw new Error(
      "Invalid refresh session"
    );
  }

  if (
    !user.refreshTokenExpiresAt ||
    user.refreshTokenExpiresAt <
      new Date()
  ) {
    throw new Error(
      "Refresh session has expired"
    );
  }

  const newPayload = {
    userId:
      user._id.toString(),

    role:
      user.role,

    organizationId:
      user.organizationId?.toString()
  };

  const accessToken =
    createAccessToken(
      newPayload
    );

  const newRefreshToken =
    createRefreshToken(
      newPayload
    );

  user.refreshTokenHash =
    sha256(newRefreshToken);

  user.refreshTokenExpiresAt =
    new Date(
      Date.now() +
        7 *
          24 *
          60 *
          60 *
          1000
    );

  await user.save();

  return {
    user: sanitizeUser(user),

    accessToken,

    refreshToken:
      newRefreshToken
  };
}

export async function logoutUser(
  userId: string
) {
  await User.findByIdAndUpdate(
    userId,
    {
      $unset: {
        refreshTokenHash: 1,
        refreshTokenExpiresAt: 1
      }
    }
  );
}

export async function getCurrentUser(
  userId: string
) {
  return User.findById(
    userId
  ).select(
    "-passwordHash " +
    "-refreshTokenHash " +
    "-refreshTokenExpiresAt"
  );
}

export function sanitizeUser(
  user: any
) {
  return {
    id: user._id,

    firstName:
      user.firstName,

    lastName:
      user.lastName,

    email:
      user.email,

    role:
      user.role,

    organizationId:
      user.organizationId,

    managerId:
      user.managerId,

    jobTitle:
      user.jobTitle,

    department:
      user.department,

    isActive:
      user.isActive,

    lastLoginAt:
      user.lastLoginAt,

    createdAt:
      user.createdAt
  };
}