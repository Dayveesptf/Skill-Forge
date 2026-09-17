import "dotenv/config";
import mongoose from "mongoose";

import { env } from "../config/env";
import { User } from "../models/User";
import { Organization } from "../models/Organization";
import { FrameworkVersion } from "../models/FrameworkVersion";
import { Skill } from "../models/Skill";
import { SkillLevel } from "../models/SkillLevel";
import { BehaviouralFactor } from "../models/BehaviouralFactor";
import { EvidencePrompt } from "../models/EvidencePrompt";
import { RoleProfile } from "../models/RoleProfile";
import { LearningResource } from "../models/LearningResource";
import { CareerPath } from "../models/CareerPath";
import { Assessment } from "../models/Assessment";
import { AssessmentSection } from "../models/AssessmentSection";
import { AssessmentQuestion } from "../models/AssessmentQuestion";
import { AssessmentAssignment } from "../models/AssessmentAssignment";
import { AssessmentAttempt } from "../models/AssessmentAttempt";
import { AssessmentResponse } from "../models/AssessmentResponse";
import { AssessmentEvaluation } from "../models/AssessmentEvaluation";
import { SelfAssessmentCampaign } from "../models/SelfAssessmentCampaign";
import { SelfAssessment } from "../models/SelfAssessment";
import { SelfAssessmentResponse } from "../models/SelfAssessmentResponse";
import { ManagerCorroboration } from "../models/ManagerCorroboration";
import { Notification } from "../models/Notification";
import { IndustryTemplate } from "../models/IndustryTemplate";
import { GapAnalysis } from "../models/GapAnalysis";
import { SelfAssessmentResult } from "../models/selfAssessmentResult.model";

const ORG_SLUG = process.env.SEED_ORG_SLUG || "demo-org";
const MANAGER_EMAIL = process.env.SEED_MANAGER_EMAIL || "manager@skillforge.test";

async function main() {
  await mongoose.connect(env.mongodbUri);

  try {
    const organization = await Organization.findOne({ slug: ORG_SLUG });

    if (!organization) {
      console.log(`No organization with slug "${ORG_SLUG}" found. Nothing to reset.`);
      return;
    }

    const orgId = organization._id;

    const frameworks = await FrameworkVersion.find({ organizationId: orgId }).select("_id");
    const frameworkIds = frameworks.map((item) => item._id);
    const skills = await Skill.find({ frameworkVersionId: { $in: frameworkIds } }).select("_id");
    const skillIds = skills.map((item) => item._id);
    const factors = await BehaviouralFactor.find({ frameworkVersionId: { $in: frameworkIds } }).select("_id");
    const factorIds = factors.map((item) => item._id);
    const profiles = await RoleProfile.find({ organizationId: orgId }).select("_id");
    const profileIds = profiles.map((item) => item._id);
    const assessments = await Assessment.find({ organizationId: orgId }).select("_id");
    const assessmentIds = assessments.map((item) => item._id);

    const selfAssessments = await SelfAssessment.find({ organizationId: orgId }).select("_id");
    const selfAssessmentIds = selfAssessments.map((item) => item._id);

    const deleteResults = await Promise.all([
      AssessmentResponse.deleteMany({ organizationId: orgId }),
      AssessmentEvaluation.deleteMany({ organizationId: orgId }),
      AssessmentAttempt.deleteMany({ organizationId: orgId }),
      AssessmentAssignment.deleteMany({ organizationId: orgId }),
      AssessmentQuestion.deleteMany({ assessmentId: { $in: assessmentIds } }),
      AssessmentSection.deleteMany({ assessmentId: { $in: assessmentIds } }),
      Assessment.deleteMany({ organizationId: orgId }),
      SelfAssessmentResult.deleteMany({ organizationId: orgId }),
      ManagerCorroboration.deleteMany({ selfAssessmentId: { $in: selfAssessmentIds } }),
      SelfAssessmentResponse.deleteMany({ organizationId: orgId }),
      SelfAssessment.deleteMany({ organizationId: orgId }),
      SelfAssessmentCampaign.deleteMany({ organizationId: orgId }),
      GapAnalysis.deleteMany({ organizationId: orgId }),
      LearningResource.deleteMany({ organizationId: orgId }),
      CareerPath.deleteMany({ organizationId: orgId }),
      EvidencePrompt.deleteMany({ organizationId: orgId }),
      SkillLevel.deleteMany({ frameworkVersionId: { $in: frameworkIds } }),
      Skill.deleteMany({ frameworkVersionId: { $in: frameworkIds } }),
      BehaviouralFactor.deleteMany({ frameworkVersionId: { $in: frameworkIds } }),
      RoleProfile.deleteMany({ organizationId: orgId }),
      IndustryTemplate.deleteMany({ slug: "technology-engineering" }),
      Notification.deleteMany({ organizationId: orgId }),
      FrameworkVersion.deleteMany({ organizationId: orgId }),
    ]);

    await User.updateMany(
      { organizationId: orgId, role: { $in: ["STAFF", "MANAGER"] } },
      { $unset: { managerId: "" } },
    );

    await User.deleteOne({ email: MANAGER_EMAIL.toLowerCase(), role: "MANAGER" });

    await Organization.collection.updateOne(
      { _id: orgId },
      {
        $unset: {
          frameworkVersionId: "",
          skillLibrary: "",
        },
      },
    );

    const total = deleteResults.reduce((sum, result) => sum + result.deletedCount, 0);
    console.log(`✓ Removed ${total} demo-content documents from ${organization.name}`);
    console.log(`✓ Removed seeded manager ${MANAGER_EMAIL}`);
    console.log("Base organization/admin/staff accounts were preserved.");
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error("Reset failed:", error);
  process.exitCode = 1;
});
