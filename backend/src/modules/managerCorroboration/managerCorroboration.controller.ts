import { Response } from "express";

import { AuthenticatedRequest } from "../../middleware/auth";

import {
  createPendingCorroborationForSubmittedAssessment,
  getPendingManagerCorroborations,
  getManagerCorroborations,
  getManagerCorroboration,
  reviewManagerCorroboration,
} from "./managerCorroboration.service";

function getOrganizationId(req: AuthenticatedRequest): string | undefined {
  return req.user?.organizationId;
}

function requireUser(req: AuthenticatedRequest, res: Response): string | undefined {
  if (!req.user?.userId) {
    res.status(401).json({ success: false, message: "Authentication required" });
    return undefined;
  }
  return req.user.userId;
}

function getRouteParam(value: string | string[] | undefined, name: string): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  return value.trim();
}

export async function createPendingCorroboration(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const selfAssessmentId = getRouteParam(req.params.selfAssessmentId, "selfAssessmentId");
    if (!selfAssessmentId) {
      res.status(400).json({ success: false, message: "selfAssessmentId is required" });
      return;
    }

    const result = await createPendingCorroborationForSubmittedAssessment(
      selfAssessmentId,
      getOrganizationId(req),
    );

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Could not create corroboration",
    });
  }
}

export async function getPendingCorroborations(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const managerId = requireUser(req, res);
    if (!managerId) return;

    const result = await getPendingManagerCorroborations({
      managerId,
      organizationId: getOrganizationId(req),
    });

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Could not load pending corroborations",
    });
  }
}

export async function getMyCorroborations(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const managerId = requireUser(req, res);
    if (!managerId) return;

    const result = await getManagerCorroborations({
      managerId,
      organizationId: getOrganizationId(req),
    });

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Could not load corroborations",
    });
  }
}

export async function getCorroboration(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const managerId = requireUser(req, res);
    if (!managerId) return;

    const id = getRouteParam(req.params.id, "id");
    if (!id) {
      res.status(400).json({ success: false, message: "Corroboration id is required" });
      return;
    }

    const result = await getManagerCorroboration(
      id,
      managerId,
      getOrganizationId(req),
    );

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error instanceof Error ? error.message : "Corroboration not found",
    });
  }
}

export async function reviewCorroboration(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const managerId = requireUser(req, res);
    if (!managerId) return;

    const corroborationId = getRouteParam(req.params.id, "id");
    if (!corroborationId) {
      res.status(400).json({ success: false, message: "Corroboration id is required" });
      return;
    }

    const decisions = req.body?.decisions;
    if (!Array.isArray(decisions)) {
      res.status(400).json({ success: false, message: "decisions must be an array" });
      return;
    }

    const result = await reviewManagerCorroboration({
      corroborationId,
      managerId,
      organizationId: getOrganizationId(req),
      decisions,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Could not complete corroboration",
    });
  }
}
