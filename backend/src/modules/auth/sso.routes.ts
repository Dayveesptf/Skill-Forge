import { Router } from "express";
import { oidcStart, oidcCallback, samlStart, samlCallback, exchange } from "./sso.controller";
const router = Router();
router.get("/oidc/start", oidcStart);
router.get("/oidc/callback", oidcCallback);
router.get("/saml/start", samlStart);
router.post("/saml/callback", samlCallback);
router.post("/exchange", exchange);
export default router;
