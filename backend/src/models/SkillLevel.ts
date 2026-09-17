import mongoose, { Document, Schema } from "mongoose";

export interface ISkillLevel extends Document {
  frameworkVersionId: mongoose.Types.ObjectId;
  skillId: mongoose.Types.ObjectId;

  level: number;
  name: string;

  description?: string;

  behaviours: string[];

  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<ISkillLevel>(
  {
    frameworkVersionId: {
      type: Schema.Types.ObjectId,
      ref: "FrameworkVersion",
      required: true,
      index: true
    },

    skillId: {
      type: Schema.Types.ObjectId,
      ref: "Skill",
      required: true,
      index: true
    },

    level: {
      type: Number,
      required: true,
      min: 1,
      max: 10
    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    description: {
      type: String,
      trim: true
    },

    behaviours: {
      type: [String],
      default: []
    }
  },
  {
    timestamps: true
  }
);

schema.index(
  {
    skillId: 1,
    level: 1
  },
  {
    unique: true
  }
);

export const SkillLevel = mongoose.model<ISkillLevel>(
  "SkillLevel",
  schema
);