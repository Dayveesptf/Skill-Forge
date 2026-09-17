import mongoose, { Document, Schema } from "mongoose";

export type EvidenceType =
  | "EXAMPLE"
  | "SCENARIO"
  | "PROJECT"
  | "BEHAVIOURAL"
  | "TECHNICAL";

export interface IEvidencePrompt extends Document {
  organizationId?: mongoose.Types.ObjectId;
  frameworkVersionId: mongoose.Types.ObjectId;

  skillId?: mongoose.Types.ObjectId;
  behaviouralFactorId?: mongoose.Types.ObjectId;

  prompt: string;

  evidenceType: EvidenceType;

  minimumLevel?: number;
  maximumLevel?: number;

  guidance?: string;

  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IEvidencePrompt>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      index: true
    },

    frameworkVersionId: {
      type: Schema.Types.ObjectId,
      ref: "FrameworkVersion",
      required: true,
      index: true
    },

    skillId: {
      type: Schema.Types.ObjectId,
      ref: "Skill",
      index: true
    },

    behaviouralFactorId: {
      type: Schema.Types.ObjectId,
      ref: "BehaviouralFactor",
      index: true
    },

    prompt: {
      type: String,
      required: true,
      trim: true
    },

    evidenceType: {
      type: String,
      enum: [
        "EXAMPLE",
        "SCENARIO",
        "PROJECT",
        "BEHAVIOURAL",
        "TECHNICAL"
      ],
      required: true
    },

    minimumLevel: {
      type: Number,
      min: 1,
      max: 10
    },

    maximumLevel: {
      type: Number,
      min: 1,
      max: 10
    },

    guidance: {
      type: String,
      trim: true
    },

    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

schema.pre("validate", function (next) {
  if (!this.skillId && !this.behaviouralFactorId) {
    return next(
      new Error(
        "Evidence prompt must reference a skill or behavioural factor"
      )
    );
  }

  if (
    this.minimumLevel !== undefined &&
    this.maximumLevel !== undefined &&
    this.minimumLevel > this.maximumLevel
  ) {
    return next(
      new Error(
        "minimumLevel cannot be greater than maximumLevel"
      )
    );
  }

  next();
});

export const EvidencePrompt =
  mongoose.model<IEvidencePrompt>(
    "EvidencePrompt",
    schema
  );