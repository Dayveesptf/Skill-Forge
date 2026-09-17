import mongoose, { Document, Schema, Types } from "mongoose";

export enum AssessmentQuestionType {
  SINGLE_CHOICE = "SINGLE_CHOICE",
  MULTIPLE_CHOICE = "MULTIPLE_CHOICE",
  TRUE_FALSE = "TRUE_FALSE",
  SCENARIO = "SCENARIO",
  TECHNICAL = "TECHNICAL",
  BEHAVIOURAL = "BEHAVIOURAL"
}

export enum QuestionDifficulty {
  EASY = "EASY",
  MEDIUM = "MEDIUM",
  HARD = "HARD"
}

export interface IQuestionOption {
  key: string;
  text: string;
  score: number;
  isCorrect?: boolean;
}

export interface IAssessmentQuestion extends Document {
  assessmentId: Types.ObjectId;
  sectionId?: Types.ObjectId;

  frameworkVersionId: Types.ObjectId;

  skillId?: Types.ObjectId;
  behaviouralFactorId?: Types.ObjectId;

  question: string;
  scenario?: string;

  type: AssessmentQuestionType;
  difficulty: QuestionDifficulty;

  level?: number;

  options: IQuestionOption[];

  explanation?: string;

  guidance?: string;

  weight: number;

  order: number;

  isRequired: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const questionOptionSchema = new Schema<IQuestionOption>(
  {
    key: {
      type: String,
      required: true,
      trim: true,
      uppercase: true
    },

    text: {
      type: String,
      required: true,
      trim: true
    },

    score: {
      type: Number,
      required: true,
      min: 0
    },

    isCorrect: {
      type: Boolean,
      default: false
    }
  },
  {
    _id: false
  }
);

const assessmentQuestionSchema =
  new Schema<IAssessmentQuestion>(
    {
      assessmentId: {
        type: Schema.Types.ObjectId,
        ref: "Assessment",
        required: true,
        index: true
      },

      sectionId: {
        type: Schema.Types.ObjectId,
        ref: "AssessmentSection"
      },

      frameworkVersionId: {
        type: Schema.Types.ObjectId,
        ref: "FrameworkVersion",
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

      question: {
        type: String,
        required: true,
        trim: true,
        minlength: 5,
        maxlength: 5000
      },

      scenario: {
        type: String,
        trim: true,
        maxlength: 10000
      },

      type: {
        type: String,
        enum: Object.values(AssessmentQuestionType),
        required: true
      },

      difficulty: {
        type: String,
        enum: Object.values(QuestionDifficulty),
        required: true,
        default: QuestionDifficulty.MEDIUM
      },

      level: {
        type: Number,
        min: 1,
        max: 10
      },

      options: {
        type: [questionOptionSchema],
        default: []
      },

      explanation: {
        type: String,
        trim: true,
        maxlength: 5000
      },

      guidance: {
        type: String,
        trim: true,
        maxlength: 5000
      },

      weight: {
        type: Number,
        required: true,
        min: 0.1,
        max: 100,
        default: 1
      },

      order: {
        type: Number,
        required: true,
        min: 1
      },

      isRequired: {
        type: Boolean,
        default: true
      }
    },
    {
      timestamps: true
    }
  );

assessmentQuestionSchema.index({
  assessmentId: 1,
  order: 1
});

assessmentQuestionSchema.index({
  assessmentId: 1,
  sectionId: 1
});

assessmentQuestionSchema.pre(
  "validate",
  function (next) {
    const question = this as IAssessmentQuestion;

    if (!question.skillId && !question.behaviouralFactorId) {
      return next(
        new Error(
          "A question must be mapped to either a skill or behavioural factor"
        )
      );
    }

    if (
      question.skillId &&
      question.behaviouralFactorId
    ) {
      return next(
        new Error(
          "A question cannot be mapped to both a skill and behavioural factor"
        )
      );
    }

    const choiceBasedTypes = [
      AssessmentQuestionType.SINGLE_CHOICE,
      AssessmentQuestionType.MULTIPLE_CHOICE,
      AssessmentQuestionType.TRUE_FALSE
    ];

    if (
      choiceBasedTypes.includes(question.type) &&
      question.options.length < 2
    ) {
      return next(
        new Error(
          "Choice-based questions must have at least two options"
        )
      );
    }

    next();
  }
);

export const AssessmentQuestion =
  mongoose.model<IAssessmentQuestion>(
    "AssessmentQuestion",
    assessmentQuestionSchema
  );