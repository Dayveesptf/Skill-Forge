import { Request, Response } from "express";
import { AuthenticatedRequest } from "../../middleware/auth";
import { UserRole } from "../../constants/roles";
import * as svc from "./infrastructure.service";
import { buildOrganizationPdf, buildOrganizationXlsx } from "./report-export.service";
import { IntegrationType } from "./infrastructure.models";

function org(req: AuthenticatedRequest) { if (!req.user?.organizationId) throw new Error("Organization context is required"); return req.user.organizationId; }
function param(v: unknown, name: string) {
  if (typeof v === "string" && v) return v;
  if (Array.isArray(v) && v.every((item): item is string => typeof item === "string") && v.length) return v[0];
  throw new Error(`${name} is required`);
}

export async function mfaStatus(req: AuthenticatedRequest, res: Response) { res.json({ success: true, data: await svc.getMfaStatus(req.user!.userId) }); }
export async function mfaSetup(req: AuthenticatedRequest, res: Response) { res.json({ success: true, data: await svc.beginMfaSetup(req.user!.userId) }); }
export async function mfaEnable(req: AuthenticatedRequest, res: Response) { res.json({ success: true, data: await svc.enableMfa(req.user!.userId, String(req.body.code || "")) }); }
export async function mfaDisable(req: AuthenticatedRequest, res: Response) { res.json({ success: true, data: await svc.disableMfa(req.user!.userId) }); }
export async function mfaVerifyLogin(req: Request, res: Response) { const result = await svc.verifyMfaLogin(String(req.body.challenge || ""), String(req.body.code || "")); res.cookie("refreshToken", result.refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 7 * 86400000, path: "/api/auth" }); res.json({ success: true, data: { user: result.user, accessToken: result.accessToken } }); }

export async function ssoProvider(req: AuthenticatedRequest, res: Response) { res.json({ success: true, data: await svc.getSsoProvider(org(req)) }); }
export async function saveSsoProvider(req: AuthenticatedRequest, res: Response) { res.json({ success: true, data: await svc.saveSsoProvider(org(req), req.body) }); }
export async function startOidc(req: Request, res: Response) { const url = await svc.startOidcLogin(param(req.query.organizationId as string | string[] | undefined, "organizationId")); res.redirect(url); }
export async function oidcCallback(req: Request, res: Response) { const code = await svc.finishOidcLogin(param(req.query.state, "state"), param(req.query.code, "code")); res.redirect(`${process.env.CLIENT_URL || "http://localhost:5173"}/sso/callback?code=${encodeURIComponent(code)}`); }
export async function exchangeSso(req: Request, res: Response) { res.json({ success: true, data: await svc.exchangeSsoCode(String(req.body.code || "")) }); }

export async function configStatus(_req: AuthenticatedRequest, res: Response) {
  res.json({
    success: true,
    data: {
      stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
      stripeWebhookConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
      resendConfigured: Boolean(process.env.RESEND_API_KEY),
      encryptionConfigured: Boolean(process.env.APP_ENCRYPTION_KEY),
    },
  });
}

export async function billing(req: AuthenticatedRequest, res: Response) { res.json({ success: true, data: await svc.upsertBillingAccount(org(req)) }); }
export async function checkout(req: AuthenticatedRequest, res: Response) { const result = await svc.createStripeCheckout(org(req), String(req.body.priceId), String(req.body.successUrl), String(req.body.cancelUrl)); res.json({ success: true, data: { url: result.url, id: result.id } }); }
export async function portal(req: AuthenticatedRequest, res: Response) { const result = await svc.createStripePortal(org(req), String(req.body.returnUrl)); res.json({ success: true, data: result }); }
export async function stripeWebhook(req: Request, res: Response) { const raw = (req as Request & { rawBody?: string }).rawBody || JSON.stringify(req.body); const event = svc.verifyStripeWebhook(raw, String(req.headers["stripe-signature"] || "")); await svc.syncBillingFromStripeEvent(event); res.json({ received: true }); }

export async function integrations(req: AuthenticatedRequest, res: Response) { res.json({ success: true, data: await svc.listIntegrations(org(req)) }); }
export async function saveIntegration(req: AuthenticatedRequest, res: Response) { res.json({ success: true, data: await svc.saveIntegration(org(req), req.body) }); }
export async function testIntegration(req: AuthenticatedRequest, res: Response) { res.json({ success: true, data: await svc.testIntegration(org(req), param(req.params.type, "type") as IntegrationType) }); }
export async function syncIntegration(req: AuthenticatedRequest, res: Response) { res.json({ success: true, data: await svc.syncIntegration(org(req), param(req.params.type, "type") as IntegrationType) }); }

export async function createTicket(req: AuthenticatedRequest, res: Response) { res.status(201).json({ success: true, data: await svc.createSupportTicket(org(req), req.user!.userId, req.body) }); }
export async function listTickets(req: AuthenticatedRequest, res: Response) { const isPlatform = req.user!.role === UserRole.PLATFORM_ADMIN; res.json({ success: true, data: await svc.listSupportTickets(isPlatform ? undefined : org(req)) }); }
export async function updateTicket(req: AuthenticatedRequest, res: Response) { res.json({ success: true, data: await svc.updateSupportTicket(param(req.params.id, "ticket id"), req.body) }); }
export async function startImpersonation(req: AuthenticatedRequest, res: Response) { const result = await svc.startImpersonation(req.user!.userId, String(req.body.targetUserId), String(req.body.reason || "Support investigation"), req); res.json({ success: true, data: result }); }
export async function endImpersonation(req: AuthenticatedRequest, res: Response) { res.json({ success: true, data: await svc.endImpersonation(param(req.params.id, "session id"), req) }); }

export async function exportReport(req: AuthenticatedRequest, res: Response) { const format = String(req.params.format || "PDF").toUpperCase(); if (format === "PDF") { const file = await buildOrganizationPdf(org(req)); res.type("application/pdf").setHeader("Content-Disposition", "attachment; filename=skillforge-report.pdf").send(file); return; } if (format === "XLSX") { const file = await buildOrganizationXlsx(org(req)); res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").setHeader("Content-Disposition", "attachment; filename=skillforge-report.xlsx").send(file); return; } res.status(400).json({ success:false, message:"Format must be PDF or XLSX" }); }

export async function scheduledReports(req: AuthenticatedRequest, res: Response) { res.json({ success: true, data: await svc.listScheduledReports(org(req)) }); }
export async function createScheduled(req: AuthenticatedRequest, res: Response) { res.status(201).json({ success: true, data: await svc.createScheduledReport({ ...req.body, organizationId: org(req), createdBy: req.user!.userId }) }); }
export async function deleteScheduled(req: AuthenticatedRequest, res: Response) { await svc.deleteScheduledReport(org(req), param(req.params.id, "scheduled report id")); res.json({ success: true }); }
