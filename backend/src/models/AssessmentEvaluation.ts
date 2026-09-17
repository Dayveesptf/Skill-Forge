import mongoose, {
  Document,
  Schema,
  Types
} from "mongoose";

export enum AssessmentEvaluationStatus {
  COMPLETED = "COMPLETED",
  PENDING_REVIEW = "PENDING_REVIEW"
}

export enum PerformanceBand {
  EXCEPTIONAL = "EXCEPTIONAL",
  STRONG = "STRONG",
  DEVELOPING = "DEVELOPING",
  NEEDS_IMPROVEMENT = "NEEDS_IMPROVEMENT"
}

export interface ISkillScoreSummary {
  skillId: Types.ObjectId;
  earnedPoints: number;
  possiblePoints: number;
  percentage: number;
  questionCount: number;
}

export interface IBehaviouralScoreSummary {
  behaviouralFactorId: Types.ObjectId;
  earnedPoints: number;
  possiblePoints: number;
  percentage: number;
  questionCount: number;
}

export interface IAssessmentEvaluation extends Document {
  organizationId?: Types.ObjectId;

  attemptId: Types.ObjectId;
  assessmentId: Types.ObjectId;
  candidateId: Types.ObjectId;

  status: AssessmentEvaluationStatus;

  totalQuestions: number;
  answeredQuestions: number;

  scoredQuestions: number;
  pendingQuestions: number;

  earnedPoints: number;
  scorablePoints: number;
  pendingPoints: number;
  totalPossiblePoints: number;

  overallScore: number;

  passingScore?: number;
  passed?: boolean;

  performanceBand: PerformanceBand;

  skillScores: ISkillScoreSummary[];
  behaviouralFactorScores: IBehaviouralScoreSummary[];

  evaluatedAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

const SkillScoreSummarySchema =
  new Schema<ISkillScoreSummary>(
    {
      skillId: {
        type: Schema.Types.ObjectId,
        ref: "Skill",
        required: true
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

      questionCount: {
        type: Number,
        required: true,
        min: 0
      }
    },
    { _id: false }
  );

const BehaviouralScoreSummarySchema =
  new Schema<IBehaviouralScoreSummary>(
    {
      behaviouralFactorId: {
        type: Schema.Types.ObjectId,
        ref: "BehaviouralFactor",
        required: true
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

      questionCount: {
        type: Number,
        required: true,
        min: 0
      }
    },
    { _id: false }
  );

const AssessmentEvaluationSchema =
  new Schema<IAssessmentEvaluation>(
    {
      organizationId: {
        type: Schema.Types.ObjectId,
        ref: "Organization",
        index: true
      },

      attemptId: {
        type: Schema.Types.ObjectId,
        ref: "AssessmentAttempt",
        required: true,
        unique: true,
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

      status: {
        type: String,
        enum: Object.values(AssessmentEvaluationStatus),
        required: true,
        index: true
      },

      totalQuestions: {
        type: Number,
        required: true,
        min: 0
      },

      answeredQuestions: {
        type: Number,
        required: true,
        min: 0
      },

      scoredQuestions: {
        type: Number,
        required: true,
        min: 0
      },

      pendingQuestions: {
        type: Number,
        required: true,
        min: 0
      },

      earnedPoints: {
        type: Number,
        required: true,
        min: 0
      },

      scorablePoints: {
        type: Number,
        required: true,
        min: 0
      },

      pendingPoints: {
        type: Number,
        required: true,
        min: 0
      },

      totalPossiblePoints: {
        type: Number,
        required: true,
        min: 0
      },

      overallScore: {
        type: Number,
        required: true,
        min: 0,
        max: 100
      },

      passingScore: {
        type: Number,
        min: 0,
        max: 100
      },

      passed: {
        type: Boolean
      },

      performanceBand: {
        type: String,
        enum: Object.values(PerformanceBand),
        required: true
      },

      skillScores: {
        type: [SkillScoreSummarySchema],
        default: []
      },

      behaviouralFactorScores: {
        type: [BehaviouralScoreSummarySchema],
        default: []
      },

      evaluatedAt: {
        type: Date,
        required: true,
        default: Date.now
      }
    },
    {
      timestamps: true
    }
  );

AssessmentEvaluationSchema.index({
  organizationId: 1,
  assessmentId: 1
});

AssessmentEvaluationSchema.index({
  organizationId: 1,
  candidateId: 1
});

export const AssessmentEvaluation =
  mongoose.model<IAssessmentEvaluation>(
    "AssessmentEvaluation",
    AssessmentEvaluationSchema
  );

export default AssessmentEvaluation;