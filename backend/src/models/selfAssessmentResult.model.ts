import mongoose, {
  Document,
  Schema,
  Types,
} from "mongoose";

export enum SelfAssessmentResultStatus {
  FINALIZED = "FINALIZED",
}

export enum SelfAssessmentResultCompetencyType {
  SKILL = "SKILL",
  BEHAVIOURAL_FACTOR = "BEHAVIOURAL_FACTOR",
}

export interface ISelfAssessmentResultItem {
  responseId: Types.ObjectId;

  competencyType:
    | SelfAssessmentResultCompetencyType.SKILL
    | SelfAssessmentResultCompetencyType.BEHAVIOURAL_FACTOR;

  competencyId: Types.ObjectId;

  selfAssessmentLevel: number;

  assessedLevel: number;

  targetLevel: number;

  gap: number;
}

export interface ISelfAssessmentResult
  extends Document {
  organizationId?: Types.ObjectId;

  selfAssessmentId: Types.ObjectId;

  candidateId: Types.ObjectId;

  roleProfileId: Types.ObjectId;

  frameworkVersionId: Types.ObjectId;

  status: SelfAssessmentResultStatus;

  assessedAt: Date;

  items: ISelfAssessmentResultItem[];

  totalCompetencies: number;

  competenciesAtTarget: number;

  competenciesBelowTarget: number;

  competenciesAboveTarget: number;

  averageAssessedLevel: number;

  averageTargetLevel: number;

  createdAt: Date;

  updatedAt: Date;
}

const SelfAssessmentResultItemSchema =
  new Schema<ISelfAssessmentResultItem>(
    {
      responseId: {
        type: Schema.Types.ObjectId,
        ref: "SelfAssessmentResponse",
        required: true,
      },

      competencyType: {
        type: String,
        enum: Object.values(
          SelfAssessmentResultCompetencyType,
        ),
        required: true,
      },

      competencyId: {
        type: Schema.Types.ObjectId,
        required: true,
      },

      selfAssessmentLevel: {
        type: Number,
        required: true,
        min: 1,
        max: 10,
      },

      assessedLevel: {
        type: Number,
        required: true,
        min: 1,
        max: 10,
      },

      targetLevel: {
        type: Number,
        required: true,
        min: 1,
        max: 10,
      },

      gap: {
        type: Number,
        required: true,
      },
    },
    {
      _id: false,
    },
  );

const SelfAssessmentResultSchema =
  new Schema<ISelfAssessmentResult>(
    {
      organizationId: {
        type: Schema.Types.ObjectId,
        ref: "Organization",
        index: true,
      },

      selfAssessmentId: {
        type: Schema.Types.ObjectId,
        ref: "SelfAssessment",
        required: true,
        unique: true,
        index: true,
      },

      candidateId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
      },

      roleProfileId: {
        type: Schema.Types.ObjectId,
        ref: "RoleProfile",
        required: true,
        index: true,
      },

      frameworkVersionId: {
        type: Schema.Types.ObjectId,
        ref: "FrameworkVersion",
        required: true,
        index: true,
      },

      status: {
        type: String,
        enum: Object.values(
          SelfAssessmentResultStatus,
        ),
        required: true,
        default:
          SelfAssessmentResultStatus.FINALIZED,
        index: true,
      },

      assessedAt: {
        type: Date,
        required: true,
      },

      items: {
        type: [SelfAssessmentResultItemSchema],
        default: [],
      },

      totalCompetencies: {
        type: Number,
        required: true,
        min: 0,
      },

      competenciesAtTarget: {
        type: Number,
        required: true,
        min: 0,
      },

      competenciesBelowTarget: {
        type: Number,
        required: true,
        min: 0,
      },

      competenciesAboveTarget: {
        type: Number,
        required: true,
        min: 0,
      },

      averageAssessedLevel: {
        type: Number,
        required: true,
        min: 0,
        max: 10,
      },

      averageTargetLevel: {
        type: Number,
        required: true,
        min: 0,
        max: 10,
      },
    },
    {
      timestamps: true,
    },
  );

SelfAssessmentResultSchema.index({
  organizationId: 1,
  candidateId: 1,
  createdAt: -1,
});

SelfAssessmentResultSchema.index({
  organizationId: 1,
  roleProfileId: 1,
});

SelfAssessmentResultSchema.index({
  organizationId: 1,
  frameworkVersionId: 1,
});

export const SelfAssessmentResult =
  mongoose.model<ISelfAssessmentResult>(
    "SelfAssessmentResult",
    SelfAssessmentResultSchema,
  );

export default SelfAssessmentResult;