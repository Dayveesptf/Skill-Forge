import { Types } from "mongoose";

import { AuthenticatedRequest } from "../../middleware/auth";
import { UserRole } from "../../constants/roles";
import { User } from "../../models/User";

export async function canAccessCandidate(
  req: AuthenticatedRequest,
  candidateId: string
): Promise<boolean> {
  if (!req.user) {
    return false;
  }

  if (!Types.ObjectId.isValid(candidateId)) {
    return false;
  }

  // Platform administrators can access candidates
  // across organizations.
  if (req.user.role === UserRole.PLATFORM_ADMIN) {
    return true;
  }

  // Organization administrators can access
  // active candidates in their organization.
  if (req.user.role === UserRole.ORGANIZATION_ADMIN) {
    if (!req.user.organizationId) {
      return false;
    }

    const candidate = await User.findOne({
      _id: candidateId,
      organizationId: req.user.organizationId,
      isActive: true,
    })
      .select("_id")
      .lean()
      .exec();

    return !!candidate;
  }

  // Staff can only access themselves.
  if (req.user.role === UserRole.STAFF) {
    return req.user.userId === candidateId;
  }

  // Managers can access only active STAFF members
  // assigned directly to them.
  if (req.user.role === UserRole.MANAGER) {
    if (!req.user.organizationId) {
      return false;
    }

    const candidate = await User.findOne({
      _id: candidateId,
      organizationId: req.user.organizationId,
      managerId: req.user.userId,
      role: UserRole.STAFF,
      isActive: true,
    })
      .select("_id")
      .lean()
      .exec();

    return !!candidate;
  }

  return false;
}

/*
 * Write access is deliberately narrower than canAccessCandidate above:
 * only the candidate themself may modify their own self-assessment data
 * (responses, evidence). Managers, org admins and platform admins can
 * all *view* a candidate's data via canAccessCandidate, but none of
 * them can edit it on the candidate's behalf.
 */
export function canModifyCandidate(
  req: AuthenticatedRequest,
  candidateId: string
): boolean {
  if (!req.user) {
    return false;
  }

  return (
    req.user.role === UserRole.STAFF &&
    req.user.userId === candidateId
  );
}