import mongoose, { Document, Schema } from "mongoose";

export interface IBehaviouralFactor extends Document {
  organizationId?: mongoose.Types.ObjectId;
  frameworkVersionId: mongoose.Types.ObjectId;

  name: string;
  slug: string;
  description?: string;

  indicators: string[];

  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IBehaviouralFactor>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      index: true
    },

    frameworkVersionId: {
      type: Schema.Types.ObjectId,
      ref: "FrameworkVersion",
      required: true,
      index: true
    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },

    description: {
      type: String,
      trim: true
    },

    indicators: {
      type: [String],
      default: []
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

schema.index(
  {
    frameworkVersionId: 1,
    slug: 1
  },
  {
    unique: true
  }
);

export const BehaviouralFactor = mongoose.model<IBehaviouralFactor>(
  "BehaviouralFactor",
  schema
);