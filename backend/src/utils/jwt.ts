import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { UserRole } from "../constants/roles";

export interface JwtPayload {
  userId: string;
  role: UserRole;
  organizationId?: string;
}

export function createAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.jwtAccessSecret, {
    expiresIn: env.accessTokenExpiresIn as jwt.SignOptions["expiresIn"]
  });
}

export function createRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.jwtRefreshSecret, {
    expiresIn: env.refreshTokenExpiresIn as jwt.SignOptions["expiresIn"]
  });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwtAccessSecret) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwtRefreshSecret) as JwtPayload;
}
