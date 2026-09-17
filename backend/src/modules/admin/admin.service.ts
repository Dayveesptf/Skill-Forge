import { Types } from "mongoose";
import { User } from "../../models/User";
import { Organization } from "../../models/Organization";
import { Assessment } from "../../models/Assessment";
import { AssessmentAssignment } from "../../models/AssessmentAssignment";
import AssessmentAttempt from "../../models/AssessmentAttempt";
import AssessmentEvaluation from "../../models/AssessmentEvaluation";
import RoleProfile from "../../models/RoleProfile";
import SelfAssessment from "../../models/SelfAssessment";

export async function getPlatformOverview() {
  const [
    organizations,
    users,
    assessments,
    assignments,
    attempts,
    evaluations,
    roleProfiles,
    selfAssessments
  ] = await Promise.all([
    Organization.countDocuments(),
    User.countDocuments(),
    Assessment.countDocuments(),
    AssessmentAssignment.countDocuments(),
    AssessmentAttempt.countDocuments(),
    AssessmentEvaluation.countDocuments(),
    RoleProfile.countDocuments(),
    SelfAssessment.countDocuments()
  ]);

  return {
    organizations,
    users,
    assessments,
    assignments,
    attempts,
    evaluations,
    roleProfiles,
    selfAssessments
  };
}

export async function getOrganizationOverview(
  organizationId: string
) {
  const organizationObjectId =
    new Types.ObjectId(organizationId);

  const [
    users,
    assessments,
    assignments,
    attempts,
    evaluations,
    roleProfiles,
    selfAssessments
  ] = await Promise.all([
    User.countDocuments({
      organizationId: organizationObjectId
    }),

    Assessment.countDocuments({
      organizationId: organizationObjectId
    }),

    AssessmentAssignment.countDocuments({
      organizationId: organizationObjectId
    }),

    AssessmentAttempt.countDocuments({
      organizationId: organizationObjectId
    }),

    AssessmentEvaluation.countDocuments({
      organizationId: organizationObjectId
    }),

    RoleProfile.countDocuments({
      organizationId: organizationObjectId
    }),

    SelfAssessment.countDocuments({
      organizationId: organizationObjectId
    })
  ]);

  return {
    organizationId,
    users,
    assessments,
    assignments,
    attempts,
    evaluations,
    roleProfiles,
    selfAssessments
  };
}

export async function getUserAdministrationList(
  organizationId?: string
) {
  const filter: Record<string, unknown> = {};

  if (organizationId) {
    filter.organizationId =
      new Types.ObjectId(organizationId);
  }

  return User.find(filter)
    .select(
      "-password -refreshToken -refreshTokens"
    )
    .sort({ createdAt: -1 })
    .limit(500);
}

export async function setUserActiveStatus(
  userId: string,
  isActive: boolean,
  organizationId?: string
) {
  const filter: Record<string, unknown> = {
    _id: new Types.ObjectId(userId)
  };

  if (organizationId) {
    filter.organizationId =
      new Types.ObjectId(organizationId);
  }

  const user = await User.findOneAndUpdate(
    filter,
    {
      $set: {
        isActive
      }
    },
    {
      new: true
    }
  ).select(
    "-password -refreshToken -refreshTokens"
  );

  if (!user) {
    throw new Error("User not found");
  }

  return user;
}