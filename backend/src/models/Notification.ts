import mongoose, { Document, Schema, Types } from "mongoose";

export enum NotificationType {
  ASSESSMENT_ASSIGNED = "ASSESSMENT_ASSIGNED",
  ASSESSMENT_SUBMITTED = "ASSESSMENT_SUBMITTED",
  ASSESSMENT_EVALUATED = "ASSESSMENT_EVALUATED",
  SELF_ASSESSMENT_ASSIGNED = "SELF_ASSESSMENT_ASSIGNED",
  SELF_ASSESSMENT_SUBMITTED = "SELF_ASSESSMENT_SUBMITTED",
  GAP_ANALYSIS_READY = "GAP_ANALYSIS_READY",
  REPORT_READY = "REPORT_READY",
  INVITATION_RECEIVED = "INVITATION_RECEIVED",
  SYSTEM = "SYSTEM"
}

export enum NotificationPriority {
  LOW = "LOW",
  NORMAL = "NORMAL",
  HIGH = "HIGH"
}

export interface INotification extends Document {
  organizationId?: Types.ObjectId;
  recipientId: Types.ObjectId;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  entityType?: string;
  entityId?: Types.ObjectId;
  metadata?: Record<string, unknown>;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      index: true
    },

    recipientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    type: {
      type: String,
      enum: Object.values(NotificationType),
      required: true,
      index: true
    },

    priority: {
      type: String,
      enum: Object.values(NotificationPriority),
      default: NotificationPriority.NORMAL,
      required: true
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },

    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000
    },

    entityType: {
      type: String,
      trim: true,
      maxlength: 100
    },

    entityId: {
      type: Schema.Types.ObjectId
    },

    metadata: {
      type: Schema.Types.Mixed
    },

    readAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

NotificationSchema.index({
  recipientId: 1,
  readAt: 1,
  createdAt: -1
});

NotificationSchema.index({
  organizationId: 1,
  createdAt: -1
});

export const Notification = mongoose.model<INotification>(
  "Notification",
  NotificationSchema
);

export default Notification;