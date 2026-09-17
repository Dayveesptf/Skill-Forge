import { Request, Response } from "express";
import { finishOidcLogin, startOidcLogin, exchangeSsoCode } from "../infrastructure/infrastructure.service";
import { finishSamlLogin, startSamlLogin } from "./sso.service";

function value(v: unknown, name: string) { if (typeof v !== "string" || !v) throw new Error(`${name} is required`); return v; }

export async function oidcStart(req: Request, res: Response) { const url = await startOidcLogin(value(req.query.organizationId || req.query.organizationSlug, "organizationId or organizationSlug")); res.redirect(url); }
export async function oidcCallback(req: Request, res: Response) { const code = await finishOidcLogin(value(req.query.state, "state"), value(req.query.code, "code")); res.redirect(`${process.env.CLIENT_URL || "http://localhost:5173"}/sso/callback?code=${encodeURIComponent(code)}`); }
export async function samlStart(req: Request, res: Response) { const url = await startSamlLogin(value(req.query.organizationId || req.query.organizationSlug, "organizationId or organizationSlug")); res.redirect(url); }
export async function samlCallback(req: Request, res: Response) { const code = await finishSamlLogin(value(req.body.RelayState, "RelayState"), req.body); res.redirect(`${process.env.CLIENT_URL || "http://localhost:5173"}/sso/callback?code=${encodeURIComponent(code)}`); }
export async function exchange(req: Request, res: Response) { const result = await exchangeSsoCode(value(req.body.code, "code")); res.cookie("refreshToken", result.refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 7 * 86400000, path: "/api/auth" }); res.json({ success: true, data: { user: result.user, accessToken: result.accessToken } }); }
