import { AuthenticatedRequest } from "../../middleware/auth";
import { UserRole } from "../../constants/roles";

/*
 * Determines whether the authenticated user can view
 * a candidate's self-assessment (and, by extension, its
 * responses and evidence attachments).
 *
 * This is deliberately broader than modification access.
 *
 * Platform Admin and Organization Admin can access candidate
 * records for administrative purposes.
 *
 * STAFF can only access their own.
 *
 * Manager access is handled by the manager corroboration
 * workflow rather than given unrestricted access here.
 */
export function canAccessCandidateAssessment(
  req: AuthenticatedRequest,
  candidateId: string
): boolean {
  if (!req.user) {
    return false;
  }

  if (
    req.user.role === UserRole.PLATFORM_ADMIN ||
    req.user.role === UserRole.ORGANIZATION_ADMIN
  ) {
    return true;
  }

  return (
    req.user.role === UserRole.STAFF &&
    req.user.userId === candidateId
  );
}

/*
 * Determines whether the authenticated user can modify
 * a self-assessment (its responses, or the evidence
 * attached to those responses).
 *
 * Only STAFF can modify their own self-assessment.
 *
 * Managers and administrators must use their own workflows.
 */
export function canModifyCandidateAssessment(
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