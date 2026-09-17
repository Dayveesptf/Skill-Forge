import crypto from "crypto";
import { env } from "../config/env";

function key() { return crypto.createHash("sha256").update(env.encryptionKey || env.jwtAccessSecret).digest(); }
export function encryptSecret(value?: string) { if (!value) return value; if (value.startsWith("enc:")) return value; const iv=crypto.randomBytes(12); const cipher=crypto.createCipheriv("aes-256-gcm",key(),iv); const encrypted=Buffer.concat([cipher.update(value,"utf8"),cipher.final()]); const tag=cipher.getAuthTag(); return `enc:${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`; }
export function decryptSecret(value?: string) { if (!value) return value; if (!value.startsWith("enc:")) return value; const [ivB64,tagB64,dataB64]=value.slice(4).split("."); const decipher=crypto.createDecipheriv("aes-256-gcm",key(),Buffer.from(ivB64,"base64url")); decipher.setAuthTag(Buffer.from(tagB64,"base64url")); return Buffer.concat([decipher.update(Buffer.from(dataB64,"base64url")),decipher.final()]).toString("utf8"); }
