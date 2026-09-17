import { Types } from "mongoose";

import {
  FrameworkVersion
} from "../../models/FrameworkVersion";

import {
  Skill
} from "../../models/Skill";

import {
  SkillLevel
} from "../../models/SkillLevel";

import {
  BehaviouralFactor
} from "../../models/BehaviouralFactor";

import {
  IndustryTemplate
} from "../../models/IndustryTemplate";

import {
  RoleProfile,
  RoleProfileStatus,
  IRoleProfileSkill,
  IRoleProfileBehaviouralFactor
} from "../../models/RoleProfile";

import {
  CareerPath,
  CareerPathChangeType,
  ICareerPathSkillDelta,
  ICareerPathBehaviouralDelta
} from "../../models/CareerPath";

function ensureObjectId(
  value: string,
  fieldName: string
): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new Error(
      `${fieldName} is invalid`
    );
  }

  return new Types.ObjectId(value);
}

function normalizeOrganizationId(
  organizationId?: string
): Types.ObjectId | undefined {
  if (!organizationId) {
    return undefined;
  }

  return ensureObjectId(
    organizationId,
    "organizationId"
  );
}

function slugify(
  value: string
): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeLevel(
  value: unknown,
  fieldName: string
): number {
  const level =
    typeof value === "number"
      ? value
      : Number(value);

  if (
    !Number.isInteger(level) ||
    level < 1 ||
    level > 10
  ) {
    throw new Error(
      `${fieldName} must be an integer between 1 and 10`
    );
  }

  return level;
}

function normalizeWeight(
  value: unknown
): number {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return 1;
  }

  const weight = Number(value);

  if (
    !Number.isFinite(weight) ||
    weight < 0
  ) {
    throw new Error(
      "Weight must be a non-negative number"
    );
  }

  return weight;
}

function uniqueIds(
  ids: Types.ObjectId[]
): Types.ObjectId[] {
  const seen = new Set<string>();

  return ids.filter((id) => {
    const key = id.toString();

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);

    return true;
  });
}

async function verifyFramework(
  frameworkVersionId: string,
  organizationId?: Types.ObjectId
) {
  const framework =
    await FrameworkVersion.findById(
      ensureObjectId(
        frameworkVersionId,
        "frameworkVersionId"
      )
    );

  if (!framework) {
    throw new Error(
      "Framework version not found"
    );
  }

  if (
    organizationId &&
    framework.organizationId &&
    framework.organizationId.toString() !==
      organizationId.toString()
  ) {
    throw new Error(
      "Framework does not belong to this organization"
    );
  }

  return framework;
}

async function verifySkills(
  frameworkVersionId: string,
  skills: IRoleProfileSkill[]
) {
  const skillIds = uniqueIds(
    skills.map(
      (item) => item.skillId
    )
  );

  if (skillIds.length === 0) {
    return;
  }

  const skillDocuments =
    await Skill.find({
      _id: {
        $in: skillIds
      },
      frameworkVersionId:
        ensureObjectId(
          frameworkVersionId,
          "frameworkVersionId"
        ),
      isActive: true
    });

  const found =
    new Set(
      skillDocuments.map(
        (skill) =>
          skill._id.toString()
      )
    );

  for (const skillId of skillIds) {
    if (!found.has(skillId.toString())) {
      throw new Error(
        `Skill ${skillId.toString()} does not belong to the selected framework`
      );
    }
  }

  /*
   * Every target level must exist in the
   * framework's skill-level ladder.
   */
  for (const skill of skills) {
    const levelExists =
      await SkillLevel.exists({
        frameworkVersionId:
          ensureObjectId(
            frameworkVersionId,
            "frameworkVersionId"
          ),

        skillId:
          skill.skillId,

        level:
          skill.targetLevel
      });

    if (!levelExists) {
      throw new Error(
        `Level ${skill.targetLevel} does not exist for skill ${skill.skillId.toString()}`
      );
    }
  }
}

async function verifyBehaviouralFactors(
  frameworkVersionId: string,
  factors: IRoleProfileBehaviouralFactor[]
) {
  const factorIds = uniqueIds(
    factors.map(
      (item) =>
        item.behaviouralFactorId
    )
  );

  if (factorIds.length === 0) {
    return;
  }

  const factorDocuments =
    await BehaviouralFactor.find({
      _id: {
        $in: factorIds
      },

      frameworkVersionId:
        ensureObjectId(
          frameworkVersionId,
          "frameworkVersionId"
        ),

      isActive: true
    });

  const found =
    new Set(
      factorDocuments.map(
        (factor) =>
          factor._id.toString()
      )
    );

  for (const factorId of factorIds) {
    if (
      !found.has(
        factorId.toString()
      )
    ) {
      throw new Error(
        `Behavioural factor ${factorId.toString()} does not belong to the selected framework`
      );
    }
  }
}

function normalizeSkills(
  input: unknown
): IRoleProfileSkill[] {
  if (
    input === undefined ||
    input === null
  ) {
    return [];
  }

  if (!Array.isArray(input)) {
    throw new Error(
      "skills must be an array"
    );
  }

  const seen = new Set<string>();

  return input.map(
    (item: any, index: number) => {
      if (!item || typeof item !== "object") {
        throw new Error(
          `skills[${index}] is invalid`
        );
      }

      const skillId =
        ensureObjectId(
          String(item.skillId),
          `skills[${index}].skillId`
        );

      const key =
        skillId.toString();

      if (seen.has(key)) {
        throw new Error(
          `Skill ${key} appears more than once`
        );
      }

      seen.add(key);

      return {
        skillId,

        targetLevel:
          normalizeLevel(
            item.targetLevel,
            `skills[${index}].targetLevel`
          ),

        weight:
          normalizeWeight(
            item.weight
          )
      };
    }
  );
}

function normalizeBehaviouralFactors(
  input: unknown
): IRoleProfileBehaviouralFactor[] {
  if (
    input === undefined ||
    input === null
  ) {
    return [];
  }

  if (!Array.isArray(input)) {
    throw new Error(
      "behaviouralFactors must be an array"
    );
  }

  const seen = new Set<string>();

  return input.map(
    (item: any, index: number) => {
      if (!item || typeof item !== "object") {
        throw new Error(
          `behaviouralFactors[${index}] is invalid`
        );
      }

      const behaviouralFactorId =
        ensureObjectId(
          String(
            item.behaviouralFactorId
          ),
          `behaviouralFactors[${index}].behaviouralFactorId`
        );

      const key =
        behaviouralFactorId.toString();

      if (seen.has(key)) {
        throw new Error(
          `Behavioural factor ${key} appears more than once`
        );
      }

      seen.add(key);

      return {
        behaviouralFactorId,

        targetLevel:
          normalizeLevel(
            item.targetLevel,
            `behaviouralFactors[${index}].targetLevel`
          ),

        weight:
          normalizeWeight(
            item.weight
          )
      };
    }
  );
}

async function getTemplate(
  templateId: string
) {
  const template =
    await IndustryTemplate.findById(
      ensureObjectId(
        templateId,
        "industryTemplateId"
      )
    );

  if (!template) {
    throw new Error(
      "Industry template not found"
    );
  }

  if (!template.isActive) {
    throw new Error(
      "Industry template is not active"
    );
  }

  return template;
}

async function applyIndustryTemplate(
  templateId: string,
  suppliedSkills: unknown,
  suppliedFactors: unknown
) {
  const template =
    await getTemplate(templateId);

  /*
   * A template provides the organization's
   * starting skill/factor subset.
   *
   * Target levels can still be supplied by
   * the organization because the industry
   * template stores the skill/factor weights,
   * not a role-specific target level.
   */
  const templateSkills =
    Array.isArray(
      template.skills
    )
      ? template.skills
      : [];

  const templateFactors =
    Array.isArray(
      template.behaviouralFactors
    )
      ? template.behaviouralFactors
      : [];

  const providedSkills =
    suppliedSkills !== undefined
      ? normalizeSkills(
          suppliedSkills
        )
      : [];

  const providedFactors =
    suppliedFactors !== undefined
      ? normalizeBehaviouralFactors(
          suppliedFactors
        )
      : [];

  /*
   * If explicit skills are supplied, they
   * take precedence.
   *
   * Otherwise use the template's skills
   * with level 1 as the initial target.
   *
   * The organization can then update levels.
   */
  const skills =
    suppliedSkills !== undefined
      ? providedSkills
      : templateSkills.map(
          (item: any) => ({
            skillId:
              ensureObjectId(
                String(item.skillId),
                "template skillId"
              ),

            targetLevel: 1,

            weight:
              normalizeWeight(
                item.weight
              )
          })
        );

  const behaviouralFactors =
    suppliedFactors !== undefined
      ? providedFactors
      : templateFactors.map(
          (item: any) => ({
            behaviouralFactorId:
              ensureObjectId(
                String(
                  item.behaviouralFactorId
                ),
                "template behaviouralFactorId"
              ),

            targetLevel: 1,

            weight:
              normalizeWeight(
                item.weight
              )
          })
        );

  return {
    template,
    skills,
    behaviouralFactors
  };
}

async function getRoleProfileOrThrow(
  roleProfileId: string,
  organizationId?: string
) {
  const query: Record<string, unknown> = {
    _id: ensureObjectId(
      roleProfileId,
      "roleProfileId"
    )
  };

  const orgId =
    normalizeOrganizationId(
      organizationId
    );

  if (orgId) {
    query.organizationId = orgId;
  }

  const profile =
    await RoleProfile.findOne(
      query
    );

  if (!profile) {
    throw new Error(
      "Role profile not found"
    );
  }

  return profile;
}

/* -------------------------------------------------------------------------- */
/* Role Profiles                                                              */
/* -------------------------------------------------------------------------- */

export async function createRoleProfile(
  params: {
    organizationId: string;
    frameworkVersionId: string;
    industryTemplateId?: string;

    name: string;
    slug?: string;
    description?: string;
    department?: string;

    skills?: unknown;
    behaviouralFactors?: unknown;

    createdBy: string;
  }
) {
  const organizationId =
    ensureObjectId(
      params.organizationId,
      "organizationId"
    );

  const framework =
    await verifyFramework(
      params.frameworkVersionId,
      organizationId
    );

  if (
    !params.name ||
    params.name.trim() === ""
  ) {
    throw new Error(
      "Role profile name is required"
    );
  }

  let skills =
    normalizeSkills(
      params.skills
    );

  let behaviouralFactors =
    normalizeBehaviouralFactors(
      params.behaviouralFactors
    );

  let industryTemplateId:
    | Types.ObjectId
    | undefined;

  if (params.industryTemplateId) {
    const templateResult =
      await applyIndustryTemplate(
        params.industryTemplateId,
        params.skills,
        params.behaviouralFactors
      );

    industryTemplateId =
      templateResult.template._id;

    if (
      params.skills === undefined
    ) {
      skills =
        templateResult.skills;
    }

    if (
      params.behaviouralFactors ===
      undefined
    ) {
      behaviouralFactors =
        templateResult.behaviouralFactors;
    }

    /*
     * Ensure the template's content belongs
     * to the selected framework.
     */
    await verifySkills(
      framework._id.toString(),
      skills
    );

    await verifyBehaviouralFactors(
      framework._id.toString(),
      behaviouralFactors
    );
  } else {
    await verifySkills(
      framework._id.toString(),
      skills
    );

    await verifyBehaviouralFactors(
      framework._id.toString(),
      behaviouralFactors
    );
  }

  if (
    skills.length === 0 &&
    behaviouralFactors.length === 0
  ) {
    throw new Error(
      "A role profile must contain at least one skill or behavioural factor"
    );
  }

  const slug =
    slugify(
      params.slug ||
        params.name
    );

  if (!slug) {
    throw new Error(
      "A valid role profile slug is required"
    );
  }

  const profile =
    new RoleProfile({
      organizationId,

      frameworkVersionId:
        framework._id,

      industryTemplateId,

      name:
        params.name.trim(),

      slug,

      description:
        params.description?.trim(),

      department:
        params.department?.trim(),

      status:
        RoleProfileStatus.DRAFT,

      skills,

      behaviouralFactors,

      createdBy:
        ensureObjectId(
          params.createdBy,
          "createdBy"
        )
    });

  return profile.save();
}

export async function listRoleProfiles(
  params: {
    organizationId?: string;
    frameworkVersionId?: string;
    status?: RoleProfileStatus;
  }
) {
  const query: Record<string, unknown> =
    {};

  const organizationId =
    normalizeOrganizationId(
      params.organizationId
    );

  if (organizationId) {
    query.organizationId =
      organizationId;
  }

  if (params.frameworkVersionId) {
    query.frameworkVersionId =
      ensureObjectId(
        params.frameworkVersionId,
        "frameworkVersionId"
      );
  }

  if (params.status) {
    query.status =
      params.status;
  }

  return RoleProfile.find(
    query
  )
    .populate(
      "frameworkVersionId",
      "name version status"
    )
    .populate(
      "industryTemplateId",
      "name industry"
    )
    .sort({
      createdAt: -1
    });
}

export async function getRoleProfile(
  roleProfileId: string,
  organizationId?: string
) {
  return getRoleProfileOrThrow(
    roleProfileId,
    organizationId
  );
}

export async function updateRoleProfile(
  roleProfileId: string,
  params: {
    organizationId?: string;

    name?: string;
    slug?: string;
    description?: string;
    department?: string;

    skills?: unknown;
    behaviouralFactors?: unknown;

    updatedBy: string;
  }
) {
  const profile =
    await getRoleProfileOrThrow(
      roleProfileId,
      params.organizationId
    );

  if (
    profile.status !==
    RoleProfileStatus.DRAFT
  ) {
    throw new Error(
      "Only draft role profiles can be edited"
    );
  }

  if (params.name !== undefined) {
    if (
      params.name.trim() === ""
    ) {
      throw new Error(
        "Role profile name cannot be empty"
      );
    }

    profile.name =
      params.name.trim();
  }

  if (params.slug !== undefined) {
    const slug =
      slugify(params.slug);

    if (!slug) {
      throw new Error(
        "Role profile slug is invalid"
      );
    }

    profile.slug = slug;
  }

  if (
    params.description !==
    undefined
  ) {
    profile.description =
      params.description.trim();
  }

  if (
    params.department !==
    undefined
  ) {
    profile.department =
      params.department.trim();
  }

  if (
    params.skills !== undefined
  ) {
    profile.skills =
      normalizeSkills(
        params.skills
      );

    await verifySkills(
      profile.frameworkVersionId.toString(),
      profile.skills
    );
  }

  if (
    params.behaviouralFactors !==
    undefined
  ) {
    profile.behaviouralFactors =
      normalizeBehaviouralFactors(
        params.behaviouralFactors
      );

    await verifyBehaviouralFactors(
      profile.frameworkVersionId.toString(),
      profile.behaviouralFactors
    );
  }

  if (
    profile.skills.length === 0 &&
    profile.behaviouralFactors.length === 0
  ) {
    throw new Error(
      "A role profile must contain at least one skill or behavioural factor"
    );
  }

  profile.updatedBy =
    ensureObjectId(
      params.updatedBy,
      "updatedBy"
    );

  return profile.save();
}

export async function publishRoleProfile(
  roleProfileId: string,
  organizationId?: string
) {
  const profile =
    await getRoleProfileOrThrow(
      roleProfileId,
      organizationId
    );

  if (
    profile.status ===
    RoleProfileStatus.ARCHIVED
  ) {
    throw new Error(
      "Archived role profiles cannot be published"
    );
  }

  if (
    profile.skills.length === 0 &&
    profile.behaviouralFactors.length === 0
  ) {
    throw new Error(
      "A role profile must contain at least one skill or behavioural factor before publishing"
    );
  }

  profile.status =
    RoleProfileStatus.PUBLISHED;

  profile.publishedAt =
    new Date();

  profile.archivedAt =
    undefined;

  return profile.save();
}

export async function archiveRoleProfile(
  roleProfileId: string,
  organizationId?: string
) {
  const profile =
    await getRoleProfileOrThrow(
      roleProfileId,
      organizationId
    );

  profile.status =
    RoleProfileStatus.ARCHIVED;

  profile.archivedAt =
    new Date();

  return profile.save();
}

/* -------------------------------------------------------------------------- */
/* Career Paths                                                               */
/* -------------------------------------------------------------------------- */

function calculateChangeType(
  sourceLevel: number | undefined,
  targetLevel: number | undefined
): CareerPathChangeType {
  if (
    sourceLevel === undefined &&
    targetLevel !== undefined
  ) {
    return CareerPathChangeType.ADDED;
  }

  if (
    sourceLevel !== undefined &&
    targetLevel === undefined
  ) {
    return CareerPathChangeType.REMOVED;
  }

  if (
    sourceLevel === targetLevel
  ) {
    return CareerPathChangeType.UNCHANGED;
  }

  if (
    sourceLevel !== undefined &&
    targetLevel !== undefined
  ) {
    if (
      targetLevel > sourceLevel
    ) {
      return CareerPathChangeType.INCREASED;
    }

    return CareerPathChangeType.DECREASED;
  }

  return CareerPathChangeType.UNCHANGED;
}

function calculateSkillDeltas(
  source: IRoleProfileSkill[],
  target: IRoleProfileSkill[]
): ICareerPathSkillDelta[] {
  const sourceMap =
    new Map<string, number>();

  const targetMap =
    new Map<string, number>();

  for (const item of source) {
    sourceMap.set(
      item.skillId.toString(),
      item.targetLevel
    );
  }

  for (const item of target) {
    targetMap.set(
      item.skillId.toString(),
      item.targetLevel
    );
  }

  const ids = new Set<string>([
    ...sourceMap.keys(),
    ...targetMap.keys()
  ]);

  return Array.from(ids).map(
    (skillId) => {
      const sourceLevel =
        sourceMap.get(skillId);

      const targetLevel =
        targetMap.get(skillId);

      const delta =
        (targetLevel ?? 0) -
        (sourceLevel ?? 0);

      return {
        skillId:
          new Types.ObjectId(
            skillId
          ),

        sourceLevel,

        targetLevel,

        delta,

        changeType:
          calculateChangeType(
            sourceLevel,
            targetLevel
          )
      };
    }
  );
}

function calculateBehaviouralDeltas(
  source: IRoleProfileBehaviouralFactor[],
  target: IRoleProfileBehaviouralFactor[]
): ICareerPathBehaviouralDelta[] {
  const sourceMap =
    new Map<string, number>();

  const targetMap =
    new Map<string, number>();

  for (const item of source) {
    sourceMap.set(
      item.behaviouralFactorId.toString(),
      item.targetLevel
    );
  }

  for (const item of target) {
    targetMap.set(
      item.behaviouralFactorId.toString(),
      item.targetLevel
    );
  }

  const ids = new Set<string>([
    ...sourceMap.keys(),
    ...targetMap.keys()
  ]);

  return Array.from(ids).map(
    (factorId) => {
      const sourceLevel =
        sourceMap.get(factorId);

      const targetLevel =
        targetMap.get(factorId);

      const delta =
        (targetLevel ?? 0) -
        (sourceLevel ?? 0);

      return {
        behaviouralFactorId:
          new Types.ObjectId(
            factorId
          ),

        sourceLevel,

        targetLevel,

        delta,

        changeType:
          calculateChangeType(
            sourceLevel,
            targetLevel
          )
      };
    }
  );
}

async function verifyCareerPathRoles(
  sourceRoleProfileId: string,
  targetRoleProfileId: string,
  organizationId?: string
) {
  if (
    sourceRoleProfileId ===
    targetRoleProfileId
  ) {
    throw new Error(
      "Source and target role profiles must be different"
    );
  }

  const source =
    await getRoleProfileOrThrow(
      sourceRoleProfileId,
      organizationId
    );

  const target =
    await getRoleProfileOrThrow(
      targetRoleProfileId,
      organizationId
    );

  if (
    source.status !==
      RoleProfileStatus.PUBLISHED ||
    target.status !==
      RoleProfileStatus.PUBLISHED
  ) {
    throw new Error(
      "Both role profiles must be published before creating a career path"
    );
  }

  if (
    source.frameworkVersionId.toString() !==
    target.frameworkVersionId.toString()
  ) {
    throw new Error(
      "Career path role profiles must use the same framework version"
    );
  }

  return {
    source,
    target
  };
}

export async function createCareerPath(
  params: {
    organizationId: string;

    sourceRoleProfileId: string;
    targetRoleProfileId: string;

    name?: string;
    description?: string;

    createdBy: string;
  }
) {
  const organizationId =
    ensureObjectId(
      params.organizationId,
      "organizationId"
    );

  const {
    source,
    target
  } =
    await verifyCareerPathRoles(
      params.sourceRoleProfileId,
      params.targetRoleProfileId,
      params.organizationId
    );

  const skillDeltas =
    calculateSkillDeltas(
      source.skills,
      target.skills
    );

  const behaviouralFactorDeltas =
    calculateBehaviouralDeltas(
      source.behaviouralFactors,
      target.behaviouralFactors
    );

  const careerPath =
    new CareerPath({
      organizationId,

      sourceRoleProfileId:
        source._id,

      targetRoleProfileId:
        target._id,

      name:
        params.name?.trim(),

      description:
        params.description?.trim(),

      skillDeltas,

      behaviouralFactorDeltas,

      createdBy:
        ensureObjectId(
          params.createdBy,
          "createdBy"
        )
    });

  return careerPath.save();
}

export async function listCareerPaths(
  params: {
    organizationId?: string;
    sourceRoleProfileId?: string;
    targetRoleProfileId?: string;
  }
) {
  const query: Record<string, unknown> =
    {};

  const organizationId =
    normalizeOrganizationId(
      params.organizationId
    );

  if (organizationId) {
    query.organizationId =
      organizationId;
  }

  if (params.sourceRoleProfileId) {
    query.sourceRoleProfileId =
      ensureObjectId(
        params.sourceRoleProfileId,
        "sourceRoleProfileId"
      );
  }

  if (params.targetRoleProfileId) {
    query.targetRoleProfileId =
      ensureObjectId(
        params.targetRoleProfileId,
        "targetRoleProfileId"
      );
  }

  return CareerPath.find(
    query
  )
    .populate(
      "sourceRoleProfileId",
      "name slug status frameworkVersionId"
    )
    .populate(
      "targetRoleProfileId",
      "name slug status frameworkVersionId"
    )
    .sort({
      createdAt: -1
    });
}

export async function getCareerPath(
  careerPathId: string,
  organizationId?: string
) {
  const query: Record<string, unknown> =
    {
      _id: ensureObjectId(
        careerPathId,
        "careerPathId"
      )
    };

  const orgId =
    normalizeOrganizationId(
      organizationId
    );

  if (orgId) {
    query.organizationId =
      orgId;
  }

  const careerPath =
    await CareerPath.findOne(
      query
    )
      .populate(
        "sourceRoleProfileId",
        "name slug status frameworkVersionId"
      )
      .populate(
        "targetRoleProfileId",
        "name slug status frameworkVersionId"
      );

  if (!careerPath) {
    throw new Error(
      "Career path not found"
    );
  }

  return careerPath;
}

export async function updateCareerPath(
  careerPathId: string,
  params: {
    organizationId?: string;

    sourceRoleProfileId?: string;
    targetRoleProfileId?: string;

    name?: string;
    description?: string;

    updatedBy: string;
  }
) {
  const query: Record<string, unknown> =
    {
      _id: ensureObjectId(
        careerPathId,
        "careerPathId"
      )
    };

  const organizationId =
    normalizeOrganizationId(
      params.organizationId
    );

  if (organizationId) {
    query.organizationId =
      organizationId;
  }

  const careerPath =
    await CareerPath.findOne(
      query
    );

  if (!careerPath) {
    throw new Error(
      "Career path not found"
    );
  }

  const sourceRoleProfileId =
    params.sourceRoleProfileId ||
    careerPath.sourceRoleProfileId.toString();

  const targetRoleProfileId =
    params.targetRoleProfileId ||
    careerPath.targetRoleProfileId.toString();

  const {
    source,
    target
  } =
    await verifyCareerPathRoles(
      sourceRoleProfileId,
      targetRoleProfileId,
      params.organizationId
    );

  careerPath.sourceRoleProfileId =
    source._id;

  careerPath.targetRoleProfileId =
    target._id;

  if (params.name !== undefined) {
    careerPath.name =
      params.name.trim();
  }

  if (
    params.description !==
    undefined
  ) {
    careerPath.description =
      params.description.trim();
  }

  /*
   * Recalculate the deltas whenever the
   * source or target role changes.
   */
  careerPath.skillDeltas =
    calculateSkillDeltas(
      source.skills,
      target.skills
    );

  careerPath.behaviouralFactorDeltas =
    calculateBehaviouralDeltas(
      source.behaviouralFactors,
      target.behaviouralFactors
    );

  careerPath.updatedBy =
    ensureObjectId(
      params.updatedBy,
      "updatedBy"
    );

  return careerPath.save();
}

export async function deleteCareerPath(
  careerPathId: string,
  organizationId?: string
) {
  const query: Record<string, unknown> =
    {
      _id: ensureObjectId(
        careerPathId,
        "careerPathId"
      )
    };

  const orgId =
    normalizeOrganizationId(
      organizationId
    );

  if (orgId) {
    query.organizationId =
      orgId;
  }

  const result =
    await CareerPath.deleteOne(
      query
    );

  if (
    result.deletedCount === 0
  ) {
    throw new Error(
      "Career path not found"
    );
  }

  return {
    deleted: true
  };
}