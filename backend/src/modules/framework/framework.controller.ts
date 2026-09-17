import { Response } from "express";

import { AuthenticatedRequest } from "../../middleware/auth";
import { UserRole } from "../../constants/roles";
import { writeAuditLog } from "../../utils/audit";

import {
  createBehaviouralFactor,
  createEvidencePrompt,
  createFrameworkVersion,
  createIndustryTemplate,
  createSkill,
  createSkillLevel,
  getFrameworkOverview,
  getFrameworkVersion,
  listBehaviouralFactors,
  listEvidencePrompts,
  listFrameworkVersions,
  listIndustryTemplates,
  listSkillLevels,
  listSkills,
  updateFrameworkVersion,
} from "./framework.service";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function getRouteParam(
  value: string | string[] | undefined,
  paramName: string
): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${paramName} is required`);
  }

  return value;
}

function getQueryParam(
  value: unknown,
  paramName: string
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${paramName} must be a valid string`);
  }

  return value;
}

/**
 * Returns the authenticated user's organization.
 *
 * Platform admins intentionally have no forced organization scope.
 */
function getOrganizationId(
  req: AuthenticatedRequest
): string | undefined {
  return req.user?.organizationId;
}

/**
 * Platform admins may explicitly operate on an organization.
 * Organization admins are always restricted to their own organization.
 */
function getAdminOrganizationId(
  req: AuthenticatedRequest
): string | undefined {
  if (!req.user) {
    return undefined;
  }

  if (req.user.role === UserRole.PLATFORM_ADMIN) {
    return getQueryParam(
      req.body?.organizationId,
      "organizationId"
    );
  }

  return req.user.organizationId;
}

/* -------------------------------------------------------------------------- */
/* Framework                                                                  */
/* -------------------------------------------------------------------------- */

export async function createFramework(
  req: AuthenticatedRequest,
  res: Response
) {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: "Authentication required",
    });
    return;
  }

  const organizationId =
    req.user.role === UserRole.PLATFORM_ADMIN
      ? req.body.organizationId
      : getOrganizationId(req);

  const framework = await createFrameworkVersion({
    ...req.body,
    organizationId,
    createdBy: req.user.userId,
  });

  await writeAuditLog(
    req,
    "FRAMEWORK_CREATED",
    "FrameworkVersion",
    framework.id
  );

  res.status(201).json({
    success: true,
    data: framework,
  });
}

export async function getFrameworks(
  req: AuthenticatedRequest,
  res: Response
) {
  const organizationId =
    req.user?.role === UserRole.PLATFORM_ADMIN
      ? getQueryParam(
          req.query.organizationId,
          "organizationId"
        )
      : getOrganizationId(req);

  res.json({
    success: true,
    data: await listFrameworkVersions(
      organizationId
    ),
  });
}

export async function getFramework(
  req: AuthenticatedRequest,
  res: Response
) {
  const id = getRouteParam(
    req.params.id,
    "id"
  );

  const organizationId =
    req.user?.role === UserRole.PLATFORM_ADMIN
      ? undefined
      : getOrganizationId(req);

  const framework =
    await getFrameworkVersion(
      id,
      organizationId
    );

  if (!framework) {
    res.status(404).json({
      success: false,
      message: "Framework version not found",
    });
    return;
  }

  res.json({
    success: true,
    data: framework,
  });
}

export async function updateFramework(
  req: AuthenticatedRequest,
  res: Response
) {
  const id = getRouteParam(
    req.params.id,
    "id"
  );

  const organizationId =
    req.user?.role === UserRole.PLATFORM_ADMIN
      ? undefined
      : getOrganizationId(req);

  const framework =
    await getFrameworkVersion(
      id,
      organizationId
    );

  if (!framework) {
    res.status(404).json({
      success: false,
      message: "Framework version not found",
    });
    return;
  }

  const updated =
    await updateFrameworkVersion(
      id,
      req.body,
      organizationId
    );

  if (!updated) {
    res.status(404).json({
      success: false,
      message: "Framework version not found",
    });
    return;
  }

  await writeAuditLog(
    req,
    "FRAMEWORK_UPDATED",
    "FrameworkVersion",
    id,
    {
      changedFields: Object.keys(
        req.body
      ),
    }
  );

  res.json({
    success: true,
    data: updated,
  });
}

/* -------------------------------------------------------------------------- */
/* Skills                                                                     */
/* -------------------------------------------------------------------------- */

export async function createFrameworkSkill(
  req: AuthenticatedRequest,
  res: Response
) {
  const organizationId =
    req.user?.role === UserRole.PLATFORM_ADMIN
      ? req.body.organizationId
      : getOrganizationId(req);

  const skill = await createSkill({
    ...req.body,
    organizationId,
    frameworkVersionId:
      getRouteParam(
        req.params.frameworkId,
        "frameworkId"
      ),
  });

  await writeAuditLog(
    req,
    "SKILL_CREATED",
    "Skill",
    skill.id
  );

  res.status(201).json({
    success: true,
    data: skill,
  });
}

export async function getFrameworkSkills(
  req: AuthenticatedRequest,
  res: Response
) {
  const frameworkId =
    getRouteParam(
      req.params.frameworkId,
      "frameworkId"
    );

  const organizationId =
    req.user?.role === UserRole.PLATFORM_ADMIN
      ? getQueryParam(
          req.query.organizationId,
          "organizationId"
        )
      : getOrganizationId(req);

  res.json({
    success: true,
    data: await listSkills(
      frameworkId,
      organizationId
    ),
  });
}

/* -------------------------------------------------------------------------- */
/* Skill Levels                                                               */
/* -------------------------------------------------------------------------- */

export async function createFrameworkSkillLevel(
  req: AuthenticatedRequest,
  res: Response
) {
  const frameworkId =
    getRouteParam(
      req.params.frameworkId,
      "frameworkId"
    );

  const skillId =
    getRouteParam(
      req.params.skillId,
      "skillId"
    );

  const organizationId =
    req.user?.role === UserRole.PLATFORM_ADMIN
      ? req.body.organizationId
      : getOrganizationId(req);

  const level =
    await createSkillLevel({
      ...req.body,
      frameworkVersionId:
        frameworkId,
      skillId,
      organizationId,
    });

  await writeAuditLog(
    req,
    "SKILL_LEVEL_CREATED",
    "SkillLevel",
    level.id
  );

  res.status(201).json({
    success: true,
    data: level,
  });
}

export async function getSkillLevels(
  req: AuthenticatedRequest,
  res: Response
) {
  const frameworkId =
    getRouteParam(
      req.params.frameworkId,
      "frameworkId"
    );

  const skillId =
    getRouteParam(
      req.params.skillId,
      "skillId"
    );

  const organizationId =
    req.user?.role === UserRole.PLATFORM_ADMIN
      ? getQueryParam(
          req.query.organizationId,
          "organizationId"
        )
      : getOrganizationId(req);

  res.json({
    success: true,
    data: await listSkillLevels(
      skillId,
      frameworkId,
      organizationId
    ),
  });
}

/* -------------------------------------------------------------------------- */
/* Behavioural Factors                                                        */
/* -------------------------------------------------------------------------- */

export async function createFactor(
  req: AuthenticatedRequest,
  res: Response
) {
  const frameworkId =
    getRouteParam(
      req.params.frameworkId,
      "frameworkId"
    );

  const organizationId =
    req.user?.role === UserRole.PLATFORM_ADMIN
      ? req.body.organizationId
      : getOrganizationId(req);

  const factor =
    await createBehaviouralFactor({
      ...req.body,
      organizationId,
      frameworkVersionId:
        frameworkId,
    });

  await writeAuditLog(
    req,
    "BEHAVIOURAL_FACTOR_CREATED",
    "BehaviouralFactor",
    factor.id
  );

  res.status(201).json({
    success: true,
    data: factor,
  });
}

export async function getFactors(
  req: AuthenticatedRequest,
  res: Response
) {
  const frameworkId =
    getRouteParam(
      req.params.frameworkId,
      "frameworkId"
    );

  const organizationId =
    req.user?.role === UserRole.PLATFORM_ADMIN
      ? getQueryParam(
          req.query.organizationId,
          "organizationId"
        )
      : getOrganizationId(req);

  res.json({
    success: true,
    data: await listBehaviouralFactors(
      frameworkId,
      organizationId
    ),
  });
}

/* -------------------------------------------------------------------------- */
/* Evidence Prompts                                                           */
/* -------------------------------------------------------------------------- */

export async function createPrompt(
  req: AuthenticatedRequest,
  res: Response
) {
  const frameworkId =
    getRouteParam(
      req.params.frameworkId,
      "frameworkId"
    );

  const organizationId =
    req.user?.role === UserRole.PLATFORM_ADMIN
      ? req.body.organizationId
      : getOrganizationId(req);

  const prompt =
    await createEvidencePrompt({
      ...req.body,
      organizationId,
      frameworkVersionId:
        frameworkId,
    });

  await writeAuditLog(
    req,
    "EVIDENCE_PROMPT_CREATED",
    "EvidencePrompt",
    prompt.id
  );

  res.status(201).json({
    success: true,
    data: prompt,
  });
}

export async function getPrompts(
  req: AuthenticatedRequest,
  res: Response
) {
  const frameworkId =
    getRouteParam(
      req.params.frameworkId,
      "frameworkId"
    );

  const organizationId =
    req.user?.role === UserRole.PLATFORM_ADMIN
      ? getQueryParam(
          req.query.organizationId,
          "organizationId"
        )
      : getOrganizationId(req);

  res.json({
    success: true,
    data: await listEvidencePrompts(
      frameworkId,
      organizationId
    ),
  });
}

/* -------------------------------------------------------------------------- */
/* Industry Templates                                                         */
/* -------------------------------------------------------------------------- */

export async function createTemplate(
  req: AuthenticatedRequest,
  res: Response
) {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: "Authentication required",
    });
    return;
  }

  const organizationId =
    req.user.role === UserRole.PLATFORM_ADMIN
      ? req.body.organizationId
      : getOrganizationId(req);

  const template =
    await createIndustryTemplate({
      ...req.body,
      organizationId,
      /*
       * Organization admins must not be able
       * to create system templates.
       */
      isSystemTemplate:
        req.user.role === UserRole.PLATFORM_ADMIN
          ? req.body.isSystemTemplate
          : false,
    });

  await writeAuditLog(
    req,
    "INDUSTRY_TEMPLATE_CREATED",
    "IndustryTemplate",
    template.id
  );

  res.status(201).json({
    success: true,
    data: template,
  });
}

export async function getTemplates(
  req: AuthenticatedRequest,
  res: Response
) {
  const organizationId =
    req.user?.role === UserRole.PLATFORM_ADMIN
      ? getQueryParam(
          req.query.organizationId,
          "organizationId"
        )
      : getOrganizationId(req);

  res.json({
    success: true,
    data: await listIndustryTemplates(
      organizationId
    ),
  });
}

/* -------------------------------------------------------------------------- */
/* Overview                                                                   */
/* -------------------------------------------------------------------------- */

export async function overview(
  req: AuthenticatedRequest,
  res: Response
) {
  const frameworkId =
    getRouteParam(
      req.params.frameworkId,
      "frameworkId"
    );

  const organizationId =
    req.user?.role === UserRole.PLATFORM_ADMIN
      ? getQueryParam(
          req.query.organizationId,
          "organizationId"
        )
      : getOrganizationId(req);

  res.json({
    success: true,
    data: await getFrameworkOverview(
      frameworkId,
      organizationId
    ),
  });
}