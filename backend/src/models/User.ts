import mongoose, { Document, Schema } from "mongoose";
import { UserRole } from "../constants/roles";

export interface IUser extends Document {
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  organizationId?: mongoose.Types.ObjectId;
  managerId?: mongoose.Types.ObjectId;
  jobTitle?: string;
  department?: string;
  isActive: boolean;
  refreshTokenHash?: string;
  refreshTokenExpiresAt?: Date;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IUser>(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(UserRole), default: UserRole.STAFF, required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", index: true },
    managerId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    jobTitle: { type: String, trim: true },
    department: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    refreshTokenHash: { type: String, select: false },
    refreshTokenExpiresAt: { type: Date, select: false },
    lastLoginAt: Date
  },
  { timestamps: true }
);

schema.index({ organizationId: 1, role: 1 });
schema.index({ organizationId: 1, managerId: 1 });

export const User = mongoose.model<IUser>("User", schema);
