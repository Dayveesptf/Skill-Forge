import crypto from "crypto";
import { Types } from "mongoose";
import jwt from "jsonwebtoken";
import { User } from "../../models/User";
import { Organization } from "../../models/Organization";
import { createAccessToken } from "../../utils/jwt";
import { sha256, randomToken } from "../../utils/security";
import { sanitizeUser } from "../auth/auth.service";
import { writeAuditLog } from "../../utils/audit";
import { encryptSecret, decryptSecret } from "../../utils/crypto";
import { env } from "../../config/env";
import {
  BillingAccount, ExternalIdentity,
  ImpersonationSession, Integration, MfaCredential, ScheduledReport,
  SsoProvider, SsoTransaction, SupportTicket,
  type ReportFormat, type ReportFrequency, type IntegrationType
} from "./infrastructure.models";
import { Notification, NotificationPriority, NotificationType } from "../../models/Notification";
import { getOrganizationAnalytics } from "../reports/reports.service";

function oid(value: string, label: string) {
  if (!Types.ObjectId.isValid(value)) throw new Error(`${label} is invalid`);
  return new Types.ObjectId(value);
}

function base32Encode(buffer: Buffer) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0; let value = 0; let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { output += alphabet[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}
function base32Decode(input: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = input.toUpperCase().replace(/=+$/g, "").replace(/\s/g, "");
  let bits = 0; let value = 0; const out: number[] = [];
  for (const char of clean) {
    const idx = alphabet.indexOf(char); if (idx < 0) throw new Error("Invalid MFA secret");
    value = (value << 5) | idx; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}
function totp(secret: string, step: number) {
  const key = base32Decode(secret);
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(step));
  const digest = crypto.createHmac("sha1", key).update(counter).digest();
  const offset = digest[digest.length - 1] & 15;
  const binary = ((digest[offset] & 127) << 24) | ((digest[offset + 1] & 255) << 16) | ((digest[offset + 2] & 255) << 8) | (digest[offset + 3] & 255);
  return String(binary % 1_000_000).padStart(6, "0");
}
function verifyTotp(secret: string, code: string, now = Date.now()) {
  const step = Math.floor(now / 30000);
  for (const delta of [-1, 0, 1]) if (totp(secret, step + delta) === code) return step + delta;
  return null;
}
function randomBackupCode() { return crypto.randomBytes(5).toString("hex").toUpperCase(); }

export async function beginMfaSetup(userId: string) {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");
  const secret = base32Encode(crypto.randomBytes(20));
  await MfaCredential.findOneAndUpdate({ userId: oid(userId, "user id") }, { secret, enabled: false, backupCodeHashes: [] }, { upsert: true, new: true });
  const issuer = encodeURIComponent("SkillForge");
  const account = encodeURIComponent(user.email);
  return { secret, otpauthUrl: `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30` };
}
export async function enableMfa(userId: string, code: string) {
  const credential = await MfaCredential.findOne({ userId: oid(userId, "user id") });
  if (!credential) throw new Error("Start MFA setup first");
  const step = verifyTotp(credential.secret, code);
  if (step === null) throw new Error("Invalid verification code");
  const backupCodes = Array.from({ length: 8 }, randomBackupCode);
  credential.backupCodeHashes = backupCodes.map(sha256);
  credential.enabled = true;
  credential.lastUsedStep = step;
  await credential.save();
  return { enabled: true, backupCodes };
}
export async function disableMfa(userId: string) {
  await MfaCredential.findOneAndDelete({ userId: oid(userId, "user id") });
  return { enabled: false };
}
export async function getMfaStatus(userId: string) {
  const credential = await MfaCredential.findOne({ userId: oid(userId, "user id") }).select("enabled");
  return { enabled: Boolean(credential?.enabled) };
}
export function createMfaChallenge(userId: string) {
  return jwt.sign(
    { userId, purpose: "MFA_LOGIN" },
    env.jwtAccessSecret,
    { expiresIn: "5m" }
  );
}

export async function verifyMfaLogin(challenge: string, code: string) {
  const payload = jwt.verify(challenge, env.jwtAccessSecret) as { userId: string; purpose?: string };
  if (payload.purpose !== "MFA_LOGIN") throw new Error("Invalid MFA challenge");
  const user = await User.findById(payload.userId).select("+passwordHash +refreshTokenHash +refreshTokenExpiresAt");
  if (!user || !user.isActive) throw new Error("Invalid MFA challenge");
  const credential = await MfaCredential.findOne({ userId: user._id });
  if (!credential?.enabled) throw new Error("MFA is not enabled");
  const normalized = code.trim().toUpperCase();
  const step = verifyTotp(credential.secret, normalized);
  let valid = step !== null && step !== credential.lastUsedStep;
  if (!valid) {
    const hash = sha256(normalized);
    const idx = credential.backupCodeHashes.indexOf(hash);
    if (idx >= 0) { credential.backupCodeHashes.splice(idx, 1); valid = true; }
  }
  if (!valid) throw new Error("Invalid MFA code");
  if (step !== null) credential.lastUsedStep = step;
  await credential.save();
  const sessionPayload = { userId: user._id.toString(), role: user.role, organizationId: user.organizationId?.toString() };
  const accessToken = createAccessToken(sessionPayload);
  const refreshToken = randomToken();
  user.refreshTokenHash = sha256(refreshToken);
  user.refreshTokenExpiresAt = new Date(Date.now() + 7 * 86400000);
  user.lastLoginAt = new Date();
  await user.save();
  return { user: sanitizeUser(user), accessToken, refreshToken };
}

export async function getSsoProvider(organizationId: string) {
  return SsoProvider.findOne({ organizationId: oid(organizationId, "organization id") }).select("-clientSecret").lean();
}
export async function saveSsoProvider(organizationId: string, data: any) {
  const id = oid(organizationId, "organization id");
  const safeData = { ...data, clientSecret: encryptSecret(data.clientSecret), idpCert: encryptSecret(data.idpCert) };
  const provider = await SsoProvider.findOneAndUpdate({ organizationId: id }, { $set: { ...safeData, organizationId: id } }, { upsert: true, new: true, runValidators: true }).select("-clientSecret");
  return provider;
}
export async function startOidcLogin(organizationIdOrSlug: string) {
  const organization = Types.ObjectId.isValid(organizationIdOrSlug) ? await Organization.findById(organizationIdOrSlug).select("_id") : await Organization.findOne({ slug: organizationIdOrSlug.toLowerCase().trim() }).select("_id");
  if (!organization) throw new Error("Organization not found");
  const organizationId = organization._id.toString();
  const provider = await SsoProvider.findOne({ organizationId: organization._id, type: "OIDC", enabled: true }).select("+clientSecret");
  if (!provider || !provider.clientId || !provider.clientSecret || !provider.issuerUrl) throw new Error("OIDC SSO is not configured");
  let authorizationUrl = provider.authorizationUrl;
  let tokenUrl = provider.tokenUrl;
  let userInfoUrl = provider.userInfoUrl;
  if (!authorizationUrl || !tokenUrl) {
    const discovery = await fetch(`${provider.issuerUrl.replace(/\/$/, "")}/.well-known/openid-configuration`).then(r => { if (!r.ok) throw new Error("OIDC discovery failed"); return r.json() as Promise<any>; });
    authorizationUrl ||= discovery.authorization_endpoint;
    tokenUrl ||= discovery.token_endpoint;
    userInfoUrl ||= discovery.userinfo_endpoint;
  }
  if (!authorizationUrl || !tokenUrl) throw new Error("OIDC provider endpoints are incomplete");
  const state = randomToken(); const nonce = randomToken();
  await SsoTransaction.create({ kind: "LOGIN", providerId: provider._id, organizationId: provider.organizationId, tokenHash: sha256(state), state, nonce, metadata: { tokenUrl, userInfoUrl }, expiresAt: new Date(Date.now() + 10 * 60 * 1000) });
  const params = new URLSearchParams({ response_type: "code", client_id: provider.clientId, redirect_uri: `${env.clientUrl}/sso/callback`, scope: "openid profile email", state, nonce });
  return `${authorizationUrl}?${params.toString()}`;
}
async function findOrCreateSsoUser(provider: any, profile: any, providerSubject: string) {
  const email = String(profile.email || "").toLowerCase().trim(); if (!email) throw new Error("SSO provider did not return an email");
  const domain = email.split("@")[1];
  if (provider.allowedDomains.length && !provider.allowedDomains.includes(domain)) throw new Error("Your email domain is not allowed for this organization");
  let identity = await ExternalIdentity.findOne({ providerId: provider._id, subject: providerSubject });
  if (identity) return User.findById(identity.userId);
  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({ firstName: String(profile.given_name || profile.firstName || "SSO"), lastName: String(profile.family_name || profile.lastName || "User"), email, passwordHash: crypto.randomBytes(32).toString("hex"), role: "STAFF", organizationId: provider.organizationId, isActive: true });
  } else if (!user.organizationId) { user.organizationId = provider.organizationId; await user.save(); }
  if (user.organizationId?.toString() !== provider.organizationId.toString()) throw new Error("This account belongs to another organization");
  await ExternalIdentity.create({ organizationId: provider.organizationId, userId: user._id, providerId: provider._id, providerType: provider.type, subject: providerSubject, email });
  return user;
}
export async function finishOidcLogin(state: string, code: string) {
  const tx = await SsoTransaction.findOne({ kind: "LOGIN", tokenHash: sha256(state), expiresAt: { $gt: new Date() }, usedAt: { $exists: false } });
  if (!tx) throw new Error("Invalid or expired SSO state");
  tx.usedAt = new Date(); await tx.save();
  const provider = await SsoProvider.findById(tx.providerId).select("+clientSecret"); if (!provider || !provider.clientId || !provider.clientSecret) throw new Error("SSO provider not found");
  const meta = tx.metadata as any;
  const clientSecret = decryptSecret(provider.clientSecret);
  if (!clientSecret) throw new Error("SSO client secret is not configured");
  const body = new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: `${env.clientUrl}/sso/callback`, client_id: provider.clientId, client_secret: clientSecret });
  const tokenResponse = await fetch(meta.tokenUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body }).then(r => r.json() as Promise<any>);
  if (!tokenResponse.access_token) throw new Error("SSO token exchange failed");
  const claims = tokenResponse.id_token ? JSON.parse(Buffer.from(tokenResponse.id_token.split(".")[1], "base64url").toString("utf8")) : {};
  const profile = meta.userInfoUrl ? await fetch(meta.userInfoUrl, { headers: { Authorization: `Bearer ${tokenResponse.access_token}` } }).then(r => r.json() as Promise<any>) : claims;
  const subject = String(claims.sub || profile.sub || profile.id || ""); if (!subject) throw new Error("SSO provider did not return a subject");
  const user = await findOrCreateSsoUser(provider, { ...claims, ...profile }, subject); if (!user) throw new Error("Unable to provision SSO user");
  const oneTimeCode = randomToken(); await SsoTransaction.create({ kind: "CODE", providerId: provider._id, organizationId: provider.organizationId, tokenHash: sha256(oneTimeCode), metadata: { userId: user._id.toString() }, expiresAt: new Date(Date.now() + 2 * 60 * 1000) });
  return oneTimeCode;
}
export async function exchangeSsoCode(code: string) {
  const tx = await SsoTransaction.findOneAndUpdate({ kind: "CODE", tokenHash: sha256(code), expiresAt: { $gt: new Date() }, usedAt: { $exists: false } }, { $set: { usedAt: new Date() } }, { new: true });
  if (!tx) throw new Error("Invalid or expired SSO code");
  const user = await User.findById((tx.metadata as any).userId); if (!user || !user.isActive) throw new Error("SSO user is inactive");
  const payload = { userId: user._id.toString(), role: user.role, organizationId: user.organizationId?.toString() };
  const accessToken = createAccessToken(payload); const refreshToken = randomToken(); user.refreshTokenHash = sha256(refreshToken); user.refreshTokenExpiresAt = new Date(Date.now() + 7 * 86400000); user.lastLoginAt = new Date(); await user.save();
  return { user: sanitizeUser(user), accessToken, refreshToken };
}

export async function upsertBillingAccount(organizationId: string) { return BillingAccount.findOneAndUpdate({ organizationId: oid(organizationId, "organization id") }, { $setOnInsert: { status: "UNCONFIGURED" } }, { upsert: true, new: true }); }
async function stripe(path: string, method: string, body?: Record<string, string>) {
  if (!env.stripeSecretKey) throw new Error("Stripe is not configured");
  const response = await fetch(`https://api.stripe.com/v1/${path}`, { method, headers: { Authorization: `Bearer ${env.stripeSecretKey}`, "Content-Type": "application/x-www-form-urlencoded" }, body: body ? new URLSearchParams(body).toString() : undefined });
  const data = await response.json() as any; if (!response.ok) throw new Error(data?.error?.message || "Stripe request failed"); return data;
}
export async function createStripeCheckout(organizationId: string, priceId: string, successUrl: string, cancelUrl: string) {
  const org = await Organization.findById(oid(organizationId, "organization id")); if (!org) throw new Error("Organization not found");
  const account = await upsertBillingAccount(organizationId);
  let customerId: string = account?.stripeCustomerId ?? "";
  if (!customerId) { const customer = await stripe("customers", "POST", { name: org.name, metadata: JSON.stringify({ organizationId }) }); customerId = customer.id as string; await BillingAccount.updateOne({ organizationId: org._id }, { stripeCustomerId: customerId }); }
  return stripe("checkout/sessions", "POST", { mode: "subscription", customer: customerId, "line_items[0][price]": priceId, "line_items[0][quantity]": "1", success_url: successUrl, cancel_url: cancelUrl, "metadata[organizationId]": organizationId });
}
export async function createStripePortal(organizationId: string, returnUrl: string) { const account = await BillingAccount.findOne({ organizationId: oid(organizationId, "organization id") }); if (!account?.stripeCustomerId) throw new Error("Billing customer is not configured"); return stripe("billing_portal/sessions", "POST", { customer: account.stripeCustomerId, return_url: returnUrl }); }
export function verifyStripeWebhook(rawBody: string, signature: string) {
  if (!env.stripeWebhookSecret) throw new Error("Stripe webhook secret is not configured");
  const parts = Object.fromEntries(signature.split(",").map(p => p.split("=", 2))); const timestamp = parts.t; const v1 = parts.v1;
  if (!timestamp || !v1) throw new Error("Invalid Stripe signature");
  const expected = crypto.createHmac("sha256", env.stripeWebhookSecret).update(`${timestamp}.${rawBody}`).digest("hex"); if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1))) throw new Error("Invalid Stripe signature");
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) throw new Error("Expired Stripe webhook");
  return JSON.parse(rawBody);
}
export async function syncBillingFromStripeEvent(event: any) { const object = event.data?.object; const organizationId = object?.metadata?.organizationId; if (!organizationId) return; const status = event.type.includes("deleted") ? "CANCELED" : String(object.status || "UNCONFIGURED").toUpperCase(); await BillingAccount.updateOne({ organizationId }, { $set: { stripeCustomerId: object.customer, stripeSubscriptionId: object.id, stripePriceId: object.items?.data?.[0]?.price?.id, status, currentPeriodEnd: object.current_period_end ? new Date(object.current_period_end * 1000) : undefined, cancelAtPeriodEnd: Boolean(object.cancel_at_period_end) } }, { upsert: true }); await Organization.updateOne({ _id: organizationId }, { $set: { "subscription.status": status === "ACTIVE" || status === "TRIALING" ? "ACTIVE" : status === "PAST_DUE" ? "SUSPENDED" : status === "CANCELED" ? "SUSPENDED" : "TRIAL" } }); }

export async function listIntegrations(organizationId: string) { return Integration.find({ organizationId: oid(organizationId, "organization id") }).select("-apiKey -webhookSecret").lean(); }
export async function saveIntegration(organizationId: string, data: { type: IntegrationType; name: string; baseUrl: string; apiKey?: string; webhookSecret?: string; config?: Record<string, unknown> }) { return Integration.findOneAndUpdate({ organizationId: oid(organizationId, "organization id"), type: data.type }, { $set: { ...data, apiKey: encryptSecret(data.apiKey), webhookSecret: encryptSecret(data.webhookSecret), status: "DISCONNECTED" } }, { upsert: true, new: true, runValidators: true }).select("-apiKey -webhookSecret"); }
export async function testIntegration(organizationId: string, type: IntegrationType) { const integration = await Integration.findOne({ organizationId: oid(organizationId, "organization id"), type }).select("+apiKey +webhookSecret"); if (!integration) throw new Error("Integration not configured"); const headers: Record<string, string> = { Accept: "application/json" }; if (integration.apiKey) headers.Authorization = `Bearer ${decryptSecret(integration.apiKey)}`; const response = await fetch(integration.baseUrl.replace(/\/$/, ""), { headers }); const text = await response.text(); if (!response.ok) { integration.status = "ERROR"; integration.lastError = text.slice(0, 1000); await integration.save(); throw new Error(`Integration test failed (${response.status})`); } integration.status = "CONNECTED"; integration.lastError = undefined; integration.lastSyncAt = new Date(); await integration.save(); return { status: integration.status, response: text.slice(0, 500) }; }
export async function syncIntegration(organizationId: string, type: IntegrationType) { const integration = await Integration.findOne({ organizationId: oid(organizationId, "organization id"), type }).select("+apiKey"); if (!integration) throw new Error("Integration not configured"); const url = `${integration.baseUrl.replace(/\/$/, "")}/employees`; const headers: Record<string, string> = { Accept: "application/json" }; if (integration.apiKey) headers.Authorization = `Bearer ${decryptSecret(integration.apiKey)}`; const response = await fetch(url, { headers }); if (!response.ok) throw new Error(`Sync failed (${response.status})`); const payload = await response.json() as any; integration.lastSyncAt = new Date(); integration.status = "CONNECTED"; await integration.save(); return payload; }

export async function createSupportTicket(organizationId: string, createdBy: string, data: any) { return SupportTicket.create({ organizationId: oid(organizationId, "organization id"), createdBy: oid(createdBy, "user id"), ...data }); }
export async function listSupportTickets(organizationId?: string) { const filter = organizationId ? { organizationId: oid(organizationId, "organization id") } : {}; return SupportTicket.find(filter).populate("createdBy", "firstName lastName email").populate("assignedTo", "firstName lastName email").sort({ createdAt: -1 }).limit(500); }
export async function updateSupportTicket(id: string, data: any) { return SupportTicket.findByIdAndUpdate(oid(id, "ticket id"), { $set: data }, { new: true, runValidators: true }); }
export async function startImpersonation(supportUserId: string, targetUserId: string, reason: string, req: any) {
  const support = await User.findById(oid(supportUserId, "support user id")); const target = await User.findById(oid(targetUserId, "target user id"));
  if (!support || support.role !== "PLATFORM_ADMIN") throw new Error("Platform Admin access is required"); if (!target || !target.organizationId) throw new Error("Target user not found");
  const raw = randomToken(); const session = await ImpersonationSession.create({ supportUserId: support._id, targetUserId: target._id, targetOrganizationId: target.organizationId, reason, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + 30 * 60 * 1000) });
  const token = createAccessToken({ userId: target._id.toString(), role: target.role, organizationId: target.organizationId.toString() } as any);
  await writeAuditLog(req, "IMPERSONATION_STARTED", "ImpersonationSession", session.id, { targetUserId: target.id, reason, expiresAt: session.expiresAt.toISOString() });
  return { sessionId: session.id, accessToken: token, expiresAt: session.expiresAt, user: sanitizeUser(target) };
}
export async function endImpersonation(sessionId: string, req: any) { const session = await ImpersonationSession.findOneAndUpdate({ _id: oid(sessionId, "session id"), endedAt: { $exists: false } }, { $set: { endedAt: new Date() } }, { new: true }); if (!session) throw new Error("Impersonation session not found"); await writeAuditLog(req, "IMPERSONATION_ENDED", "ImpersonationSession", session.id); return session; }

function nextRun(frequency: ReportFrequency, from = new Date()) { const d = new Date(from); if (frequency === "DAILY") d.setDate(d.getDate() + 1); else if (frequency === "WEEKLY") d.setDate(d.getDate() + 7); else d.setMonth(d.getMonth() + 1); d.setHours(8, 0, 0, 0); return d; }
export async function createScheduledReport(input: { organizationId: string; createdBy: string; name: string; format: ReportFormat; frequency: ReportFrequency; recipients: string[]; nextRunAt?: string }) { if (!input.recipients.length) throw new Error("At least one recipient is required"); return ScheduledReport.create({ organizationId: oid(input.organizationId, "organization id"), createdBy: oid(input.createdBy, "user id"), name: input.name, format: input.format, frequency: input.frequency, recipients: input.recipients, nextRunAt: input.nextRunAt ? new Date(input.nextRunAt) : nextRun(input.frequency) }); }
export async function listScheduledReports(organizationId: string) { return ScheduledReport.find({ organizationId: oid(organizationId, "organization id") }).sort({ nextRunAt: 1 }); }
export async function deleteScheduledReport(organizationId: string, id: string) { return ScheduledReport.findOneAndDelete({ _id: oid(id, "scheduled report id"), organizationId: oid(organizationId, "organization id") }); }
export async function dueScheduledReports() { return ScheduledReport.find({ active: true, nextRunAt: { $lte: new Date() } }).limit(20); }
export async function markScheduledReportRun(report: any, error?: string) { report.lastRunAt = new Date(); report.lastError = error; if (!error) report.nextRunAt = nextRun(report.frequency, report.lastRunAt); await report.save(); }

export async function buildExportRows(organizationId: string) { const analytics = await getOrganizationAnalytics({ organizationId }); return { generatedAt: new Date().toISOString(), organizationId, analytics }; }

export { Notification, NotificationPriority, NotificationType };
