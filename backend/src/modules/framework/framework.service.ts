import mongoose from "mongoose";

import { FrameworkVersion } from "../../models/FrameworkVersion";
import { Skill } from "../../models/Skill";
import { SkillLevel } from "../../models/SkillLevel";
import { BehaviouralFactor } from "../../models/BehaviouralFactor";
import { EvidencePrompt } from "../../models/EvidencePrompt";
import { IndustryTemplate } from "../../models/IndustryTemplate";

import { slugify } from "../../utils/slug";
import { cached, invalidateCache } from "../../config/redis";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function validateObjectId(
  value: string,
  field: string
): void {
  if (!mongoose.isValidObjectId(value)) {
    throw new Error(`Invalid ${field}`);
  }
}

/**
 * Builds an organization filter.
 *
 * When organizationId is provided, resources must belong
 * to that organization.
 *
 * When it is not provided, only global resources are returned.
 */
function organizationFilter(
  organizationId?: string
): Record<string, unknown> {
  if (organizationId) {
    validateObjectId(
      organizationId,
      "organizationId"
    );

    return {
      organizationId,
    };
  }

  return {
    organizationId: {
      $exists: false,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Framework Versions                                                         */
/* -------------------------------------------------------------------------- */

export async function createFrameworkVersion(
  data: {
    organizationId?: string;
    name: string;
    version: string;
    description?: string;
    createdBy: string;
  }
) {
  validateObjectId(
    data.createdBy,
    "createdBy"
  );

  if (data.organizationId) {
    validateObjectId(
      data.organizationId,
      "organizationId"
    );
  }

  const existing =
    await FrameworkVersion.findOne({
      organizationId: data.organizationId,
      version: data.version,
    });

  if (existing) {
    throw new Error(
      "This framework version already exists"
    );
  }

  return FrameworkVersion.create({
    organizationId:
      data.organizationId,
    name: data.name,
    version: data.version,
    description:
      data.description,
    createdBy:
      data.createdBy,
  });
}

export async function listFrameworkVersions(
  organizationId?: string
) {
  return FrameworkVersion.find(
    organizationFilter(
      organizationId
    )
  )
    .populate(
      "createdBy",
      "firstName lastName email"
    )
    .sort({
      createdAt: -1,
    });
}

export async function getFrameworkVersion(
  frameworkVersionId: string,
  organizationId?: string
) {
  validateObjectId(
    frameworkVersionId,
    "frameworkVersionId"
  );

  return FrameworkVersion.findOne({
    _id: frameworkVersionId,
    ...organizationFilter(
      organizationId
    ),
  }).populate(
    "createdBy",
    "firstName lastName email"
  );
}

export async function updateFrameworkVersion(
  frameworkVersionId: string,
  data: Partial<{
    name: string;
    description: string;
    status:
      | "DRAFT"
      | "ACTIVE"
      | "ARCHIVED";
    effectiveFrom: Date;
    effectiveTo: Date;
  }>,
  organizationId?: string
) {
  validateObjectId(
    frameworkVersionId,
    "frameworkVersionId"
  );

  const framework =
    await FrameworkVersion.findOne({
      _id: frameworkVersionId,
      ...organizationFilter(
        organizationId
      ),
    });

  if (!framework) {
    return null;
  }

  Object.assign(
    framework,
    data
  );

  await framework.save();

  return framework;
}

/* -------------------------------------------------------------------------- */
/* Skills                                                                     */
/* -------------------------------------------------------------------------- */

export async function createSkill(
  data: {
    organizationId?: string;
    frameworkVersionId: string;
    name: string;
    description?: string;
    category:
      | "TECHNICAL"
      | "FUNCTIONAL"
      | "SOFT_SKILL"
      | "LEADERSHIP"
      | "DOMAIN";
  }
) {
  validateObjectId(
    data.frameworkVersionId,
    "frameworkVersionId"
  );

  if (data.organizationId) {
    validateObjectId(
      data.organizationId,
      "organizationId"
    );
  }

  const framework =
    await FrameworkVersion.findOne({
      _id: data.frameworkVersionId,
      ...organizationFilter(
        data.organizationId
      ),
    });

  if (!framework) {
    throw new Error(
      "Framework version not found"
    );
  }

  const skill = await Skill.create({
    organizationId:
      data.organizationId,
    frameworkVersionId:
      data.frameworkVersionId,
    name: data.name,
    slug: slugify(data.name),
    description:
      data.description,
    category:
      data.category,
  });

  await invalidateCache(
    `framework:${data.frameworkVersionId}:skills:${data.organizationId || "platform"}`
  );

  return skill;
}

export async function listSkills(
  frameworkVersionId: string,
  organizationId?: string
) {
  validateObjectId(
    frameworkVersionId,
    "frameworkVersionId"
  );

  const cacheKey = `framework:${frameworkVersionId}:skills:${organizationId || "platform"}`;

  return cached(cacheKey, 300, async () => {
    const framework =
      await FrameworkVersion.findOne({
        _id: frameworkVersionId,
        ...organizationFilter(
          organizationId
        ),
      }).select("_id");

    if (!framework) {
      throw new Error(
        "Framework version not found"
      );
    }

    return Skill.find({
      frameworkVersionId,
      ...organizationFilter(
        organizationId
      ),
      isActive: true,
    }).sort({
      category: 1,
      name: 1,
    });
  });
}

/* -------------------------------------------------------------------------- */
/* Skill Levels                                                               */
/* -------------------------------------------------------------------------- */

export async function createSkillLevel(
  data: {
    organizationId?: string;
    frameworkVersionId: string;
    skillId: string;
    level: number;
    name: string;
    description?: string;
    behaviours?: string[];
  }
) {
  validateObjectId(
    data.frameworkVersionId,
    "frameworkVersionId"
  );

  validateObjectId(
    data.skillId,
    "skillId"
  );

  if (data.organizationId) {
    validateObjectId(
      data.organizationId,
      "organizationId"
    );
  }

  const framework =
    await FrameworkVersion.findOne({
      _id: data.frameworkVersionId,
      ...organizationFilter(
        data.organizationId
      ),
    }).select("_id");

  if (!framework) {
    throw new Error(
      "Framework version not found"
    );
  }

  const skill =
    await Skill.findOne({
      _id: data.skillId,
      frameworkVersionId:
        data.frameworkVersionId,
      ...organizationFilter(
        data.organizationId
      ),
      isActive: true,
    });

  if (!skill) {
    throw new Error(
      "Skill does not belong to this framework version"
    );
  }

  return SkillLevel.create({
    frameworkVersionId:
      data.frameworkVersionId,
    skillId:
      data.skillId,
    level:
      data.level,
    name:
      data.name,
    description:
      data.description,
    behaviours:
      data.behaviours || [],
  });
}

export async function listSkillLevels(
  skillId: string,
  frameworkVersionId: string,
  organizationId?: string
) {
  validateObjectId(
    skillId,
    "skillId"
  );

  validateObjectId(
    frameworkVersionId,
    "frameworkVersionId"
  );

  const skill =
    await Skill.findOne({
      _id: skillId,
      frameworkVersionId,
      ...organizationFilter(
        organizationId
      ),
      isActive: true,
    }).select("_id");

  if (!skill) {
    throw new Error(
      "Skill not found"
    );
  }

  return SkillLevel.find({
    skillId,
    frameworkVersionId,
  }).sort({
    level: 1,
  });
}

/* -------------------------------------------------------------------------- */
/* Behavioural Factors                                                        */
/* -------------------------------------------------------------------------- */

export async function createBehaviouralFactor(
  data: {
    organizationId?: string;
    frameworkVersionId: string;
    name: string;
    description?: string;
    indicators?: string[];
  }
) {
  validateObjectId(
    data.frameworkVersionId,
    "frameworkVersionId"
  );

  if (data.organizationId) {
    validateObjectId(
      data.organizationId,
      "organizationId"
    );
  }

  const framework =
    await FrameworkVersion.findOne({
      _id: data.frameworkVersionId,
      ...organizationFilter(
        data.organizationId
      ),
    }).select("_id");

  if (!framework) {
    throw new Error(
      "Framework version not found"
    );
  }

  const factor = await BehaviouralFactor.create({
    organizationId:
      data.organizationId,
    frameworkVersionId:
      data.frameworkVersionId,
    name:
      data.name,
    slug:
      slugify(data.name),
    description:
      data.description,
    indicators:
      data.indicators || [],
  });

  await invalidateCache(
    `framework:${data.frameworkVersionId}:behavioural-factors:${data.organizationId || "platform"}`
  );

  return factor;
}

export async function listBehaviouralFactors(
  frameworkVersionId: string,
  organizationId?: string
) {
  validateObjectId(
    frameworkVersionId,
    "frameworkVersionId"
  );

  const cacheKey = `framework:${frameworkVersionId}:behavioural-factors:${organizationId || "platform"}`;

  return cached(cacheKey, 300, async () => {
    const framework =
      await FrameworkVersion.findOne({
        _id: frameworkVersionId,
        ...organizationFilter(
          organizationId
        ),
      }).select("_id");

    if (!framework) {
      throw new Error(
        "Framework version not found"
      );
    }

    return BehaviouralFactor.find({
      frameworkVersionId,
      ...organizationFilter(
        organizationId
      ),
      isActive: true,
    }).sort({
      name: 1,
    });
  });
}

/* -------------------------------------------------------------------------- */
/* Evidence Prompts                                                           */
/* -------------------------------------------------------------------------- */

export async function createEvidencePrompt(
  data: {
    organizationId?: string;
    frameworkVersionId: string;
    skillId?: string;
    behaviouralFactorId?: string;
    prompt: string;
    evidenceType:
      | "EXAMPLE"
      | "SCENARIO"
      | "PROJECT"
      | "BEHAVIOURAL"
      | "TECHNICAL";
    minimumLevel?: number;
    maximumLevel?: number;
    guidance?: string;
  }
) {
  validateObjectId(
    data.frameworkVersionId,
    "frameworkVersionId"
  );

  if (
    !data.skillId &&
    !data.behaviouralFactorId
  ) {
    throw new Error(
      "An evidence prompt must reference a skill or behavioural factor"
    );
  }

  if (data.organizationId) {
    validateObjectId(
      data.organizationId,
      "organizationId"
    );
  }

  const framework =
    await FrameworkVersion.findOne({
      _id: data.frameworkVersionId,
      ...organizationFilter(
        data.organizationId
      ),
    }).select("_id");

  if (!framework) {
    throw new Error(
      "Framework version not found"
    );
  }

  if (data.skillId) {
    validateObjectId(
      data.skillId,
      "skillId"
    );

    const skill =
      await Skill.findOne({
        _id: data.skillId,
        frameworkVersionId:
          data.frameworkVersionId,
        ...organizationFilter(
          data.organizationId
        ),
        isActive: true,
      }).select("_id");

    if (!skill) {
      throw new Error(
        "Skill does not belong to this framework"
      );
    }
  }

  if (data.behaviouralFactorId) {
    validateObjectId(
      data.behaviouralFactorId,
      "behaviouralFactorId"
    );

    const factor =
      await BehaviouralFactor.findOne({
        _id:
          data.behaviouralFactorId,
        frameworkVersionId:
          data.frameworkVersionId,
        ...organizationFilter(
          data.organizationId
        ),
        isActive: true,
      }).select("_id");

    if (!factor) {
      throw new Error(
        "Behavioural factor does not belong to this framework"
      );
    }
  }

  return EvidencePrompt.create(
    data
  );
}

export async function listEvidencePrompts(
  frameworkVersionId: string,
  organizationId?: string
) {
  validateObjectId(
    frameworkVersionId,
    "frameworkVersionId"
  );

  const framework =
    await FrameworkVersion.findOne({
      _id: frameworkVersionId,
      ...organizationFilter(
        organizationId
      ),
    }).select("_id");

  if (!framework) {
    throw new Error(
      "Framework version not found"
    );
  }

  return EvidencePrompt.find({
    frameworkVersionId,
    ...organizationFilter(
      organizationId
    ),
    isActive: true,
  })
    .populate(
      "skillId",
      "name category"
    )
    .populate(
      "behaviouralFactorId",
      "name"
    )
    .sort({
      createdAt: -1,
    });
}

/* -------------------------------------------------------------------------- */
/* Industry Templates                                                         */
/* -------------------------------------------------------------------------- */

export async function createIndustryTemplate(
  data: {
    organizationId?: string;
    name: string;
    industry: string;
    description?: string;
    skills?: Array<{
      skillId: string;
      weight: number;
    }>;
    behaviouralFactors?: Array<{
      behaviouralFactorId: string;
      weight: number;
    }>;
    isSystemTemplate?: boolean;
  }
) {
  if (data.organizationId) {
    validateObjectId(
      data.organizationId,
      "organizationId"
    );
  }

  return IndustryTemplate.create({
    organizationId:
      data.organizationId,
    name:
      data.name,
    slug:
      slugify(data.name),
    industry:
      data.industry,
    description:
      data.description,
    skills:
      data.skills || [],
    behaviouralFactors:
      data.behaviouralFactors || [],
    isSystemTemplate:
      data.isSystemTemplate ?? false,
  });
}

export async function listIndustryTemplates(
  organizationId?: string
) {
  const filters: Record<
    string,
    unknown
  > = {
    isActive: true,
  };

  if (organizationId) {
    validateObjectId(
      organizationId,
      "organizationId"
    );

    filters.$or = [
      {
        organizationId,
      },
      {
        isSystemTemplate: true,
        organizationId: {
          $exists: false,
        },
      },
    ];
  } else {
    filters.isSystemTemplate = true;
    filters.organizationId = {
      $exists: false,
    };
  }

  return IndustryTemplate.find(
    filters
  )
    .populate(
      "skills.skillId",
      "name category"
    )
    .populate(
      "behaviouralFactors.behaviouralFactorId",
      "name"
    )
    .sort({
      industry: 1,
      name: 1,
    });
}

/* -------------------------------------------------------------------------- */
/* Framework Overview                                                         */
/* -------------------------------------------------------------------------- */

export async function getFrameworkOverview(
  frameworkVersionId: string,
  organizationId?: string
) {
  validateObjectId(
    frameworkVersionId,
    "frameworkVersionId"
  );

  const framework =
    await FrameworkVersion.findOne({
      _id: frameworkVersionId,
      ...organizationFilter(
        organizationId
      ),
    });

  if (!framework) {
    throw new Error(
      "Framework version not found"
    );
  }

  const [
    skills,
    behaviouralFactors,
    evidencePrompts,
  ] = await Promise.all([
    Skill.countDocuments({
      frameworkVersionId,
      ...organizationFilter(
        organizationId
      ),
      isActive: true,
    }),

    BehaviouralFactor.countDocuments({
      frameworkVersionId,
      ...organizationFilter(
        organizationId
      ),
      isActive: true,
    }),

    EvidencePrompt.countDocuments({
      frameworkVersionId,
      ...organizationFilter(
        organizationId
      ),
      isActive: true,
    }),
  ]);

  return {
    framework,
    counts: {
      skills,
      behaviouralFactors,
      evidencePrompts,
    },
  };
}