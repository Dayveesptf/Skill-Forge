import { Response } from "express";

import { AuthenticatedRequest } from "../../middleware/auth";
import { UserRole } from "../../constants/roles";
import { SelfAssessment, SelfAssessmentStatus } from "../../models/SelfAssessment";
import { SelfAssessmentResult, SelfAssessmentResultStatus } from "../../models/selfAssessmentResult.model";
import { User } from "../../models/User";

function getOrganizationId(req: AuthenticatedRequest): string | undefined {
  return req.user?.organizationId;
}

function isSameId(a?: unknown, b?: unknown): boolean {
  if (!a || !b) return false;
  return String(a) === String(b);
}

export async function getAssessmentResult(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const selfAssessmentId = req.params.id;
    if (!selfAssessmentId) {
      res.status(400).json({ success: false, message: "Self-assessment id is required" });
      return;
    }

    const assessment = await SelfAssessment.findById(selfAssessmentId).lean();
    if (!assessment) {
      res.status(404).json({ success: false, message: "Self-assessment not found" });
      return;
    }

    const organizationId = getOrganizationId(req);

    if (
      organizationId &&
      assessment.organizationId &&
      !isSameId(assessment.organizationId, organizationId)
    ) {
      res.status(404).json({ success: false, message: "Self-assessment not found" });
      return;
    }

    const currentUser = await User.findById(req.user.userId)
      .select("_id role organizationId managerId isActive")
      .lean();

    if (!currentUser || !currentUser.isActive) {
      res.status(401).json({ success: false, message: "User account is inactive or unavailable" });
      return;
    }

    let allowed = false;

    switch (req.user.role) {
      case UserRole.PLATFORM_ADMIN:
        allowed = true;
        break;

      case UserRole.ORGANIZATION_ADMIN:
        allowed = Boolean(
          currentUser.organizationId &&
          assessment.organizationId &&
          isSameId(currentUser.organizationId, assessment.organizationId),
        );
        break;

      case UserRole.STAFF:
        allowed = isSameId(currentUser._id, assessment.candidateId);
        break;

      case UserRole.MANAGER: {
        const candidate = await User.findById(assessment.candidateId)
          .select("_id managerId organizationId")
          .lean();

        allowed = Boolean(
          candidate &&
          isSameId(candidate.managerId, currentUser._id) &&
          (!candidate.organizationId || !currentUser.organizationId ||
            isSameId(candidate.organizationId, currentUser.organizationId)),
        );
        break;
      }

      default:
        allowed = false;
    }

    if (!allowed) {
      res.status(403).json({ success: false, message: "You do not have access to this assessment result" });
      return;
    }

    if (assessment.status !== SelfAssessmentStatus.SUBMITTED) {
      res.status(409).json({
        success: false,
        message: "The self-assessment has not been submitted yet",
      });
      return;
    }

    const result = await SelfAssessmentResult.findOne({
      selfAssessmentId: assessment._id,
      status: SelfAssessmentResultStatus.FINALIZED,
    })
      .populate("roleProfileId", "name title")
      .populate("frameworkVersionId", "name version")
      .lean();

    if (!result) {
      res.status(409).json({
        success: false,
        message: assessment.corroborationRequired
          ? "The assessment is awaiting manager corroboration"
          : "The assessment result is not finalized yet",
      });
      return;
    }

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Could not load assessment result",
    });
  }
}
