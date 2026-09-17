import mongoose, { Document, Schema, Types } from "mongoose";

export enum AIGenerationType {
  ROLE_SKILL_MAPPING = "ROLE_SKILL_MAPPING",
  INTERVIEW_QUESTIONS = "INTERVIEW_QUESTIONS"
}

export enum AIGenerationStatus {
  PENDING_REVIEW = "PENDING_REVIEW",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED"
}

export interface IAIGeneration extends Document {
  organizationId: Types.ObjectId;

  generationType: AIGenerationType;

  frameworkVersionId: Types.ObjectId;

  roleProfileId?: Types.ObjectId;

  assessmentId?: Types.ObjectId;

  /**
   * Name of the AI model used for this generation.
   *
   * We intentionally use "aiModel" instead of "model"
   * because Mongoose's Document interface already has
   * a "model" property.
   */
  aiModel: string;

  inputSnapshot: unknown;

  output: unknown;

  status: AIGenerationStatus;

  approvedIndexes?: number[];

  reviewNotes?: string;

  createdBy: Types.ObjectId;

  reviewedBy?: Types.ObjectId;

  reviewedAt?: Date;

  createdAt: Date;

  updatedAt: Date;
}

const AIGenerationSchema = new Schema<IAIGeneration>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true
    },

    generationType: {
      type: String,
      enum: Object.values(AIGenerationType),
      required: true,
      index: true
    },

    frameworkVersionId: {
      type: Schema.Types.ObjectId,
      ref: "FrameworkVersion",
      required: true,
      index: true
    },

    roleProfileId: {
      type: Schema.Types.ObjectId,
      ref: "RoleProfile",
      index: true
    },

    assessmentId: {
      type: Schema.Types.ObjectId,
      ref: "Assessment",
      index: true
    },

    aiModel: {
      type: String,
      required: true,
      trim: true
    },

    inputSnapshot: {
      type: Schema.Types.Mixed,
      required: true
    },

    output: {
      type: Schema.Types.Mixed,
      required: true
    },

    status: {
      type: String,
      enum: Object.values(AIGenerationStatus),
      default: AIGenerationStatus.PENDING_REVIEW,
      required: true,
      index: true
    },

    approvedIndexes: {
      type: [Number],
      default: undefined
    },

    reviewNotes: {
      type: String,
      trim: true
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User"
    },

    reviewedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

AIGenerationSchema.index({
  organizationId: 1,
  generationType: 1,
  createdAt: -1
});

AIGenerationSchema.index({
  organizationId: 1,
  status: 1,
  createdAt: -1
});

export const AIGeneration = mongoose.model<IAIGeneration>(
  "AIGeneration",
  AIGenerationSchema
);

export default AIGeneration;