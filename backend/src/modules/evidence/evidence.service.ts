import { Types } from "mongoose";

import {
  SelfAssessmentResponse,
} from "../../models/SelfAssessmentResponse";

import {
  SelfAssessment,
  SelfAssessmentStatus,
} from "../../models/SelfAssessment";

import {
  buildEvidenceKey,
  getUploadUrl,
  getDownloadUrl,
  headObject,
  deleteObject,
} from "../../config/storage";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

function toObjectId(value: string, fieldName: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new Error(`${fieldName} is invalid`);
  }
  return new Types.ObjectId(value);
}

async function getEditableResponse(params: {
  responseId: string;
  candidateId: string;
  organizationId?: string;
}) {
  const response = await SelfAssessmentResponse.findById(
    toObjectId(params.responseId, "responseId"),
  );

  if (!response) {
    throw new Error("Self-assessment response not found");
  }

  const selfAssessment = await SelfAssessment.findById(
    response.selfAssessmentId,
  );

  if (!selfAssessment) {
    throw new Error("Self-assessment not found");
  }

  if (
    selfAssessment.candidateId.toString() !== params.candidateId
  ) {
    throw new Error("You do not have access to this response");
  }

  if (
    params.organizationId &&
    selfAssessment.organizationId &&
    selfAssessment.organizationId.toString() !== params.organizationId
  ) {
    throw new Error("You do not have access to this response");
  }

  if (selfAssessment.status === SelfAssessmentStatus.SUBMITTED) {
    throw new Error(
      "Evidence cannot be modified once the self-assessment has been submitted",
    );
  }

  return { response, selfAssessment };
}

/* -------------------------------------------------------------------------- */
/* Request an upload URL                                                      */
/* -------------------------------------------------------------------------- */

export async function requestEvidenceUploadUrl(params: {
  responseId: string;
  candidateId: string;
  organizationId?: string;
  filename: string;
  contentType: string;
  size: number;
}) {
  if (!ALLOWED_MIME_TYPES.has(params.contentType)) {
    throw new Error(
      `File type "${params.contentType}" is not allowed. Allowed types: PDF, PNG, JPEG, WEBP, DOC, DOCX.`,
    );
  }

  if (!Number.isFinite(params.size) || params.size <= 0) {
    throw new Error("A valid file size is required");
  }

  if (params.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      `File is too large. Maximum size is ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.`,
    );
  }

  const { response, selfAssessment } = await getEditableResponse({
    responseId: params.responseId,
    candidateId: params.candidateId,
    organizationId: params.organizationId,
  });

  if (response.attachments.length >= 5) {
    throw new Error(
      "This response already has the maximum of 5 evidence attachments",
    );
  }

  const key = buildEvidenceKey({
    organizationId: selfAssessment.organizationId?.toString(),
    selfAssessmentId: selfAssessment._id.toString(),
    responseId: response._id.toString(),
    filename: params.filename,
  });

  const { uploadUrl, expiresIn } = await getUploadUrl({
    key,
    contentType: params.contentType,
  });

  return { key, uploadUrl, expiresIn };
}

/* -------------------------------------------------------------------------- */
/* Confirm an upload                                                          */
/* -------------------------------------------------------------------------- */

export async function confirmEvidenceUpload(params: {
  responseId: string;
  candidateId: string;
  organizationId?: string;
  key: string;
  filename: string;
}) {
  const { response } = await getEditableResponse({
    responseId: params.responseId,
    candidateId: params.candidateId,
    organizationId: params.organizationId,
  });

  if (!params.key.includes(response._id.toString())) {
    throw new Error("This upload key does not belong to this response");
  }

  if (response.attachments.length >= 5) {
    throw new Error(
      "This response already has the maximum of 5 evidence attachments",
    );
  }

  // Trust the storage provider, not the client, for size/content-type.
  const { size, contentType } = await headObject(params.key);

  if (size > MAX_UPLOAD_BYTES) {
    await deleteObject(params.key).catch(() => undefined);
    throw new Error("Uploaded file exceeds the maximum allowed size");
  }

  response.attachments.push({
    key: params.key,
    filename: params.filename.slice(0, 255),
    mimeType: contentType || "application/octet-stream",
    size,
    uploadedAt: new Date(),
    uploadedBy: toObjectId(params.candidateId, "candidateId"),
  } as any);

  await response.save();

  return response;
}

/* -------------------------------------------------------------------------- */
/* List (with fresh signed download URLs)                                    */
/* -------------------------------------------------------------------------- */

export async function listEvidenceForResponse(params: {
  responseId: string;
}) {
  const response = await SelfAssessmentResponse.findById(
    toObjectId(params.responseId, "responseId"),
  );

  if (!response) {
    throw new Error("Self-assessment response not found");
  }

  const attachments = await Promise.all(
    response.attachments.map(async (attachment) => ({
      key: attachment.key,
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      size: attachment.size,
      uploadedAt: attachment.uploadedAt,
      downloadUrl: await getDownloadUrl(attachment.key),
    })),
  );

  return attachments;
}

/* -------------------------------------------------------------------------- */
/* Delete                                                                     */
/* -------------------------------------------------------------------------- */

export async function removeEvidenceAttachment(params: {
  responseId: string;
  candidateId: string;
  organizationId?: string;
  key: string;
}) {
  const { response } = await getEditableResponse({
    responseId: params.responseId,
    candidateId: params.candidateId,
    organizationId: params.organizationId,
  });

  const exists = response.attachments.some((a) => a.key === params.key);
  if (!exists) {
    throw new Error("Attachment not found on this response");
  }

  response.attachments = response.attachments.filter(
    (a) => a.key !== params.key,
  ) as any;

  await response.save();
  await deleteObject(params.key).catch(() => undefined);

  return { deleted: true, key: params.key };
}