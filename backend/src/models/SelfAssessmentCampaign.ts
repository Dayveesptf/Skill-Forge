import mongoose, {
  Document,
  Schema,
  Types
} from "mongoose";

export enum SelfAssessmentCampaignScope {
  ORGANIZATION = "ORGANIZATION",
  TEAM = "TEAM",
  INDIVIDUAL = "INDIVIDUAL"
}

export enum SelfAssessmentCampaignStatus {
  DRAFT = "DRAFT",
  LAUNCHED = "LAUNCHED",
  CLOSED = "CLOSED",
  CANCELLED = "CANCELLED"
}

export interface ISelfAssessmentCampaign
  extends Document {
  organizationId: Types.ObjectId;

  name: string;

  description?: string;

  roleProfileId: Types.ObjectId;

  scope: SelfAssessmentCampaignScope;

  candidateIds: Types.ObjectId[];

  teamManagerId?: Types.ObjectId;

  startAt: Date;

  dueAt: Date;

  corroborationRequired: boolean;

  status: SelfAssessmentCampaignStatus;

  launchedBy?: Types.ObjectId;

  launchedAt?: Date;

  createdBy: Types.ObjectId;

  createdAt: Date;

  updatedAt: Date;
}

const SelfAssessmentCampaignSchema =
  new Schema<ISelfAssessmentCampaign>(
    {
      organizationId: {
        type: Schema.Types.ObjectId,
        ref: "Organization",
        required: true,
        index: true
      },

      name: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 200
      },

      description: {
        type: String,
        trim: true,
        maxlength: 5000
      },

      roleProfileId: {
        type: Schema.Types.ObjectId,
        ref: "RoleProfile",
        required: true,
        index: true
      },

      scope: {
        type: String,
        enum: Object.values(
          SelfAssessmentCampaignScope
        ),
        required: true
      },

      candidateIds: {
        type: [
          {
            type: Schema.Types.ObjectId,
            ref: "User"
          }
        ],
        default: []
      },

      teamManagerId: {
        type: Schema.Types.ObjectId,
        ref: "User"
      },

      startAt: {
        type: Date,
        required: true
      },

      dueAt: {
        type: Date,
        required: true
      },

      corroborationRequired: {
        type: Boolean,
        default: false,
        required: true
      },

      status: {
        type: String,
        enum: Object.values(
          SelfAssessmentCampaignStatus
        ),
        default:
          SelfAssessmentCampaignStatus.DRAFT,
        required: true,
        index: true
      },

      launchedBy: {
        type: Schema.Types.ObjectId,
        ref: "User"
      },

      launchedAt: {
        type: Date
      },

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

SelfAssessmentCampaignSchema.index({
  organizationId: 1,
  status: 1,
  startAt: 1
});

export const SelfAssessmentCampaign =
  mongoose.model<ISelfAssessmentCampaign>(
    "SelfAssessmentCampaign",
    SelfAssessmentCampaignSchema
  );

export default SelfAssessmentCampaign;