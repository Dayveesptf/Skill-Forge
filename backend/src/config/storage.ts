/**
 * Object storage client for evidence attachments.
 *
 * Works with AWS S3 or any S3-compatible provider (Cloudflare R2,
 * Backblaze B2, MinIO, etc.) — set STORAGE_ENDPOINT for non-AWS providers.
 *
 * Files never pass through this server: the client requests a presigned
 * PUT url, uploads directly to the bucket, then confirms the upload
 * (see modules/evidence). Reads use short-lived presigned GET urls
 * generated on demand — nothing is public by default.
 */
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

const STORAGE_BUCKET = process.env.STORAGE_BUCKET;
const STORAGE_REGION = process.env.STORAGE_REGION || "auto";
const STORAGE_ACCESS_KEY_ID = process.env.STORAGE_ACCESS_KEY_ID;
const STORAGE_SECRET_ACCESS_KEY = process.env.STORAGE_SECRET_ACCESS_KEY;
const STORAGE_ENDPOINT = process.env.STORAGE_ENDPOINT; // e.g. R2 endpoint; omit for AWS S3

const UPLOAD_URL_EXPIRES_SECONDS = 5 * 60; // 5 minutes to start the upload
const DOWNLOAD_URL_EXPIRES_SECONDS = 15 * 60; // 15 minutes to view/download

let client: S3Client | undefined;

function isConfigured(): boolean {
  return Boolean(
    STORAGE_BUCKET && STORAGE_ACCESS_KEY_ID && STORAGE_SECRET_ACCESS_KEY
  );
}

function getClient(): S3Client {
  if (!isConfigured()) {
    throw new Error(
      "Object storage is not configured. Set STORAGE_BUCKET, STORAGE_ACCESS_KEY_ID and STORAGE_SECRET_ACCESS_KEY (and STORAGE_ENDPOINT for non-AWS providers)."
    );
  }

  if (!client) {
    client = new S3Client({
      region: STORAGE_REGION,
      endpoint: STORAGE_ENDPOINT,
      forcePathStyle: Boolean(STORAGE_ENDPOINT), // required by most non-AWS S3-compatible providers
      credentials: {
        accessKeyId: STORAGE_ACCESS_KEY_ID as string,
        secretAccessKey: STORAGE_SECRET_ACCESS_KEY as string,
      },
    });
  }

  return client;
}

/**
 * Builds a namespaced, collision-resistant object key.
 * Never trust the client-supplied filename as a path — only use it
 * for the human-readable suffix.
 */
export function buildEvidenceKey(params: {
  organizationId?: string;
  selfAssessmentId: string;
  responseId: string;
  filename: string;
}): string {
  const safeName = params.filename
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(-100);

  const unique = crypto.randomUUID();
  const org = params.organizationId || "no-org";

  return `evidence/${org}/${params.selfAssessmentId}/${params.responseId}/${unique}-${safeName}`;
}

export async function getUploadUrl(params: {
  key: string;
  contentType: string;
}): Promise<{ uploadUrl: string; expiresIn: number }> {
  const command = new PutObjectCommand({
    Bucket: STORAGE_BUCKET,
    Key: params.key,
    ContentType: params.contentType,
  });

  const uploadUrl = await getSignedUrl(getClient(), command, {
    expiresIn: UPLOAD_URL_EXPIRES_SECONDS,
  });

  return { uploadUrl, expiresIn: UPLOAD_URL_EXPIRES_SECONDS };
}

export async function getDownloadUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: STORAGE_BUCKET,
    Key: key,
  });

  return getSignedUrl(getClient(), command, {
    expiresIn: DOWNLOAD_URL_EXPIRES_SECONDS,
  });
}

/**
 * Confirms the object actually exists in the bucket (i.e. the client
 * really did complete the presigned upload) and returns its real
 * size/content-type as reported by the storage provider, rather than
 * trusting whatever the client claims.
 */
export async function headObject(
  key: string
): Promise<{ size: number; contentType?: string }> {
  const command = new HeadObjectCommand({
    Bucket: STORAGE_BUCKET,
    Key: key,
  });

  const result = await getClient().send(command);

  return {
    size: result.ContentLength ?? 0,
    contentType: result.ContentType,
  };
}

export async function deleteObject(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: STORAGE_BUCKET,
    Key: key,
  });

  await getClient().send(command);
}

export const storageConfigured = isConfigured;