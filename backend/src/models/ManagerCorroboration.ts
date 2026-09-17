import mongoose, {
  Document,
  Schema,
} from "mongoose";

/* -------------------------------------------------------------------------- */
/* Enums                                                                      */
/* -------------------------------------------------------------------------- */

export enum ManagerCorroborationStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
}

export enum ManagerCorroborationDecision {
  CONFIRMED = "CONFIRMED",
  ADJUSTED = "ADJUSTED",
}

/* -------------------------------------------------------------------------- */
/* Decision                                                                   */
/* -------------------------------------------------------------------------- */

export interface IManagerCorroborationDecision {
  responseId: mongoose.Types.ObjectId;

  competencyType:
    | "SKILL"
    | "BEHAVIOURAL_FACTOR";

  competencyId:
    mongoose.Types.ObjectId;

  selfAssessmentLevel: number;

  finalLevel: number;

  decision:
    | ManagerCorroborationDecision.CONFIRMED
    | ManagerCorroborationDecision.ADJUSTED;

  justification?: string;
}

/* -------------------------------------------------------------------------- */
/* Model                                                                      */
/* -------------------------------------------------------------------------- */

export interface IManagerCorroboration
  extends Document {
  selfAssessmentId:
    mongoose.Types.ObjectId;

  candidateId:
    mongoose.Types.ObjectId;

  managerId:
    mongoose.Types.ObjectId;

  organizationId?:
    mongoose.Types.ObjectId;

  status:
    | ManagerCorroborationStatus.PENDING
    | ManagerCorroborationStatus.COMPLETED;

  decisions: IManagerCorroborationDecision[];

  completedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

/* -------------------------------------------------------------------------- */
/* Decision Schema                                                            */
/* -------------------------------------------------------------------------- */

const decisionSchema =
  new Schema<IManagerCorroborationDecision>(
    {
      responseId: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: "SelfAssessmentResponse",
      },

      competencyType: {
        type: String,
        required: true,
        enum: [
          "SKILL",
          "BEHAVIOURAL_FACTOR",
        ],
      },

      competencyId: {
        type: Schema.Types.ObjectId,
        required: true,
      },

      selfAssessmentLevel: {
        type: Number,
        required: true,
        min: 1,
        max: 10,
      },

      finalLevel: {
        type: Number,
        required: true,
        min: 1,
        max: 10,
      },

      decision: {
        type: String,
        required: true,
        enum: Object.values(
          ManagerCorroborationDecision
        ),
      },

      justification: {
        type: String,
        trim: true,
        maxlength: 5000,
      },
    },
    {
      _id: false,
    }
  );

/* -------------------------------------------------------------------------- */
/* Main Schema                                                                */
/* -------------------------------------------------------------------------- */

const managerCorroborationSchema =
  new Schema<IManagerCorroboration>(
    {
      selfAssessmentId: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: "SelfAssessment",
        unique: true,
        index: true,
      },

      candidateId: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: "User",
        index: true,
      },

      managerId: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: "User",
        index: true,
      },

      organizationId: {
        type: Schema.Types.ObjectId,
        ref: "Organization",
        index: true,
      },

      status: {
        type: String,
        required: true,
        enum: Object.values(
          ManagerCorroborationStatus
        ),
        default:
          ManagerCorroborationStatus.PENDING,
        index: true,
      },

      decisions: {
        type: [decisionSchema],
        default: [],
      },

      completedAt: {
        type: Date,
      },
    },
    {
      timestamps: true,
    }
  );

/* -------------------------------------------------------------------------- */
/* Indexes                                                                    */
/* -------------------------------------------------------------------------- */

managerCorroborationSchema.index({
  managerId: 1,
  status: 1,
  createdAt: -1,
});

managerCorroborationSchema.index({
  candidateId: 1,
  createdAt: -1,
});

managerCorroborationSchema.index({
  organizationId: 1,
  status: 1,
  createdAt: -1,
});

/* -------------------------------------------------------------------------- */
/* Export                                                                     */
/* -------------------------------------------------------------------------- */

export const ManagerCorroboration =
  mongoose.model<IManagerCorroboration>(
    "ManagerCorroboration",
    managerCorroborationSchema
  );