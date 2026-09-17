import mongoose, {
  Document,
  Schema,
  Types
} from "mongoose";

export enum CareerPathChangeType {
  ADDED = "ADDED",
  INCREASED = "INCREASED",
  UNCHANGED = "UNCHANGED",
  DECREASED = "DECREASED",
  REMOVED = "REMOVED"
}

export interface ICareerPathSkillDelta {
  skillId: Types.ObjectId;

  sourceLevel?: number;
  targetLevel?: number;

  delta: number;

  changeType: CareerPathChangeType;
}

export interface ICareerPathBehaviouralDelta {
  behaviouralFactorId: Types.ObjectId;

  sourceLevel?: number;
  targetLevel?: number;

  delta: number;

  changeType: CareerPathChangeType;
}

export interface ICareerPath extends Document {
  organizationId: Types.ObjectId;

  sourceRoleProfileId: Types.ObjectId;
  targetRoleProfileId: Types.ObjectId;

  name?: string;
  description?: string;

  skillDeltas: ICareerPathSkillDelta[];

  behaviouralFactorDeltas:
    ICareerPathBehaviouralDelta[];

  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const CareerPathSkillDeltaSchema =
  new Schema<ICareerPathSkillDelta>(
    {
      skillId: {
        type: Schema.Types.ObjectId,
        ref: "Skill",
        required: true
      },

      sourceLevel: {
        type: Number,
        min: 1,
        max: 10
      },

      targetLevel: {
        type: Number,
        min: 1,
        max: 10
      },

      delta: {
        type: Number,
        required: true
      },

      changeType: {
        type: String,
        enum: Object.values(
          CareerPathChangeType
        ),
        required: true
      }
    },
    {
      _id: false
    }
  );

const CareerPathBehaviouralDeltaSchema =
  new Schema<ICareerPathBehaviouralDelta>(
    {
      behaviouralFactorId: {
        type: Schema.Types.ObjectId,
        ref: "BehaviouralFactor",
        required: true
      },

      sourceLevel: {
        type: Number,
        min: 1,
        max: 10
      },

      targetLevel: {
        type: Number,
        min: 1,
        max: 10
      },

      delta: {
        type: Number,
        required: true
      },

      changeType: {
        type: String,
        enum: Object.values(
          CareerPathChangeType
        ),
        required: true
      }
    },
    {
      _id: false
    }
  );

const CareerPathSchema =
  new Schema<ICareerPath>(
    {
      organizationId: {
        type: Schema.Types.ObjectId,
        ref: "Organization",
        required: true,
        index: true
      },

      sourceRoleProfileId: {
        type: Schema.Types.ObjectId,
        ref: "RoleProfile",
        required: true,
        index: true
      },

      targetRoleProfileId: {
        type: Schema.Types.ObjectId,
        ref: "RoleProfile",
        required: true,
        index: true
      },

      name: {
        type: String,
        trim: true,
        maxlength: 150
      },

      description: {
        type: String,
        trim: true,
        maxlength: 2000
      },

      skillDeltas: {
        type: [CareerPathSkillDeltaSchema],
        default: []
      },

      behaviouralFactorDeltas: {
        type: [
          CareerPathBehaviouralDeltaSchema
        ],
        default: []
      },

      createdBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
      },

      updatedBy: {
        type: Schema.Types.ObjectId,
        ref: "User"
      }
    },
    {
      timestamps: true
    }
  );

CareerPathSchema.index(
  {
    organizationId: 1,
    sourceRoleProfileId: 1,
    targetRoleProfileId: 1
  },
  {
    unique: true
  }
);

export const CareerPath =
  mongoose.model<ICareerPath>(
    "CareerPath",
    CareerPathSchema
  );

export default CareerPath;