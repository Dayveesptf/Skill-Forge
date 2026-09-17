import dotenv from "dotenv";

dotenv.config();

const required = ["MONGODB_URI", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 5000),
  mongodbUri: process.env.MONGODB_URI as string,
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET as string,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET as string,
  accessTokenExpiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "15m",
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d",
  invitationExpiresDays: Number(process.env.INVITATION_EXPIRES_DAYS || 7),
  // Optional — caching is skipped entirely when unset, so the app runs
  // fine without Redis. Set to enable caching (e.g. redis://localhost:6379).
  redisUrl: process.env.REDIS_URL,
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  resendApiKey: process.env.RESEND_API_KEY,
  reportFromEmail: process.env.REPORT_FROM_EMAIL || "reports@skillforge.local",
  encryptionKey: process.env.APP_ENCRYPTION_KEY
};