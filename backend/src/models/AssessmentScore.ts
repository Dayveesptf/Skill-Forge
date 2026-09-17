import mongoose, {
  Document,
  Schema,
  Types
} from "mongoose";

export enum AssessmentScoringMethod {
  AUTO = "AUTO",
  PENDING = "PENDING",
  MANUAL = "MANUAL"
}

export interface IAssessmentScore extends Document {
  organizationId?: Types.ObjectId;

  evaluationId: Types.ObjectId;
  attemptId: Types.ObjectId;
  assessmentId: Types.ObjectId;
  candidateId: Types.ObjectId;

  questionId: Types.ObjectId;

  skillId?: Types.ObjectId;
  behaviouralFactorId?: Types.ObjectId;

  level?: number;

  earnedPoints: number;
  possiblePoints: number;
  percentage: number;

  weight: number;

  scoringMethod: AssessmentScoringMethod;

  selectedOptionKeys?: string[];
  textAnswer?: string;

  pendingReason?: string;

  createdAt: Date;
  updatedAt: Date;
}

const AssessmentScoreSchema =
  new Schema<IAssessmentScore>(
    {
      organizationId: {
        type: Schema.Types.ObjectId,
        ref: "Organization",
        index: true
      },

      evaluationId: {
        type: Schema.Types.ObjectId,
        ref: "AssessmentEvaluation",
        required: true,
        index: true
      },

      attemptId: {
        type: Schema.Types.ObjectId,
        ref: "AssessmentAttempt",
        required: true,
        index: true
      },

      assessmentId: {
        type: Schema.Types.ObjectId,
        ref: "Assessment",
        required: true,
        index: true
      },

      candidateId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
      },

      questionId: {
        type: Schema.Types.ObjectId,
        ref: "AssessmentQuestion",
        required: true
      },

      skillId: {
        type: Schema.Types.ObjectId,
        ref: "Skill"
      },

      behaviouralFactorId: {
        type: Schema.Types.ObjectId,
        ref: "BehaviouralFactor"
      },

      level: {
        type: Number,
        min: 1,
        max: 10
      },

      earnedPoints: {
        type: Number,
        required: true,
        min: 0
      },

      possiblePoints: {
        type: Number,
        required: true,
        min: 0
      },

      percentage: {
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

      scoringMethod: {
        type: String,
        enum: Object.values(AssessmentScoringMethod),
        required: true
      },

      selectedOptionKeys: {
        type: [String],
        default: undefined
      },

      textAnswer: {
        type: String
      },

      pendingReason: {
        type: String
      }
    },
    {
      timestamps: true
    }
  );

AssessmentScoreSchema.index(
  {
    evaluationId: 1,
    questionId: 1
  },
  {
    unique: true
  }
);

export const AssessmentScore =
  mongoose.model<IAssessmentScore>(
    "AssessmentScore",
    AssessmentScoreSchema
  );

export default AssessmentScore;