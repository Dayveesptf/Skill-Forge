import mongoose, { Document, Schema } from "mongoose";
import { UserRole } from "../constants/roles";

export type InvitationStatus = "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";

export interface IInvitation extends Document {
  organizationId: mongoose.Types.ObjectId;
  email: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  managerId?: mongoose.Types.ObjectId;
  tokenHash: string;
  status: InvitationStatus;
  expiresAt: Date;
  invitedBy: mongoose.Types.ObjectId;
  acceptedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IInvitation>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    role: { type: String, enum: Object.values(UserRole), default: UserRole.STAFF },
    managerId: { type: Schema.Types.ObjectId, ref: "User" },
    tokenHash: { type: String, required: true, unique: true, select: false },
    status: {
      type: String,
      enum: ["PENDING", "ACCEPTED", "EXPIRED", "REVOKED"],
      default: "PENDING",
      index: true
    },
    expiresAt: { type: Date, required: true, index: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    acceptedAt: Date
  },
  { timestamps: true }
);

schema.index({ organizationId: 1, email: 1, status: 1 });

export const Invitation = mongoose.model<IInvitation>("Invitation", schema);
