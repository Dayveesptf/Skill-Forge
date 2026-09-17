import { NextFunction, Request, Response } from "express";
import { UserRole } from "../constants/roles";
import { verifyAccessToken } from "../utils/jwt";

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    role: UserRole;
    organizationId?: string;
  };
}

export function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const header = req.headers.authorization;

    if (!header?.startsWith("Bearer ")) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    req.user = verifyAccessToken(header.slice(7));
    next();
  } catch {
    res.status(401).json({ success: false, message: "Invalid or expired access token" });
  }
}

export function authorize(...roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ success: false, message: "Insufficient permissions" });
      return;
    }

    next();
  };
}

export function requireOrganization(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user?.organizationId) {
    res.status(400).json({
      success: false,
      message: "This account is not associated with an organization"
    });
    return;
  }
  next();
}
