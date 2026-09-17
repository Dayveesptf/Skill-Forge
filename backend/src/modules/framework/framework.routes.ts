import { Router } from "express";
import { z } from "zod";

import {
  authenticate,
  authorize,
} from "../../middleware/auth";

import { UserRole } from "../../constants/roles";

import {
  createFactor,
  createFramework,
  createFrameworkSkill,
  createFrameworkSkillLevel,
  createPrompt,
  createTemplate,
  getFactors,
  getFramework,
  getFrameworks,
  getFrameworkSkills,
  getPrompts,
  getSkillLevels,
  getTemplates,
  overview,
  updateFramework,
} from "./framework.controller";

const router = Router();

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

const frameworkSchema = z.object({
  organizationId: z.string().optional(),
  name: z.string().min(2),
  version: z.string().min(1),
  description: z.string().optional(),
});

const frameworkUpdateSchema = z.object({
  name: z.string().min(2).optional(),

  description:
    z.string().optional(),

  status: z.enum([
    "DRAFT",
    "ACTIVE",
    "ARCHIVED",
  ]).optional(),

  effectiveFrom:
    z.coerce.date().optional(),

  effectiveTo:
    z.coerce.date().optional(),
});

const skillSchema = z.object({
  organizationId:
    z.string().optional(),

  frameworkVersionId:
    z.string(),

  name:
    z.string().min(2),

  description:
    z.string().optional(),

  category: z.enum([
    "TECHNICAL",
    "FUNCTIONAL",
    "SOFT_SKILL",
    "LEADERSHIP",
    "DOMAIN",
  ]),
});

const skillLevelSchema = z.object({
  level:
    z.number().int().min(1).max(10),

  name:
    z.string().min(1),

  description:
    z.string().optional(),

  behaviours:
    z.array(z.string()).optional(),
});

const behaviouralFactorSchema =
  z.object({
    organizationId:
      z.string().optional(),

    frameworkVersionId:
      z.string(),

    name:
      z.string().min(2),

    description:
      z.string().optional(),

    indicators:
      z.array(z.string()).optional(),
  });

const evidencePromptSchema =
  z.object({
    organizationId:
      z.string().optional(),

    skillId:
      z.string().optional(),

    behaviouralFactorId:
      z.string().optional(),

    prompt:
      z.string().min(5),

    evidenceType: z.enum([
      "EXAMPLE",
      "SCENARIO",
      "PROJECT",
      "BEHAVIOURAL",
      "TECHNICAL",
    ]),

    minimumLevel:
      z.number().int().min(1).max(10).optional(),

    maximumLevel:
      z.number().int().min(1).max(10).optional(),

    guidance:
      z.string().optional(),
  });

const templateSchema = z.object({
  organizationId:
    z.string().optional(),

  name:
    z.string().min(2),

  industry:
    z.string().min(2),

  description:
    z.string().optional(),

  skills: z.array(
    z.object({
      skillId:
        z.string(),

      weight:
        z.number().min(0).max(100),
    })
  ).optional(),

  behaviouralFactors: z.array(
    z.object({
      behaviouralFactorId:
        z.string(),

      weight:
        z.number().min(0).max(100),
    })
  ).optional(),

  isSystemTemplate:
    z.boolean().optional(),
});

/* -------------------------------------------------------------------------- */
/* Middleware                                                                 */
/* -------------------------------------------------------------------------- */

router.use(authenticate);

/* -------------------------------------------------------------------------- */
/* Industry Templates                                                         */
/*                                                                            */
/* NOTE: these literal routes MUST be registered before the parameterised     */
/* "/:id" framework routes below. Express matches top-down, so declaring      */
/* them later would make GET /frameworks/industry-templates resolve to        */
/* getFramework with id = "industry-templates".                               */
/* -------------------------------------------------------------------------- */

router.post(
  "/industry-templates",
  authorize(
    UserRole.PLATFORM_ADMIN,
    UserRole.ORGANIZATION_ADMIN
  ),
  (req, _res, next) => {
    try {
      templateSchema.parse(
        req.body
      );

      next();
    } catch (error) {
      next(error);
    }
  },
  createTemplate
);

router.get(
  "/industry-templates",
  getTemplates
);

/* -------------------------------------------------------------------------- */
/* Frameworks                                                                 */
/* -------------------------------------------------------------------------- */

router.post(
  "/",
  authorize(
    UserRole.PLATFORM_ADMIN,
    UserRole.ORGANIZATION_ADMIN
  ),
  (req, _res, next) => {
    try {
      frameworkSchema.parse(
        req.body
      );

      next();
    } catch (error) {
      next(error);
    }
  },
  createFramework
);

router.get(
  "/",
  getFrameworks
);

router.get(
  "/:id",
  getFramework
);

router.patch(
  "/:id",
  authorize(
    UserRole.PLATFORM_ADMIN,
    UserRole.ORGANIZATION_ADMIN
  ),
  (req, _res, next) => {
    try {
      frameworkUpdateSchema.parse(
        req.body
      );

      next();
    } catch (error) {
      next(error);
    }
  },
  updateFramework
);

/* -------------------------------------------------------------------------- */
/* Skills                                                                     */
/* -------------------------------------------------------------------------- */

router.post(
  "/:frameworkId/skills",
  authorize(
    UserRole.PLATFORM_ADMIN,
    UserRole.ORGANIZATION_ADMIN
  ),
  (req, _res, next) => {
    try {
      skillSchema.parse({
        ...req.body,
        frameworkVersionId:
          req.params.frameworkId,
      });

      next();
    } catch (error) {
      next(error);
    }
  },
  createFrameworkSkill
);

router.get(
  "/:frameworkId/skills",
  getFrameworkSkills
);

/* -------------------------------------------------------------------------- */
/* Skill Levels                                                               */
/* -------------------------------------------------------------------------- */

router.post(
  "/:frameworkId/skills/:skillId/levels",
  authorize(
    UserRole.PLATFORM_ADMIN,
    UserRole.ORGANIZATION_ADMIN
  ),
  (req, _res, next) => {
    try {
      skillLevelSchema.parse(
        req.body
      );

      next();
    } catch (error) {
      next(error);
    }
  },
  createFrameworkSkillLevel
);

router.get(
  "/:frameworkId/skills/:skillId/levels",
  getSkillLevels
);

/* -------------------------------------------------------------------------- */
/* Behavioural Factors                                                        */
/* -------------------------------------------------------------------------- */

router.post(
  "/:frameworkId/behavioural-factors",
  authorize(
    UserRole.PLATFORM_ADMIN,
    UserRole.ORGANIZATION_ADMIN
  ),
  (req, _res, next) => {
    try {
      behaviouralFactorSchema.parse({
        ...req.body,
        frameworkVersionId:
          req.params.frameworkId,
      });

      next();
    } catch (error) {
      next(error);
    }
  },
  createFactor
);

router.get(
  "/:frameworkId/behavioural-factors",
  getFactors
);

/* -------------------------------------------------------------------------- */
/* Evidence Prompts                                                           */
/* -------------------------------------------------------------------------- */

router.post(
  "/:frameworkId/evidence-prompts",
  authorize(
    UserRole.PLATFORM_ADMIN,
    UserRole.ORGANIZATION_ADMIN
  ),
  (req, _res, next) => {
    try {
      evidencePromptSchema.parse(
        req.body
      );

      next();
    } catch (error) {
      next(error);
    }
  },
  createPrompt
);

router.get(
  "/:frameworkId/evidence-prompts",
  getPrompts
);

/* -------------------------------------------------------------------------- */
/* Overview                                                                   */
/* -------------------------------------------------------------------------- */

router.get(
  "/:frameworkId/overview",
  overview
);

export default router;