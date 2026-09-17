import mongoose, { Document, Schema, Types } from "mongoose";

export type SubscriptionStatus = "TRIAL" | "ACTIVE" | "SUSPENDED";
export type SkillLibraryMode = "FULL" | "CURATED";

export interface IOrganizationTeam {
  name: string;
  department?: string;
}

export interface IOrganizationSkillSelection {
  skillId: Types.ObjectId;
  enabled: boolean;
  weight: number;
}

export interface IOrganizationBehaviouralSelection {
  behaviouralFactorId: Types.ObjectId;
  enabled: boolean;
  weight: number;
}

export interface IOrganization extends Document {
  name: string;
  slug: string;
  industry?: string;
  subscription: {
    plan: string;
    seatLimit: number;
    status: SubscriptionStatus;
    startsAt?: Date;
    endsAt?: Date;
  };
  frameworkVersionId?: Types.ObjectId;
  skillLibrary: {
    mode: SkillLibraryMode;
    skills: IOrganizationSkillSelection[];
    behaviouralFactors: IOrganizationBehaviouralSelection[];
  };
  departments: string[];
  teams: IOrganizationTeam[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SkillSelectionSchema = new Schema<IOrganizationSkillSelection>({
  skillId: { type: Schema.Types.ObjectId, ref: "Skill", required: true },
  enabled: { type: Boolean, default: true },
  weight: { type: Number, min: 0, max: 100, default: 1 }
}, { _id: false });

const BehaviouralSelectionSchema = new Schema<IOrganizationBehaviouralSelection>({
  behaviouralFactorId: { type: Schema.Types.ObjectId, ref: "BehaviouralFactor", required: true },
  enabled: { type: Boolean, default: true },
  weight: { type: Number, min: 0, max: 100, default: 1 }
}, { _id: false });

const TeamSchema = new Schema<IOrganizationTeam>({
  name: { type: String, required: true, trim: true, maxlength: 150 },
  department: { type: String, trim: true, maxlength: 150 }
}, { _id: false });

const schema = new Schema<IOrganization>({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  industry: { type: String, trim: true },
  subscription: {
    plan: { type: String, default: "STANDARD" },
    seatLimit: { type: Number, default: 50, min: 1 },
    status: { type: String, enum: ["TRIAL", "ACTIVE", "SUSPENDED"], default: "TRIAL" },
    startsAt: Date,
    endsAt: Date
  },
  frameworkVersionId: { type: Schema.Types.ObjectId, ref: "FrameworkVersion" },
  skillLibrary: {
    mode: { type: String, enum: ["FULL", "CURATED"], default: "FULL" },
    skills: { type: [SkillSelectionSchema], default: [] },
    behaviouralFactors: { type: [BehaviouralSelectionSchema], default: [] }
  },
  departments: { type: [String], default: [] },
  teams: { type: [TeamSchema], default: [] },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

export const Organization = mongoose.model<IOrganization>("Organization", schema);
export default Organization;
