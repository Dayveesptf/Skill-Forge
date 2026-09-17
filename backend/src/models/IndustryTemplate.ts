import mongoose, { Document, Schema } from "mongoose";

export interface IIndustryTemplate extends Document {
  name: string;
  slug: string;

  description?: string;

  industry: string;

  skills: Array<{
    skillId: mongoose.Types.ObjectId;
    weight: number;
  }>;

  behaviouralFactors: Array<{
    behaviouralFactorId: mongoose.Types.ObjectId;
    weight: number;
  }>;

  isSystemTemplate: boolean;
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IIndustryTemplate>(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    description: {
      type: String,
      trim: true
    },

    industry: {
      type: String,
      required: true,
      trim: true,
      index: true
    },

    skills: [
      {
        skillId: {
          type: Schema.Types.ObjectId,
          ref: "Skill",
          required: true
        },

        weight: {
          type: Number,
          min: 0,
          max: 100,
          default: 1
        }
      }
    ],

    behaviouralFactors: [
      {
        behaviouralFactorId: {
          type: Schema.Types.ObjectId,
          ref: "BehaviouralFactor",
          required: true
        },

        weight: {
          type: Number,
          min: 0,
          max: 100,
          default: 1
        }
      }
    ],

    isSystemTemplate: {
      type: Boolean,
      default: true
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

export const IndustryTemplate =
  mongoose.model<IIndustryTemplate>(
    "IndustryTemplate",
    schema
  );