import { Response } from "express";
import { AuthenticatedRequest } from "../../middleware/auth";
import { UserRole } from "../../constants/roles";
import {
  generateGapAnalysis,
  getLatestGapAnalysis,
  getGapAnalysisById,
  getCandidateDashboard,
  getOrganizationDashboard,
} from "./gapAnalysis.service";
import { canAccessCandidate } from "../access/candidateAccess";

function getRouteParam(
  req: AuthenticatedRequest,
  name: string
): string {
  const value = req.params[name];

  if (!value || Array.isArray(value)) {
    throw new Error(`Missing or invalid route parameter: ${name}`);
  }

  return value;
}

function getOrganizationId(
  req: AuthenticatedRequest
): string | undefined {
  if (req.user?.role === UserRole.PLATFORM_ADMIN) {
    return undefined;
  }

  return req.user?.organizationId;
}

function isAdmin(req: AuthenticatedRequest): boolean {
  return (
    req.user?.role === UserRole.PLATFORM_ADMIN ||
    req.user?.role === UserRole.ORGANIZATION_ADMIN
  );
}

function requireOrganizationContext(
  req: AuthenticatedRequest
): string {
  const organizationId = req.user?.organizationId;

  if (!organizationId) {
    throw new Error("Organization context is required");
  }

  return organizationId;
}

export async function generate(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const candidateId = getRouteParam(req, "candidateId");
    const roleProfileId = getRouteParam(req, "roleProfileId");

    const allowed = await canAccessCandidate(req, candidateId);

    if (!allowed) {
      return res.status(403).json({
        message: "You are not allowed to access this candidate",
      });
    }

    const analysis = await generateGapAnalysis({
      candidateId,
      roleProfileId,
      organizationId: getOrganizationId(req),
    });

    return res.status(201).json(analysis);
  } catch (error) {
    console.error("Generate gap analysis error:", error);

    return res.status(400).json({
      message:
        error instanceof Error
          ? error.message
          : "Unable to generate gap analysis",
    });
  }
}

export async function getLatest(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const candidateId = getRouteParam(req, "candidateId");
    const roleProfileId = getRouteParam(req, "roleProfileId");

    const allowed = await canAccessCandidate(req, candidateId);

    if (!allowed) {
      return res.status(403).json({
        message: "You are not allowed to access this candidate",
      });
    }

    const analysis = await getLatestGapAnalysis(
      candidateId,
      roleProfileId,
      getOrganizationId(req)
    );

    if (!analysis) {
      return res.status(404).json({
        message: "Gap analysis not found",
      });
    }

    return res.json(analysis);
  } catch (error) {
    console.error("Get latest gap analysis error:", error);

    return res.status(400).json({
      message:
        error instanceof Error
          ? error.message
          : "Unable to get gap analysis",
    });
  }
}

export async function getById(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const id = getRouteParam(req, "id");

    const analysis = await getGapAnalysisById(
      id,
      getOrganizationId(req)
    );

    if (!analysis) {
      return res.status(404).json({
        message: "Gap analysis not found",
      });
    }

    const candidateId = analysis.candidateId.toString();

    const allowed = await canAccessCandidate(req, candidateId);

    if (!allowed) {
      return res.status(403).json({
        message: "You are not allowed to access this candidate",
      });
    }

    return res.json(analysis);
  } catch (error) {
    console.error("Get gap analysis error:", error);

    return res.status(400).json({
      message:
        error instanceof Error
          ? error.message
          : "Unable to get gap analysis",
    });
  }
}

export async function candidateDashboard(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const candidateId = getRouteParam(req, "candidateId");

    const allowed = await canAccessCandidate(req, candidateId);

    if (!allowed) {
      return res.status(403).json({
        message: "You are not allowed to access this candidate",
      });
    }

    const dashboard = await getCandidateDashboard({
      candidateId,
      organizationId: getOrganizationId(req),
    });

    return res.json(dashboard);
  } catch (error) {
    console.error("Get candidate gap dashboard error:", error);

    return res.status(400).json({
      message:
        error instanceof Error
          ? error.message
          : "Unable to get candidate dashboard",
    });
  }
}

export async function organizationDashboard(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({
        message: "Admin access required",
      });
    }

    const organizationId =
      req.user?.role === UserRole.PLATFORM_ADMIN
        ? req.user.organizationId
        : requireOrganizationContext(req);

    const dashboard = await getOrganizationDashboard({
      organizationId,
    });

    return res.json(dashboard);
  } catch (error) {
    console.error("Get organization gap dashboard error:", error);

    return res.status(400).json({
      message:
        error instanceof Error
          ? error.message
          : "Unable to get organization dashboard",
    });
  }
}