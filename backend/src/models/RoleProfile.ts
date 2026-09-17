import mongoose, {
  Document,
  Schema,
  Types
} from "mongoose";

export enum RoleProfileStatus {
  DRAFT = "DRAFT",
  PUBLISHED = "PUBLISHED",
  ARCHIVED = "ARCHIVED"
}

export interface IRoleProfileSkill {
  skillId: Types.ObjectId;
  targetLevel: number;
  weight: number;
}

export interface IRoleProfileBehaviouralFactor {
  behaviouralFactorId: Types.ObjectId;
  targetLevel: number;
  weight: number;
}

export interface IRoleProfile extends Document {
  organizationId: Types.ObjectId;

  frameworkVersionId: Types.ObjectId;

  industryTemplateId?: Types.ObjectId;

  name: string;
  slug: string;

  description?: string;

  department?: string;

  status: RoleProfileStatus;

  skills: IRoleProfileSkill[];

  behaviouralFactors: IRoleProfileBehaviouralFactor[];

  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;

  publishedAt?: Date;
  archivedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const RoleProfileSkillSchema =
  new Schema<IRoleProfileSkill>(
    {
      skillId: {
        type: Schema.Types.ObjectId,
        ref: "Skill",
        required: true
      },

      targetLevel: {
        type: Number,
        required: true,
        min: 1,
        max: 10
      },

      weight: {
        type: Number,
        required: true,
        min: 0,
        default: 1
      }
    },
    {
      _id: false
    }
  );

const RoleProfileBehaviouralFactorSchema =
  new Schema<IRoleProfileBehaviouralFactor>(
    {
      behaviouralFactorId: {
        type: Schema.Types.ObjectId,
        ref: "BehaviouralFactor",
        required: true
      },

      targetLevel: {
        type: Number,
        required: true,
        min: 1,
        max: 10
      },

      weight: {
        type: Number,
        required: true,
        min: 0,
        default: 1
      }
    },
    {
      _id: false
    }
  );

const RoleProfileSchema =
  new Schema<IRoleProfile>(
    {
      organizationId: {
        type: Schema.Types.ObjectId,
        ref: "Organization",
        required: true,
        index: true
      },

      frameworkVersionId: {
        type: Schema.Types.ObjectId,
        ref: "FrameworkVersion",
        required: true,
        index: true
      },

      industryTemplateId: {
        type: Schema.Types.ObjectId,
        ref: "IndustryTemplate"
      },

      name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 150
      },

      slug: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
      },

      description: {
        type: String,
        trim: true,
        maxlength: 2000
      },

      department: {
        type: String,
        trim: true,
        maxlength: 150
      },

      status: {
        type: String,
        enum: Object.values(RoleProfileStatus),
        default: RoleProfileStatus.DRAFT,
        required: true,
        index: true
      },

      skills: {
        type: [RoleProfileSkillSchema],
        default: []
      },

      behaviouralFactors: {
        type: [RoleProfileBehaviouralFactorSchema],
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
      },

      publishedAt: {
        type: Date
      },

      archivedAt: {
        type: Date
      }
    },
    {
      timestamps: true
    }
  );

RoleProfileSchema.index(
  {
    organizationId: 1,
    slug: 1
  },
  {
    unique: true
  }
);

RoleProfileSchema.index({
  organizationId: 1,
  status: 1
});

RoleProfileSchema.index({
  organizationId: 1,
  frameworkVersionId: 1
});

export const RoleProfile =
  mongoose.model<IRoleProfile>(
    "RoleProfile",
    RoleProfileSchema
  );

export default RoleProfile;