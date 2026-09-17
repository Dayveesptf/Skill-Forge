import { Response } from "express";

import { AuthenticatedRequest } from "../../middleware/auth";
import { writeAuditLog } from "../../utils/audit";

import {
  requestEvidenceUploadUrl,
  confirmEvidenceUpload,
  listEvidenceForResponse,
  removeEvidenceAttachment,
} from "./evidence.service";

import {
  canAccessCandidate,
} from "../access/candidateAccess";

import { SelfAssessmentResponse } from "../../models/SelfAssessmentResponse";
import { SelfAssessment } from "../../models/SelfAssessment";

function getOrganizationId(req: AuthenticatedRequest): string | undefined {
  return req.user?.organizationId;
}

function getRouteParam(
  value: string | string[] | undefined,
  name: string,
): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}

/*
 * Only STAFF can request an upload URL / confirm / delete evidence
 * on their own self-assessment. Route-level `authorize(UserRole.STAFF)`
 * already restricts this, so req.user.userId IS the candidateId here.
 */

export async function getUploadUrl(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const responseId = getRouteParam(req.params.responseId, "responseId");
    const { filename, contentType, size } = req.body;

    const result = await requestEvidenceUploadUrl({
      responseId,
      candidateId: req.user.userId,
      organizationId: getOrganizationId(req),
      filename,
      contentType,
      size: Number(size),
    });

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Could not create upload URL",
    });
  }
}

export async function confirmUpload(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const responseId = getRouteParam(req.params.responseId, "responseId");
    const { key, filename } = req.body;

    if (typeof key !== "string" || !key) {
      res.status(400).json({ success: false, message: "key is required" });
      return;
    }

    if (typeof filename !== "string" || !filename) {
      res.status(400).json({ success: false, message: "filename is required" });
      return;
    }

    const response = await confirmEvidenceUpload({
      responseId,
      candidateId: req.user.userId,
      organizationId: getOrganizationId(req),
      key,
      filename,
    });

    await writeAuditLog(
      req,
      "EVIDENCE_ATTACHMENT_ADDED",
      "SelfAssessmentResponse",
      responseId,
      { key },
    );

    res.status(201).json({ success: true, data: response });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Could not confirm upload",
    });
  }
}

export async function listAttachments(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const responseId = getRouteParam(req.params.responseId, "responseId");

    const response = await SelfAssessmentResponse.findById(responseId);
    if (!response) {
      res.status(404).json({ success: false, message: "Response not found" });
      return;
    }

    const selfAssessment = await SelfAssessment.findById(response.selfAssessmentId);
    if (!selfAssessment) {
      res.status(404).json({ success: false, message: "Self-assessment not found" });
      return;
    }

    const organizationId = getOrganizationId(req);
    if (
      organizationId &&
      selfAssessment.organizationId &&
      selfAssessment.organizationId.toString() !== organizationId
    ) {
      res.status(404).json({ success: false, message: "Response not found" });
      return;
    }

    if (!(await canAccessCandidate(req, selfAssessment.candidateId.toString()))) {
      res.status(403).json({
        success: false,
        message: "You do not have access to this evidence",
      });
      return;
    }

    const attachments = await listEvidenceForResponse({ responseId });

    res.json({ success: true, data: attachments });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Could not load evidence",
    });
  }
}

export async function removeAttachment(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const responseId = getRouteParam(req.params.responseId, "responseId");
    const key = getRouteParam(req.params.key, "key");

    const result = await removeEvidenceAttachment({
      responseId,
      candidateId: req.user.userId,
      organizationId: getOrganizationId(req),
      key: decodeURIComponent(key),
    });

    await writeAuditLog(
      req,
      "EVIDENCE_ATTACHMENT_REMOVED",
      "SelfAssessmentResponse",
      responseId,
      { key },
    );

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Could not remove attachment",
    });
  }
}