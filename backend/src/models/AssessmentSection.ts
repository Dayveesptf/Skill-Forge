import mongoose, { Document, Schema, Types } from "mongoose";

export interface IAssessmentSection extends Document {
  assessmentId: Types.ObjectId;

  title: string;
  description?: string;

  order: number;

  instructions?: string;

  createdAt: Date;
  updatedAt: Date;
}

const assessmentSectionSchema =
  new Schema<IAssessmentSection>(
    {
      assessmentId: {
        type: Schema.Types.ObjectId,
        ref: "Assessment",
        required: true,
        index: true
      },

      title: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 200
      },

      description: {
        type: String,
        trim: true,
        maxlength: 3000
      },

      order: {
        type: Number,
        required: true,
        min: 1
      },

      instructions: {
        type: String,
        trim: true,
        maxlength: 5000
      }
    },
    {
      timestamps: true
    }
  );

assessmentSectionSchema.index({
  assessmentId: 1,
  order: 1
});

export const AssessmentSection =
  mongoose.model<IAssessmentSection>(
    "AssessmentSection",
    assessmentSectionSchema
  );