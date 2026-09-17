import mongoose, { Document, Schema, Types } from "mongoose";

export enum AssessmentAssignmentStatus {
  ASSIGNED = "ASSIGNED",
  STARTED = "STARTED",
  COMPLETED = "COMPLETED",
  EXPIRED = "EXPIRED",
  CANCELLED = "CANCELLED"
}

export interface IAssessmentAssignment extends Document {
  organizationId?: Types.ObjectId;
  assessmentId: Types.ObjectId;
  candidateId: Types.ObjectId;
  assignedBy: Types.ObjectId;

  status: AssessmentAssignmentStatus;

  assignedAt: Date;
  dueAt?: Date;

  maxAttempts: number;

  startedAt?: Date;
  completedAt?: Date;

  instructions?: string;

  createdAt: Date;
  updatedAt: Date;
}

const AssessmentAssignmentSchema =
  new Schema<IAssessmentAssignment>(
    {
      organizationId: {
        type: Schema.Types.ObjectId,
        ref: "Organization",
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

      assignedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
      },

      status: {
        type: String,
        enum: Object.values(AssessmentAssignmentStatus),
        default: AssessmentAssignmentStatus.ASSIGNED,
        required: true,
        index: true
      },

      assignedAt: {
        type: Date,
        default: Date.now,
        required: true
      },

      dueAt: {
        type: Date
      },

      maxAttempts: {
        type: Number,
        default: 1,
        min: 1
      },

      startedAt: {
        type: Date
      },

      completedAt: {
        type: Date
      },

      instructions: {
        type: String,
        trim: true
      }
    },
    {
      timestamps: true
    }
  );

AssessmentAssignmentSchema.index({
  assessmentId: 1,
  candidateId: 1
});

AssessmentAssignmentSchema.index({
  candidateId: 1,
  status: 1
});

export const AssessmentAssignment =
  mongoose.model<IAssessmentAssignment>(
    "AssessmentAssignment",
    AssessmentAssignmentSchema
  );