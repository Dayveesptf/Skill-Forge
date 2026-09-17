import mongoose, { Document, Schema, Types } from "mongoose";

export enum GapAnalysisSource {
  ROLE_PROFILE_ONLY = "ROLE_PROFILE_ONLY",
  SELF_ASSESSMENT_ONLY = "SELF_ASSESSMENT_ONLY",
  OBJECTIVE_ONLY = "OBJECTIVE_ONLY",
  SELF_ASSESSMENT_AND_OBJECTIVE = "SELF_ASSESSMENT_AND_OBJECTIVE"
}

export enum GapClassification {
  DEVELOPMENT_GAP = "DEVELOPMENT_GAP",
  AT_TARGET = "AT_TARGET",
  STRENGTH = "STRENGTH",
  NO_EVIDENCE = "NO_EVIDENCE"
}

export enum GapAnalysisStatus {
  GENERATED = "GENERATED",
  REVIEWED = "REVIEWED"
}

export interface IGapCompetency {
  competencyType: "SKILL" | "BEHAVIOURAL_FACTOR";
  competencyId: Types.ObjectId;
  competencyName: string;

  targetLevel: number;
  selfAssessmentLevel?: number;
  objectiveLevel?: number;

  currentLevel: number;
  gap: number;

  readinessPercentage: number;
  weight: number;

  selfVsObjectiveGap?: number;

  classification: GapClassification;

  evidence?: string;
  confidence?: string;
}

export interface IGapAnalysis extends Document {
  organizationId?: Types.ObjectId;

  candidateId: Types.ObjectId;
  roleProfileId: Types.ObjectId;
  frameworkVersionId: Types.ObjectId;

  selfAssessmentId?: Types.ObjectId;
  objectiveEvaluationId?: Types.ObjectId;

  source: GapAnalysisSource;
  status: GapAnalysisStatus;

  overallTargetLevel: number;
  overallCurrentLevel: number;
  overallGap: number;
  readinessPercentage: number;

  competencyCount: number;
  competenciesWithObjectiveEvidence: number;
  competenciesWithSelfEvidence: number;

  strengthsCount: number;
  developmentAreasCount: number;

  skillGaps: IGapCompetency[];
  behaviouralFactorGaps: IGapCompetency[];

  summary: string;

  generatedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const GapCompetencySchema = new Schema<IGapCompetency>(
  {
    competencyType: {
      type: String,
      enum: ["SKILL", "BEHAVIOURAL_FACTOR"],
      required: true
    },

    competencyId: {
      type: Schema.Types.ObjectId,
      required: true
    },

    competencyName: {
      type: String,
      required: true,
      trim: true
    },

    targetLevel: {
      type: Number,
      required: true,
      min: 1,
      max: 10
    },

    selfAssessmentLevel: {
      type: Number,
      min: 1,
      max: 10
    },

    objectiveLevel: {
      type: Number,
      min: 1,
      max: 10
    },

    currentLevel: {
      type: Number,
      required: true,
      min: 0,
      max: 10
    },

    gap: {
      type: Number,
      required: true
    },

    readinessPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },

    weight: {
      type: Number,
      required: true,
      min: 0
    },

    selfVsObjectiveGap: {
      type: Number
    },

    classification: {
      type: String,
      enum: Object.values(GapClassification),
      required: true
    },

    evidence: {
      type: String,
      trim: true,
      maxlength: 5000
    },

    confidence: {
      type: String,
      trim: true
    }
  },
  { _id: false }
);

const GapAnalysisSchema = new Schema<IGapAnalysis>(
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

    selfAssessmentId: {
      type: Schema.Types.ObjectId,
      ref: "SelfAssessment"
    },

    objectiveEvaluationId: {
      type: Schema.Types.ObjectId,
      ref: "AssessmentEvaluation"
    },

    source: {
      type: String,
      enum: Object.values(GapAnalysisSource),
      required: true
    },

    status: {
      type: String,
      enum: Object.values(GapAnalysisStatus),
      default: GapAnalysisStatus.GENERATED,
      required: true,
      index: true
    },

    overallTargetLevel: {
      type: Number,
      required: true,
      min: 0,
      max: 10
    },

    overallCurrentLevel: {
      type: Number,
      required: true,
      min: 0,
      max: 10
    },

    overallGap: {
      type: Number,
      required: true
    },

    readinessPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },

    competencyCount: {
      type: Number,
      required: true,
      min: 0
    },

    competenciesWithObjectiveEvidence: {
      type: Number,
      required: true,
      min: 0
    },

    competenciesWithSelfEvidence: {
      type: Number,
      required: true,
      min: 0
    },

    strengthsCount: {
      type: Number,
      required: true,
      min: 0
    },

    developmentAreasCount: {
      type: Number,
      required: true,
      min: 0
    },

    skillGaps: {
      type: [GapCompetencySchema],
      default: []
    },

    behaviouralFactorGaps: {
      type: [GapCompetencySchema],
      default: []
    },

    summary: {
      type: String,
      required: true,
      trim: true
    },

    generatedAt: {
      type: Date,
      default: Date.now,
      required: true
    },

    reviewedAt: {
      type: Date
    },

    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User"
    }
  },
  {
    timestamps: true
  }
);

GapAnalysisSchema.index({
  candidateId: 1,
  roleProfileId: 1,
  generatedAt: -1
});

GapAnalysisSchema.index({
  organizationId: 1,
  generatedAt: -1
});

export const GapAnalysis = mongoose.model<IGapAnalysis>(
  "GapAnalysis",
  GapAnalysisSchema
);

export default GapAnalysis;