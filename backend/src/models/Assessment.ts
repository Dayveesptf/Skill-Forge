/**
 * NOTE — this is one of TWO assessment systems in this codebase.
 * See /docs/ARCHITECTURE.md#dual-assessment-systems before touching
 * this file. In short: this is the objective, question-based
 * "quiz" engine (see AssessmentQuestion, AssessmentAttempt,
 * AssessmentEvaluation). The employee self-rating flow used for
 * the core skills-assessment workflow lives in ../models/SelfAssessment.ts
 * instead. Reporting/gap-analysis intentionally compares the two
 * (selfAssessmentLevel vs. objectiveLevel) — this is not duplication.
 */
import mongoose, { Document, Schema, Types } from "mongoose";

export enum AssessmentStatus {
  DRAFT = "DRAFT",
  READY = "READY",
  PUBLISHED = "PUBLISHED",
  ARCHIVED = "ARCHIVED"
}

export enum AssessmentType {
  SKILLS = "SKILLS",
  TECHNICAL = "TECHNICAL",
  BEHAVIOURAL = "BEHAVIOURAL",
  MIXED = "MIXED"
}

export interface IAssessment extends Document {
  organizationId?: Types.ObjectId;
  frameworkVersionId: Types.ObjectId;
  industryTemplateId?: Types.ObjectId;

  title: string;
  slug: string;
  description?: string;

  type: AssessmentType;
  status: AssessmentStatus;

  instructions?: string;

  durationMinutes?: number;
  passingScore?: number;

  maxAttempts: number;

  randomizeQuestions: boolean;
  randomizeOptions: boolean;

  showResultsImmediately: boolean;

  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;

  publishedAt?: Date;
  archivedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const assessmentSchema = new Schema<IAssessment>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: false,
      index: true
    },

    frameworkVersionId: {
      type: Schema.Types.ObjectId,
      ref: "FrameworkVersion",
      required: true,
      index: true
    },

    industryTemplateId: {
      type: Schema.Types.ObjectId,
      ref: "IndustryTemplate",
      required: false
    },

    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 200
    },

    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },

    description: {
      type: String,
      trim: true,
      maxlength: 5000
    },

    type: {
      type: String,
      enum: Object.values(AssessmentType),
      required: true,
      default: AssessmentType.MIXED
    },

    status: {
      type: String,
      enum: Object.values(AssessmentStatus),
      required: true,
      default: AssessmentStatus.DRAFT,
      index: true
    },

    instructions: {
      type: String,
      trim: true,
      maxlength: 10000
    },

    durationMinutes: {
      type: Number,
      min: 1,
      max: 1440
    },

    passingScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 60
    },

    maxAttempts: {
      type: Number,
      min: 1,
      max: 20,
      default: 1
    },

    randomizeQuestions: {
      type: Boolean,
      default: false
    },

    randomizeOptions: {
      type: Boolean,
      default: false
    },

    showResultsImmediately: {
      type: Boolean,
      default: false
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User"
    },

    publishedAt: {
      type: Date
    },

    archivedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

assessmentSchema.index(
  {
    organizationId: 1,
    slug: 1
  },
  {
    unique: true,
    partialFilterExpression: {
      organizationId: {
        $exists: true
      }
    }
  }
);

assessmentSchema.index({
  frameworkVersionId: 1,
  status: 1
});

export const Assessment = mongoose.model<IAssessment>(
  "Assessment",
  assessmentSchema
);