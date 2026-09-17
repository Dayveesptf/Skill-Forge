import mongoose, { Document, Schema, Types } from "mongoose";

export interface IAssessmentResponse extends Document {
  organizationId?: Types.ObjectId;

  attemptId: Types.ObjectId;
  assessmentId: Types.ObjectId;
  candidateId: Types.ObjectId;
  questionId: Types.ObjectId;

  selectedOptionKeys?: string[];

  textAnswer?: string;

  answeredAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

const AssessmentResponseSchema =
  new Schema<IAssessmentResponse>(
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
        required: true,
        index: true
      },

      selectedOptionKeys: {
        type: [String],
        default: undefined
      },

      textAnswer: {
        type: String,
        trim: true
      },

      answeredAt: {
        type: Date,
        default: Date.now,
        required: true
      }
    },
    {
      timestamps: true
    }
  );

AssessmentResponseSchema.index(
  {
    attemptId: 1,
    questionId: 1
  },
  {
    unique: true
  }
);

export const AssessmentResponse =
  mongoose.model<IAssessmentResponse>(
    "AssessmentResponse",
    AssessmentResponseSchema
  );