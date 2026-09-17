import mongoose, {
  Document,
  Schema,
  Types,
} from "mongoose";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type LearningResourceCompetencyType =
  | "SKILL"
  | "BEHAVIOURAL_FACTOR";

export type LearningResourceType =
  | "COURSE"
  | "ARTICLE"
  | "VIDEO"
  | "DOCUMENT"
  | "CERTIFICATION"
  | "OTHER";

export interface ILearningResource extends Document {
  organizationId?: Types.ObjectId;

  competencyType: LearningResourceCompetencyType;
  competencyId: Types.ObjectId;

  title: string;
  description?: string;

  url: string;

  provider?: string;

  resourceType: LearningResourceType;

  targetLevel: number;

  isActive: boolean;

  createdBy: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

/* -------------------------------------------------------------------------- */
/* Schema                                                                     */
/* -------------------------------------------------------------------------- */

const LearningResourceSchema =
  new Schema<ILearningResource>(
    {
      /*
       * Optional organization scope.
       *
       * If undefined, the resource is considered
       * a platform/global resource.
       */
      organizationId: {
        type: Schema.Types.ObjectId,
        ref: "Organization",
        index: true,
      },

      /*
       * The competency that this resource helps develop.
       */
      competencyType: {
        type: String,
        enum: [
          "SKILL",
          "BEHAVIOURAL_FACTOR",
        ],
        required: true,
        index: true,
      },

      competencyId: {
        type: Schema.Types.ObjectId,
        required: true,
        index: true,
      },

      title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200,
      },

      description: {
        type: String,
        trim: true,
        maxlength: 2000,
      },

      url: {
        type: String,
        required: true,
        trim: true,
        maxlength: 2000,
      },

      provider: {
        type: String,
        trim: true,
        maxlength: 150,
      },

      resourceType: {
        type: String,
        enum: [
          "COURSE",
          "ARTICLE",
          "VIDEO",
          "DOCUMENT",
          "CERTIFICATION",
          "OTHER",
        ],
        required: true,
        default: "OTHER",
      },

      /*
       * The competency level this resource is intended
       * to help the learner reach.
       */
      targetLevel: {
        type: Number,
        required: true,
        min: 1,
        max: 10,
      },

      isActive: {
        type: Boolean,
        default: true,
        index: true,
      },

      createdBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    },
    {
      timestamps: true,
    },
  );

/* -------------------------------------------------------------------------- */
/* Indexes                                                                    */
/* -------------------------------------------------------------------------- */

LearningResourceSchema.index({
  competencyType: 1,
  competencyId: 1,
  targetLevel: 1,
});

LearningResourceSchema.index({
  organizationId: 1,
  competencyType: 1,
  competencyId: 1,
  isActive: 1,
});

export const LearningResource =
  mongoose.model<ILearningResource>(
    "LearningResource",
    LearningResourceSchema,
  );

export default LearningResource;