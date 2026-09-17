import { Router } from "express";
import { authenticate, authorize } from "../../middleware/auth";
import { UserRole } from "../../constants/roles";
import * as c from "./infrastructure.controller";

const router = Router();
router.post("/billing/webhook", c.stripeWebhook);
router.post("/mfa/verify-login", c.mfaVerifyLogin);
router.use(authenticate);

router.get("/mfa/status", c.mfaStatus);
router.post("/mfa/setup", c.mfaSetup);
router.post("/mfa/enable", c.mfaEnable);
router.post("/mfa/disable", c.mfaDisable);

router.get("/sso/provider", authorize(UserRole.ORGANIZATION_ADMIN), c.ssoProvider);
router.put("/sso/provider", authorize(UserRole.ORGANIZATION_ADMIN), c.saveSsoProvider);

router.get("/config-status", authorize(UserRole.ORGANIZATION_ADMIN), c.configStatus);
router.get("/billing", authorize(UserRole.ORGANIZATION_ADMIN), c.billing);
router.post("/billing/checkout", authorize(UserRole.ORGANIZATION_ADMIN), c.checkout);
router.post("/billing/portal", authorize(UserRole.ORGANIZATION_ADMIN), c.portal);

router.get("/integrations", authorize(UserRole.ORGANIZATION_ADMIN), c.integrations);
router.put("/integrations", authorize(UserRole.ORGANIZATION_ADMIN), c.saveIntegration);
router.post("/integrations/:type/test", authorize(UserRole.ORGANIZATION_ADMIN), c.testIntegration);
router.post("/integrations/:type/sync", authorize(UserRole.ORGANIZATION_ADMIN), c.syncIntegration);

router.post("/support/tickets", c.createTicket);
router.get("/support/tickets", c.listTickets);
router.patch("/support/tickets/:id", authorize(UserRole.PLATFORM_ADMIN), c.updateTicket);
router.post("/support/impersonate", authorize(UserRole.PLATFORM_ADMIN), c.startImpersonation);
router.post("/support/impersonate/:id/end", authorize(UserRole.PLATFORM_ADMIN), c.endImpersonation);

router.get("/reports/export/:format", authorize(UserRole.ORGANIZATION_ADMIN), c.exportReport);

router.get("/scheduled-reports", authorize(UserRole.ORGANIZATION_ADMIN), c.scheduledReports);
router.post("/scheduled-reports", authorize(UserRole.ORGANIZATION_ADMIN), c.createScheduled);
router.delete("/scheduled-reports/:id", authorize(UserRole.ORGANIZATION_ADMIN), c.deleteScheduled);

export default router;
