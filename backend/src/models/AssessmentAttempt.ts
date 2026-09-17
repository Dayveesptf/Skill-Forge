import mongoose, {
  Document,
  Schema,
  Types
} from "mongoose";

export enum AssessmentAttemptStatus {
  IN_PROGRESS = "IN_PROGRESS",
  SUBMITTED = "SUBMITTED",
  EXPIRED = "EXPIRED",
  ABANDONED = "ABANDONED"
}

export interface IAssessmentAttempt
  extends Document {
  organizationId?: Types.ObjectId;

  assignmentId: Types.ObjectId;
  assessmentId: Types.ObjectId;
  candidateId: Types.ObjectId;

  attemptNumber: number;

  status: AssessmentAttemptStatus;

  startedAt: Date;
  expiresAt?: Date;
  submittedAt?: Date;

  questionOrder: Types.ObjectId[];

  currentQuestionIndex: number;

  createdAt: Date;
  updatedAt: Date;
}

const AssessmentAttemptSchema =
  new Schema<IAssessmentAttempt>(
    {
      organizationId: {
        type: Schema.Types.ObjectId,
        ref: "Organization",
        index: true
      },

      assignmentId: {
        type: Schema.Types.ObjectId,
        ref: "AssessmentAssignment",
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

      attemptNumber: {
        type: Number,
        required: true,
        min: 1
      },

      status: {
        type: String,
        enum: Object.values(
          AssessmentAttemptStatus
        ),
        default:
          AssessmentAttemptStatus.IN_PROGRESS,
        required: true,
        index: true
      },

      startedAt: {
        type: Date,
        default: Date.now,
        required: true
      },

      expiresAt: {
        type: Date
      },

      submittedAt: {
        type: Date
      },

      questionOrder: [
        {
          type: Schema.Types.ObjectId,
          ref: "AssessmentQuestion"
        }
      ],

      currentQuestionIndex: {
        type: Number,
        default: 0,
        min: 0
      }
    },
    {
      timestamps: true
    }
  );

AssessmentAttemptSchema.index(
  {
    assignmentId: 1,
    attemptNumber: 1
  },
  {
    unique: true
  }
);

AssessmentAttemptSchema.index({
  candidateId: 1,
  status: 1
});

export const AssessmentAttempt =
  mongoose.model<IAssessmentAttempt>(
    "AssessmentAttempt",
    AssessmentAttemptSchema
  );

export default AssessmentAttempt;