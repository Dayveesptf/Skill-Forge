/**
 * NOTE — this is one of TWO assessment systems in this codebase.
 * See /docs/ARCHITECTURE.md#dual-assessment-systems before touching
 * this file. In short: this is the employee self-rating flow —
 * staff self-report a competency level with optional evidence,
 * which a manager can corroborate (see ../modules/managerCorroboration).
 * The separate objective "quiz" engine lives in ../models/Assessment.ts.
 * Reporting/gap-analysis intentionally compares the two
 * (selfAssessmentLevel vs. objectiveLevel) — this is not duplication.
 */
import mongoose, {
  Document,
  Schema,
  Types
} from "mongoose";

export enum SelfAssessmentStatus {
  DRAFT = "DRAFT",
  IN_PROGRESS = "IN_PROGRESS",
  SUBMITTED = "SUBMITTED"
}

export interface ISelfAssessment
  extends Document {
  organizationId?: Types.ObjectId;

  candidateId: Types.ObjectId;

  roleProfileId: Types.ObjectId;

  frameworkVersionId: Types.ObjectId;

  campaignId?: Types.ObjectId;

  dueAt?: Date;

  corroborationRequired: boolean;

  status: SelfAssessmentStatus;

  startedAt?: Date;

  submittedAt?: Date;

  createdAt: Date;

  updatedAt: Date;
}

const SelfAssessmentSchema =
  new Schema<ISelfAssessment>(
    {
      organizationId: {
        type: Schema.Types.ObjectId,
        ref: "Organization",
        index: true
      },

      candidateId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
      },

      roleProfileId: {
        type: Schema.Types.ObjectId,
        ref: "RoleProfile",
        required: true,
        index: true
      },

      frameworkVersionId: {
        type: Schema.Types.ObjectId,
        ref: "FrameworkVersion",
        required: true,
        index: true
      },

      campaignId: {
        type: Schema.Types.ObjectId,
        ref: "SelfAssessmentCampaign",
        index: true
      },

      dueAt: {
        type: Date
      },

      corroborationRequired: {
        type: Boolean,
        default: false,
        required: true
      },

      status: {
        type: String,
        enum: Object.values(
          SelfAssessmentStatus
        ),
        default:
          SelfAssessmentStatus.DRAFT,
        required: true,
        index: true
      },

      startedAt: {
        type: Date
      },

      submittedAt: {
        type: Date
      }
    },
    {
      timestamps: true
    }
  );

/*
 * A candidate should normally have one active/submitted
 * self-assessment for a particular role profile.
 */
SelfAssessmentSchema.index({
  candidateId: 1,
  roleProfileId: 1
});

SelfAssessmentSchema.index({
  organizationId: 1,
  status: 1,
  createdAt: -1
});

SelfAssessmentSchema.index({
  campaignId: 1,
  candidateId: 1
});

export const SelfAssessment =
  mongoose.model<ISelfAssessment>(
    "SelfAssessment",
    SelfAssessmentSchema
  );

export default SelfAssessment;