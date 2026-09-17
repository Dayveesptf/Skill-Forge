import { Types } from "mongoose";

import CareerPath, {
  CareerPathChangeType,
} from "../../models/CareerPath";

import {
  RoleProfile,
  RoleProfileStatus,
} from "../../models/RoleProfile";

import { Skill } from "../../models/Skill";

import {
  BehaviouralFactor,
} from "../../models/BehaviouralFactor";

function toObjectId(
  value: string,
  fieldName: string,
): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new Error(`${fieldName} is invalid`);
  }

  return new Types.ObjectId(value);
}

function normalizeOrganizationId(
  organizationId?: string,
): Types.ObjectId | undefined {
  if (!organizationId) {
    return undefined;
  }

  return toObjectId(
    organizationId,
    "organizationId",
  );
}

function normalizeLevel(
  value: unknown,
  fieldName: string,
): number {
  const level = Number(value);

  if (
    !Number.isInteger(level) ||
    level < 1 ||
    level > 10
  ) {
    throw new Error(
      `${fieldName} must be an integer between 1 and 10`,
    );
  }

  return level;
}

function getChangeType(
  sourceLevel?: number,
  targetLevel?: number,
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
    sourceLevel !== undefined &&
    targetLevel !== undefined
  ) {
    if (targetLevel > sourceLevel) {
      return CareerPathChangeType.INCREASED;
    }

    if (targetLevel < sourceLevel) {
      return CareerPathChangeType.DECREASED;
    }

    return CareerPathChangeType.UNCHANGED;
  }

  return CareerPathChangeType.UNCHANGED;
}

function calculateDelta(
  sourceLevel?: number,
  targetLevel?: number,
): number {
  if (
    sourceLevel === undefined &&
    targetLevel !== undefined
  ) {
    return targetLevel;
  }

  if (
    sourceLevel !== undefined &&
    targetLevel === undefined
  ) {
    return -sourceLevel;
  }

  if (
    sourceLevel !== undefined &&
    targetLevel !== undefined
  ) {
    return targetLevel - sourceLevel;
  }

  return 0;
}

async function getPublishedRoleProfile(
  roleProfileId: string,
  organizationId: string,
) {
  const profile =
    await RoleProfile.findOne({
      _id: toObjectId(
        roleProfileId,
        "roleProfileId",
      ),
      organizationId:
        toObjectId(
          organizationId,
          "organizationId",
        ),
      status:
        RoleProfileStatus.PUBLISHED,
    });

  if (!profile) {
    throw new Error(
      "Published role profile not found",
    );
  }

  return profile;
}

async function getCareerPathOrThrow(
  careerPathId: string,
  organizationId?: string,
) {
  const filter: Record<string, unknown> = {
    _id: toObjectId(
      careerPathId,
      "careerPathId",
    ),
  };

  const orgId =
    normalizeOrganizationId(
      organizationId,
    );

  if (orgId) {
    filter.organizationId = orgId;
  }

  const careerPath =
    await CareerPath.findOne(filter);

  if (!careerPath) {
    throw new Error(
      "Career path not found",
    );
  }

  return careerPath;
}

/* -------------------------------------------------------------------------- */
/* Calculate Deltas                                                           */
/* -------------------------------------------------------------------------- */

async function calculateCareerPathDeltas(
  sourceProfile: any,
  targetProfile: any,
) {
  const sourceSkills = new Map<
    string,
    number
  >();

  const targetSkills = new Map<
    string,
    number
  >();

  for (const item of sourceProfile.skills || []) {
    sourceSkills.set(
      item.skillId.toString(),
      Number(item.targetLevel),
    );
  }

  for (const item of targetProfile.skills || []) {
    targetSkills.set(
      item.skillId.toString(),
      Number(item.targetLevel),
    );
  }

  const skillIds = new Set([
    ...sourceSkills.keys(),
    ...targetSkills.keys(),
  ]);

  const skillDeltas = Array.from(
    skillIds,
  ).map((skillId) => {
    const sourceLevel =
      sourceSkills.get(skillId);

    const targetLevel =
      targetSkills.get(skillId);

    return {
      skillId: new Types.ObjectId(
        skillId,
      ),
      sourceLevel,
      targetLevel,
      delta: calculateDelta(
        sourceLevel,
        targetLevel,
      ),
      changeType:
        getChangeType(
          sourceLevel,
          targetLevel,
        ),
    };
  });

  const sourceFactors = new Map<
    string,
    number
  >();

  const targetFactors = new Map<
    string,
    number
  >();

  for (
    const item of
      sourceProfile.behaviouralFactors || []
  ) {
    sourceFactors.set(
      item.behaviouralFactorId.toString(),
      Number(item.targetLevel),
    );
  }

  for (
    const item of
      targetProfile.behaviouralFactors || []
  ) {
    targetFactors.set(
      item.behaviouralFactorId.toString(),
      Number(item.targetLevel),
    );
  }

  const factorIds = new Set([
    ...sourceFactors.keys(),
    ...targetFactors.keys(),
  ]);

  const behaviouralFactorDeltas =
    Array.from(factorIds).map(
      (factorId) => {
        const sourceLevel =
          sourceFactors.get(
            factorId,
          );

        const targetLevel =
          targetFactors.get(
            factorId,
          );

        return {
          behaviouralFactorId:
            new Types.ObjectId(
              factorId,
            ),
          sourceLevel,
          targetLevel,
          delta: calculateDelta(
            sourceLevel,
            targetLevel,
          ),
          changeType:
            getChangeType(
              sourceLevel,
              targetLevel,
            ),
        };
      },
    );

  return {
    skillDeltas,
    behaviouralFactorDeltas,
  };
}

/* -------------------------------------------------------------------------- */
/* Role Options                                                               */
/* -------------------------------------------------------------------------- */

export async function listCareerPathRoleOptions(
  organizationId: string,
) {
  const organizationObjectId =
    toObjectId(
      organizationId,
      "organizationId",
    );

  return RoleProfile.find({
    organizationId:
      organizationObjectId,
    status:
      RoleProfileStatus.PUBLISHED,
  })
    .select(
      "_id name slug description department frameworkVersionId",
    )
    .sort({
      name: 1,
    })
    .lean();
}

/* -------------------------------------------------------------------------- */
/* List                                                                       */
/* -------------------------------------------------------------------------- */

export async function listCareerPaths(
  organizationId?: string,
) {
  const filter: Record<string, unknown> =
    {};

  const orgId =
    normalizeOrganizationId(
      organizationId,
    );

  if (orgId) {
    filter.organizationId = orgId;
  }

  return CareerPath.find(filter)
    .populate(
      "sourceRoleProfileId",
      "name slug description department frameworkVersionId status",
    )
    .populate(
      "targetRoleProfileId",
      "name slug description department frameworkVersionId status",
    )
    .sort({
      createdAt: -1,
    })
    .lean();
}

/* -------------------------------------------------------------------------- */
/* Get One                                                                    */
/* -------------------------------------------------------------------------- */

export async function getCareerPath(
  careerPathId: string,
  organizationId?: string,
) {
  const careerPath =
    await getCareerPathOrThrow(
      careerPathId,
      organizationId,
    );

  const sourceProfile =
    await RoleProfile.findById(
      careerPath.sourceRoleProfileId,
    )
      .select(
        "name slug description department frameworkVersionId status skills behaviouralFactors",
      )
      .lean();

  const targetProfile =
    await RoleProfile.findById(
      careerPath.targetRoleProfileId,
    )
      .select(
        "name slug description department frameworkVersionId status skills behaviouralFactors",
      )
      .lean();

  const skillIds =
    careerPath.skillDeltas.map(
      (item) => item.skillId,
    );

  const behaviouralFactorIds =
    careerPath.behaviouralFactorDeltas.map(
      (item) =>
        item.behaviouralFactorId,
    );

  const skills =
    await Skill.find({
      _id: {
        $in: skillIds,
      },
    })
      .select(
        "_id name slug description category",
      )
      .lean();

  const behaviouralFactors =
    await BehaviouralFactor.find({
      _id: {
        $in:
          behaviouralFactorIds,
      },
    })
      .select(
        "_id name slug description indicators",
      )
      .lean();

  return {
    careerPath,
    sourceRoleProfile:
      sourceProfile,
    targetRoleProfile:
      targetProfile,
    skills,
    behaviouralFactors,
  };
}

/* -------------------------------------------------------------------------- */
/* Create                                                                     */
/* -------------------------------------------------------------------------- */

export async function createCareerPath(
  params: {
    organizationId: string;
    sourceRoleProfileId: string;
    targetRoleProfileId: string;
    name?: string;
    description?: string;
    createdBy: string;
  },
) {
  const organizationId =
    toObjectId(
      params.organizationId,
      "organizationId",
    );

  const createdBy =
    toObjectId(
      params.createdBy,
      "createdBy",
    );

  if (
    params.sourceRoleProfileId ===
    params.targetRoleProfileId
  ) {
    throw new Error(
      "Source and target role profiles must be different",
    );
  }

  const sourceProfile =
    await getPublishedRoleProfile(
      params.sourceRoleProfileId,
      params.organizationId,
    );

  const targetProfile =
    await getPublishedRoleProfile(
      params.targetRoleProfileId,
      params.organizationId,
    );

  if (
    sourceProfile.frameworkVersionId.toString() !==
    targetProfile.frameworkVersionId.toString()
  ) {
    throw new Error(
      "Source and target role profiles must use the same framework version",
    );
  }

  const existing =
    await CareerPath.findOne({
      organizationId,
      sourceRoleProfileId:
        sourceProfile._id,
      targetRoleProfileId:
        targetProfile._id,
    });

  if (existing) {
    throw new Error(
      "A career path already exists between these role profiles",
    );
  }

  const {
    skillDeltas,
    behaviouralFactorDeltas,
  } =
    await calculateCareerPathDeltas(
      sourceProfile,
      targetProfile,
    );

  const careerPath =
    await CareerPath.create({
      organizationId,
      sourceRoleProfileId:
        sourceProfile._id,
      targetRoleProfileId:
        targetProfile._id,
      name:
        params.name?.trim() ||
        `${sourceProfile.name} → ${targetProfile.name}`,
      description:
        params.description?.trim() ||
        undefined,
      skillDeltas,
      behaviouralFactorDeltas,
      createdBy,
    });

  return careerPath;
}

/* -------------------------------------------------------------------------- */
/* Update                                                                     */
/* -------------------------------------------------------------------------- */

export async function updateCareerPath(
  params: {
    careerPathId: string;
    organizationId: string;
    name?: string;
    description?: string;
    updatedBy: string;
  },
) {
  const careerPath =
    await getCareerPathOrThrow(
      params.careerPathId,
      params.organizationId,
    );

  if (
    params.name !== undefined
  ) {
    const name =
      params.name.trim();

    if (!name) {
      throw new Error(
        "Career path name cannot be empty",
      );
    }

    careerPath.name = name;
  }

  if (
    params.description !== undefined
  ) {
    careerPath.description =
      params.description.trim() ||
      undefined;
  }

  careerPath.updatedBy =
    toObjectId(
      params.updatedBy,
      "updatedBy",
    );

  await careerPath.save();

  return careerPath;
}

/* -------------------------------------------------------------------------- */
/* Delete                                                                     */
/* -------------------------------------------------------------------------- */

export async function deleteCareerPath(
  careerPathId: string,
  organizationId: string,
) {
  const careerPath =
    await getCareerPathOrThrow(
      careerPathId,
      organizationId,
    );

  await careerPath.deleteOne();

  return {
    id: careerPath._id.toString(),
  };
}