import mongoose, { Document, Schema } from "mongoose";

export type FrameworkStatus =
  | "DRAFT"
  | "ACTIVE"
  | "ARCHIVED";

export interface IFrameworkVersion extends Document {
  organizationId?: mongoose.Types.ObjectId;

  name: string;
  version: string;
  description?: string;

  status: FrameworkStatus;

  effectiveFrom?: Date;
  effectiveTo?: Date;

  createdBy: mongoose.Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IFrameworkVersion>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      index: true
    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    version: {
      type: String,
      required: true,
      trim: true
    },

    description: {
      type: String,
      trim: true
    },

    status: {
      type: String,
      enum: ["DRAFT", "ACTIVE", "ARCHIVED"],
      default: "DRAFT",
      index: true
    },

    effectiveFrom: Date,

    effectiveTo: Date,

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  {
    timestamps: true
  }
);

schema.index({
  organizationId: 1,
  version: 1
});

export const FrameworkVersion =
  mongoose.model<IFrameworkVersion>(
    "FrameworkVersion",
    schema
  );