import mongoose, {
  Document,
  Schema,
  Types
} from "mongoose";

export enum SelfAssessmentConfidence {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH"
}

export interface IEvidenceAttachment {
  key: string;

  filename: string;

  mimeType: string;

  size: number;

  uploadedAt: Date;

  uploadedBy: Types.ObjectId;
}

export interface ISelfAssessmentResponse
  extends Document {
  organizationId?: Types.ObjectId;

  selfAssessmentId: Types.ObjectId;

  skillId?: Types.ObjectId;

  behaviouralFactorId?: Types.ObjectId;

  selectedLevel: number;

  assessedLevel?: number;

  assessedAt?: Date;

  assessedBy?: Types.ObjectId;

  resultLocked: boolean;

  evidence?: string;

  attachments: IEvidenceAttachment[];

  confidence: SelfAssessmentConfidence;

  createdAt: Date;

  updatedAt: Date;
}

const SelfAssessmentResponseSchema =
  new Schema<ISelfAssessmentResponse>(
    {
      organizationId: {
        type: Schema.Types.ObjectId,
        ref: "Organization",
        index: true
      },

      selfAssessmentId: {
        type: Schema.Types.ObjectId,
        ref: "SelfAssessment",
        required: true,
        index: true
      },

      skillId: {
        type: Schema.Types.ObjectId,
        ref: "Skill",
        index: true
      },

      behaviouralFactorId: {
        type: Schema.Types.ObjectId,
        ref: "BehaviouralFactor",
        index: true
      },

      selectedLevel: {
        type: Number,
        required: true,
        min: 1,
        max: 10
      },

      assessedLevel: {
        type: Number,
        min: 1,
        max: 10,
      },

      assessedAt: {
        type: Date,
      },

      assessedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
      },

      resultLocked: {
        type: Boolean,
        default: false,
        required: true,
      },

      evidence: {
        type: String,
        trim: true,
        maxlength: 5000
      },

      attachments: {
        type: [
          {
            key: {
              type: String,
              required: true
            },
            filename: {
              type: String,
              required: true,
              trim: true,
              maxlength: 255
            },
            mimeType: {
              type: String,
              required: true,
              trim: true
            },
            size: {
              type: Number,
              required: true,
              min: 0
            },
            uploadedAt: {
              type: Date,
              required: true,
              default: () => new Date()
            },
            uploadedBy: {
              type: Schema.Types.ObjectId,
              ref: "User",
              required: true
            }
          }
        ],
        default: [],
        validate: {
          validator: (value: unknown[]) => value.length <= 5,
          message: "A response cannot have more than 5 evidence attachments"
        }
      },

      confidence: {
        type: String,
        enum: Object.values(
          SelfAssessmentConfidence
        ),
        default:
          SelfAssessmentConfidence.MEDIUM,
        required: true
      }
    },
    {
      timestamps: true
    }
  );

/*
 * Every response must belong to exactly one competency.
 */
SelfAssessmentResponseSchema.pre(
  "validate",
  function (next) {
    const hasSkill =
      Boolean(this.skillId);

    const hasBehaviouralFactor =
      Boolean(this.behaviouralFactorId);

    if (
      hasSkill ===
      hasBehaviouralFactor
    ) {
      return next(
        new Error(
          "A self-assessment response must contain exactly one of skillId or behaviouralFactorId"
        )
      );
    }

    next();
  }
);

SelfAssessmentResponseSchema.index(
  {
    selfAssessmentId: 1,
    skillId: 1
  },
  {
    unique: true,
    partialFilterExpression: {
      skillId: {
        $exists: true
      }
    }
  }
);

SelfAssessmentResponseSchema.index(
  {
    selfAssessmentId: 1,
    behaviouralFactorId: 1
  },
  {
    unique: true,
    partialFilterExpression: {
      behaviouralFactorId: {
        $exists: true
      }
    }
  }
);

export const SelfAssessmentResponse =
  mongoose.model<ISelfAssessmentResponse>(
    "SelfAssessmentResponse",
    SelfAssessmentResponseSchema
  );

export default SelfAssessmentResponse;