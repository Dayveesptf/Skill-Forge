import { Response } from "express";

import {
  AuthenticatedRequest,
} from "../../middleware/auth";

import {
  UserRole,
} from "../../constants/roles";

import {
  canAccessCandidate,
} from "../access/candidateAccess";

import {
  getCandidateRoleReport,
  getCandidateReportOverview,
  getOrganizationAnalytics,
  getCandidateRoleCsv,
  getOrganizationCsv,
} from "./reports.service";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function getRouteParam(
  value: string | string[] | undefined,
  paramName: string
): string {
  if (
    typeof value !== "string" ||
    value.trim() === ""
  ) {
    throw new Error(
      `${paramName} is required`
    );
  }

  return value;
}

function getOrganizationId(
  req: AuthenticatedRequest
): string | undefined {
  return req.user?.organizationId;
}

function isAdmin(
  req: AuthenticatedRequest
): boolean {
  return (
    req.user?.role ===
      UserRole.PLATFORM_ADMIN ||
    req.user?.role ===
      UserRole.ORGANIZATION_ADMIN
  );
}

/* -------------------------------------------------------------------------- */
/* Candidate Role Report                                                      */
/* -------------------------------------------------------------------------- */

export async function candidateRoleReport(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message:
          "Authentication required",
      });
      return;
    }

    const candidateId =
      getRouteParam(
        req.params.candidateId,
        "candidateId"
      );

    const roleProfileId =
      getRouteParam(
        req.params.roleProfileId,
        "roleProfileId"
      );

    if (
      !(await canAccessCandidate(
        req,
        candidateId
      ))
    ) {
      res.status(403).json({
        success: false,
        message:
          "You are not allowed to access this candidate report",
      });
      return;
    }

    const report =
      await getCandidateRoleReport({
        candidateId,
        roleProfileId,
        organizationId:
          getOrganizationId(req),
      });

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error(
      "Candidate role report error:",
      error
    );

    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to generate candidate report",
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Candidate Overview                                                         */
/* -------------------------------------------------------------------------- */

export async function candidateOverview(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message:
          "Authentication required",
      });
      return;
    }

    const candidateId =
      getRouteParam(
        req.params.candidateId,
        "candidateId"
      );

    if (
      !(await canAccessCandidate(
        req,
        candidateId
      ))
    ) {
      res.status(403).json({
        success: false,
        message:
          "You are not allowed to access this candidate report",
      });
      return;
    }

    const report =
      await getCandidateReportOverview({
        candidateId,
        organizationId:
          getOrganizationId(req),
      });

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error(
      "Candidate overview report error:",
      error
    );

    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to generate candidate overview",
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Candidate CSV                                                              */
/* -------------------------------------------------------------------------- */

export async function candidateCsv(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message:
          "Authentication required",
      });
      return;
    }

    const candidateId =
      getRouteParam(
        req.params.candidateId,
        "candidateId"
      );

    const roleProfileId =
      getRouteParam(
        req.params.roleProfileId,
        "roleProfileId"
      );

    if (
      !(await canAccessCandidate(
        req,
        candidateId
      ))
    ) {
      res.status(403).json({
        success: false,
        message:
          "You are not allowed to export this candidate report",
      });
      return;
    }

    const csv =
      await getCandidateRoleCsv({
        candidateId,
        roleProfileId,
        organizationId:
          getOrganizationId(req),
      });

    const filename =
      `skillforge-candidate-${candidateId}-report.csv`;

    res.setHeader(
      "Content-Type",
      "text/csv; charset=utf-8"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );

    res.status(200).send(csv);
  } catch (error) {
    console.error(
      "Candidate CSV export error:",
      error
    );

    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to export candidate report",
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Organization Analytics                                                     */
/* -------------------------------------------------------------------------- */

export async function organizationAnalytics(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message:
          "Authentication required",
      });
      return;
    }

    if (!isAdmin(req)) {
      res.status(403).json({
        success: false,
        message:
          "Only administrators can access organization analytics",
      });
      return;
    }

    const report =
      await getOrganizationAnalytics({
        organizationId:
          getOrganizationId(req),
      });

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error(
      "Organization analytics error:",
      error
    );

    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to generate organization analytics",
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Organization CSV                                                           */
/* -------------------------------------------------------------------------- */

export async function organizationCsv(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message:
          "Authentication required",
      });
      return;
    }

    if (!isAdmin(req)) {
      res.status(403).json({
        success: false,
        message:
          "Only administrators can export organization analytics",
      });
      return;
    }

    const csv =
      await getOrganizationCsv({
        organizationId:
          getOrganizationId(req),
      });

    const filename =
      "skillforge-organization-report.csv";

    res.setHeader(
      "Content-Type",
      "text/csv; charset=utf-8"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );

    res.status(200).send(csv);
  } catch (error) {
    console.error(
      "Organization CSV export error:",
      error
    );

    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to export organization analytics",
    });
  }
}