import mongoose, { Document, Schema } from "mongoose";

export interface IAuditLog extends Document {
  actorId?: mongoose.Types.ObjectId;
  organizationId?: mongoose.Types.ObjectId;
  action: string;
  entityType: string;
  entityId?: mongoose.Types.ObjectId;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

const schema = new Schema<IAuditLog>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User" },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
    action: { type: String, required: true, index: true },
    entityType: { type: String, required: true },
    entityId: { type: Schema.Types.ObjectId },
    metadata: { type: Schema.Types.Mixed },
    ipAddress: String,
    userAgent: String
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

schema.index({ organizationId: 1, createdAt: -1 });

export const AuditLog = mongoose.model<IAuditLog>("AuditLog", schema);
