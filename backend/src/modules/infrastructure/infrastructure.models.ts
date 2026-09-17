import mongoose, { Document, Schema, Types } from "mongoose";

export type SsoProviderType = "OIDC" | "SAML";
export type IntegrationType = "HRIS" | "LMS";
export type IntegrationStatus = "CONNECTED" | "DISCONNECTED" | "ERROR";
export type SupportStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export type ReportFormat = "PDF" | "XLSX";
export type ReportFrequency = "DAILY" | "WEEKLY" | "MONTHLY";

export interface IExternalIdentity extends Document {
  organizationId: Types.ObjectId;
  userId: Types.ObjectId;
  providerId: Types.ObjectId;
  providerType: SsoProviderType;
  subject: string;
  email?: string;
  createdAt: Date;
  updatedAt: Date;
}
const ExternalIdentitySchema = new Schema<IExternalIdentity>({
  organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  providerId: { type: Schema.Types.ObjectId, ref: "SsoProvider", required: true, index: true },
  providerType: { type: String, enum: ["OIDC", "SAML"], required: true },
  subject: { type: String, required: true, trim: true },
  email: { type: String, lowercase: true, trim: true }
}, { timestamps: true });
ExternalIdentitySchema.index({ providerId: 1, subject: 1 }, { unique: true });
export const ExternalIdentity = mongoose.model<IExternalIdentity>("ExternalIdentity", ExternalIdentitySchema);

export interface ISsoProvider extends Document {
  organizationId: Types.ObjectId;
  name: string;
  type: SsoProviderType;
  enabled: boolean;
  issuerUrl?: string;
  clientId?: string;
  clientSecret?: string;
  authorizationUrl?: string;
  tokenUrl?: string;
  userInfoUrl?: string;
  entryPoint?: string;
  idpCert?: string;
  entityId?: string;
  allowedDomains: string[];
  createdAt: Date;
  updatedAt: Date;
}
const SsoProviderSchema = new Schema<ISsoProvider>({
  organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: ["OIDC", "SAML"], required: true },
  enabled: { type: Boolean, default: false },
  issuerUrl: String,
  clientId: String,
  clientSecret: { type: String, select: false },
  authorizationUrl: String,
  tokenUrl: String,
  userInfoUrl: String,
  entryPoint: String,
  idpCert: String,
  entityId: String,
  allowedDomains: { type: [String], default: [] }
}, { timestamps: true });
export const SsoProvider = mongoose.model<ISsoProvider>("SsoProvider", SsoProviderSchema);

export interface ISsoTransaction extends Document {
  kind: "LOGIN" | "CODE";
  providerId: Types.ObjectId;
  organizationId: Types.ObjectId;
  tokenHash: string;
  state?: string;
  nonce?: string;
  metadata?: Record<string, unknown>;
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
}
const SsoTransactionSchema = new Schema<ISsoTransaction>({
  kind: { type: String, enum: ["LOGIN", "CODE"], required: true },
  providerId: { type: Schema.Types.ObjectId, ref: "SsoProvider", required: true, index: true },
  organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
  tokenHash: { type: String, required: true, index: true },
  state: String,
  nonce: String,
  metadata: Schema.Types.Mixed,
  expiresAt: { type: Date, required: true, index: true },
  usedAt: Date
}, { timestamps: { createdAt: true, updatedAt: false } });
SsoTransactionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const SsoTransaction = mongoose.model<ISsoTransaction>("SsoTransaction", SsoTransactionSchema);

export interface IMfaCredential extends Document {
  userId: Types.ObjectId;
  secret: string;
  enabled: boolean;
  backupCodeHashes: string[];
  lastUsedStep?: number;
  createdAt: Date;
  updatedAt: Date;
}
const MfaCredentialSchema = new Schema<IMfaCredential>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
  secret: { type: String, required: true },
  enabled: { type: Boolean, default: false },
  backupCodeHashes: { type: [String], default: [] },
  lastUsedStep: Number
}, { timestamps: true });
export const MfaCredential = mongoose.model<IMfaCredential>("MfaCredential", MfaCredentialSchema);

export interface IBillingAccount extends Document {
  organizationId: Types.ObjectId;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  status: "INCOMPLETE" | "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "UNCONFIGURED";
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}
const BillingAccountSchema = new Schema<IBillingAccount>({
  organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, unique: true, index: true },
  stripeCustomerId: String,
  stripeSubscriptionId: String,
  stripePriceId: String,
  status: { type: String, enum: ["INCOMPLETE", "TRIALING", "ACTIVE", "PAST_DUE", "CANCELED", "UNCONFIGURED"], default: "UNCONFIGURED" },
  currentPeriodEnd: Date,
  cancelAtPeriodEnd: { type: Boolean, default: false }
}, { timestamps: true });
export const BillingAccount = mongoose.model<IBillingAccount>("BillingAccount", BillingAccountSchema);

export interface IIntegration extends Document {
  organizationId: Types.ObjectId;
  type: IntegrationType;
  name: string;
  baseUrl: string;
  apiKey?: string;
  webhookSecret?: string;
  status: IntegrationStatus;
  lastSyncAt?: Date;
  lastError?: string;
  config?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
const IntegrationSchema = new Schema<IIntegration>({
  organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
  type: { type: String, enum: ["HRIS", "LMS"], required: true },
  name: { type: String, required: true, trim: true },
  baseUrl: { type: String, required: true, trim: true },
  apiKey: { type: String, select: false },
  webhookSecret: { type: String, select: false },
  status: { type: String, enum: ["CONNECTED", "DISCONNECTED", "ERROR"], default: "DISCONNECTED" },
  lastSyncAt: Date,
  lastError: String,
  config: Schema.Types.Mixed
}, { timestamps: true });
IntegrationSchema.index({ organizationId: 1, type: 1 }, { unique: true });
export const Integration = mongoose.model<IIntegration>("Integration", IntegrationSchema);

export interface ISupportTicket extends Document {
  organizationId: Types.ObjectId;
  createdBy: Types.ObjectId;
  subject: string;
  description: string;
  status: SupportStatus;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  assignedTo?: Types.ObjectId;
  resolution?: string;
  createdAt: Date;
  updatedAt: Date;
}
const SupportTicketSchema = new Schema<ISupportTicket>({
  organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  subject: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, required: true, trim: true, maxlength: 5000 },
  status: { type: String, enum: ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"], default: "OPEN", index: true },
  priority: { type: String, enum: ["LOW", "NORMAL", "HIGH", "URGENT"], default: "NORMAL" },
  assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
  resolution: { type: String, maxlength: 5000 }
}, { timestamps: true });
export const SupportTicket = mongoose.model<ISupportTicket>("SupportTicket", SupportTicketSchema);

export interface IImpersonationSession extends Document {
  supportUserId: Types.ObjectId;
  targetUserId: Types.ObjectId;
  targetOrganizationId: Types.ObjectId;
  reason: string;
  tokenHash: string;
  startedAt: Date;
  expiresAt: Date;
  endedAt?: Date;
}
const ImpersonationSessionSchema = new Schema<IImpersonationSession>({
  supportUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  targetUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  targetOrganizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
  reason: { type: String, required: true, maxlength: 1000 },
  tokenHash: { type: String, required: true, index: true },
  startedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  endedAt: Date
}, { timestamps: false });
export const ImpersonationSession = mongoose.model<IImpersonationSession>("ImpersonationSession", ImpersonationSessionSchema);

export interface IScheduledReport extends Document {
  organizationId: Types.ObjectId;
  createdBy: Types.ObjectId;
  name: string;
  format: ReportFormat;
  frequency: ReportFrequency;
  nextRunAt: Date;
  recipients: string[];
  active: boolean;
  lastRunAt?: Date;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}
const ScheduledReportSchema = new Schema<IScheduledReport>({
  organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true, trim: true, maxlength: 150 },
  format: { type: String, enum: ["PDF", "XLSX"], required: true },
  frequency: { type: String, enum: ["DAILY", "WEEKLY", "MONTHLY"], required: true },
  nextRunAt: { type: Date, required: true, index: true },
  recipients: { type: [String], required: true },
  active: { type: Boolean, default: true, index: true },
  lastRunAt: Date,
  lastError: String
}, { timestamps: true });
export const ScheduledReport = mongoose.model<IScheduledReport>("ScheduledReport", ScheduledReportSchema);
