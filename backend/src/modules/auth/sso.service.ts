import { createRequire } from "module";
import { Types } from "mongoose";
import { env } from "../../config/env";
import { randomToken, sha256 } from "../../utils/security";
import { ExternalIdentity, SsoProvider, SsoTransaction } from "../infrastructure/infrastructure.models";
import { Organization } from "../../models/Organization";
import { User } from "../../models/User";
import { createAccessToken } from "../../utils/jwt";
import { sanitizeUser } from "./auth.service";
import { decryptSecret } from "../../utils/crypto";

const nodeRequire = createRequire(__filename);

function getSamlClass(): any {
  try {
    const module = nodeRequire("@node-saml/node-saml");
    return module.SAML || module.default?.SAML || module.default;
  } catch {
    throw new Error("SAML SSO requires the @node-saml/node-saml package. Run: npm install @node-saml/node-saml");
  }
}

export async function startSamlLogin(organizationIdOrSlug: string) {
  const organization = await Organization.findOne(Types.ObjectId.isValid(organizationIdOrSlug) ? { _id: organizationIdOrSlug } : { slug: organizationIdOrSlug.toLowerCase().trim() }).select("_id");
  if (!organization) throw new Error("Organization not found");
  const organizationId = organization._id.toString();
  const provider = await SsoProvider.findOne({ organizationId, type: "SAML", enabled: true });
  if (!provider?.entryPoint || !provider.idpCert) throw new Error("SAML SSO is not configured");
  const SAML = getSamlClass();
  const saml = new SAML({
    callbackUrl: `${env.clientUrl}/sso/saml/callback`,
    entryPoint: provider.entryPoint,
    issuer: provider.entityId || `skillforge-${organizationId}`,
    idpCert: decryptSecret(provider.idpCert),
    identifierFormat: null,
    disableRequestedAuthnContext: true
  });
  const state = randomToken();
  await SsoTransaction.create({ kind: "LOGIN", providerId: provider._id, organizationId: provider.organizationId, tokenHash: sha256(state), state, expiresAt: new Date(Date.now() + 10 * 60 * 1000) });
  const url = await saml.getAuthorizeUrlAsync(state, "", { additionalAuthorizeParams: { RelayState: state } });
  return url;
}

export async function finishSamlLogin(state: string, body: Record<string, unknown>) {
  const tx = await SsoTransaction.findOne({ kind: "LOGIN", tokenHash: sha256(state), expiresAt: { $gt: new Date() }, usedAt: { $exists: false } });
  if (!tx) throw new Error("Invalid or expired SAML state");
  const provider = await SsoProvider.findById(tx.providerId).select("+clientSecret");
  if (!provider?.entryPoint || !provider.idpCert) throw new Error("SAML provider not found");
  const SAML = getSamlClass();
  const saml = new SAML({ callbackUrl: `${env.clientUrl}/sso/saml/callback`, entryPoint: provider.entryPoint, issuer: provider.entityId || `skillforge-${tx.organizationId}`, idpCert: decryptSecret(provider.idpCert), identifierFormat: null, disableRequestedAuthnContext: true });
  const profile = await saml.validatePostResponseAsync(body as any);
  const email = String(profile?.email || profile?.mail || profile?.nameID || "").toLowerCase().trim();
  if (!email) throw new Error("SAML provider did not return an email");
  const domain = email.split("@")[1];
  if (provider.allowedDomains.length && !provider.allowedDomains.includes(domain)) throw new Error("Your email domain is not allowed for this organization");
  const subject = String(profile?.nameID || email);
  let identity = await ExternalIdentity.findOne({ providerId: provider._id, subject });
  let user = identity ? await User.findById(identity.userId) : await User.findOne({ email });
  if (!user) user = await User.create({ firstName: String(profile?.firstName || profile?.givenName || "SSO"), lastName: String(profile?.lastName || profile?.surname || "User"), email, passwordHash: randomToken(), role: "STAFF", organizationId: provider.organizationId, isActive: true });
  if (user.organizationId?.toString() !== provider.organizationId.toString()) throw new Error("This account belongs to another organization");
  if (!identity) await ExternalIdentity.create({ organizationId: provider.organizationId, userId: user._id, providerId: provider._id, providerType: "SAML", subject, email });
  tx.usedAt = new Date(); await tx.save();
  const code = randomToken(); await SsoTransaction.create({ kind: "CODE", providerId: provider._id, organizationId: provider.organizationId, tokenHash: sha256(code), metadata: { userId: user._id.toString() }, expiresAt: new Date(Date.now() + 2 * 60 * 1000) });
  return code;
}
