/**
 * Seed script — bootstraps the minimum accounts needed to start testing
 * the platform locally, without hand-editing MongoDB.
 *
 * Creates (idempotently — safe to re-run):
 *   1. One Organization ("Demo Organization")
 *   2. One PLATFORM_ADMIN user (not tied to any organization)
 *   3. One ORGANIZATION_ADMIN user (tied to the Demo Organization)
 *
 * Usage:
 *   npm run seed
 *
 * Override the generated credentials with env vars if you want:
 *   SEED_PLATFORM_ADMIN_EMAIL, SEED_PLATFORM_ADMIN_PASSWORD
 *   SEED_ORG_ADMIN_EMAIL, SEED_ORG_ADMIN_PASSWORD
 *   SEED_ORG_NAME, SEED_ORG_SLUG
 */

import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import { env } from "../config/env";
import { Organization } from "../models/Organization";
import { User } from "../models/User";
import { UserRole } from "../constants/roles";

const ORG_NAME = process.env.SEED_ORG_NAME || "Demo Organization";
const ORG_SLUG = process.env.SEED_ORG_SLUG || "demo-org";

const PLATFORM_ADMIN_EMAIL =
  process.env.SEED_PLATFORM_ADMIN_EMAIL || "platform-admin@skillforge.test";
const PLATFORM_ADMIN_PASSWORD =
  process.env.SEED_PLATFORM_ADMIN_PASSWORD || "PlatformAdmin!123";

const ORG_ADMIN_EMAIL =
  process.env.SEED_ORG_ADMIN_EMAIL || "org-admin@skillforge.test";
const ORG_ADMIN_PASSWORD =
  process.env.SEED_ORG_ADMIN_PASSWORD || "OrgAdmin!123";

const BCRYPT_ROUNDS = 12;

async function upsertOrganization() {
  const existing = await Organization.findOne({ slug: ORG_SLUG });

  if (existing) {
    console.log(`↷ Organization "${ORG_SLUG}" already exists — reusing it.`);
    return existing;
  }

  const org = await Organization.create({
    name: ORG_NAME,
    slug: ORG_SLUG,
    industry: "Technology",
    subscription: {
      plan: "STANDARD",
      seatLimit: 50,
      status: "ACTIVE"
    },
    isActive: true
  });

  console.log(`✓ Created organization "${org.name}" (${org._id})`);
  return org;
}

async function upsertUser(params: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: UserRole;
  organizationId?: mongoose.Types.ObjectId;
}) {
  const existing = await User.findOne({ email: params.email });

  if (existing) {
    console.log(`↷ User "${params.email}" already exists — leaving it as-is.`);
    return existing;
  }

  const passwordHash = await bcrypt.hash(params.password, BCRYPT_ROUNDS);

  const user = await User.create({
    firstName: params.firstName,
    lastName: params.lastName,
    email: params.email,
    passwordHash,
    role: params.role,
    organizationId: params.organizationId,
    isActive: true
  });

  console.log(`✓ Created ${params.role} "${user.email}" (${user._id})`);
  return user;
}

async function main() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(env.mongodbUri);

  const org = await upsertOrganization();

  await upsertUser({
    firstName: "Platform",
    lastName: "Admin",
    email: PLATFORM_ADMIN_EMAIL,
    password: PLATFORM_ADMIN_PASSWORD,
    role: UserRole.PLATFORM_ADMIN
    // Platform admins are intentionally not tied to an organization.
  });

  await upsertUser({
    firstName: "Org",
    lastName: "Admin",
    email: ORG_ADMIN_EMAIL,
    password: ORG_ADMIN_PASSWORD,
    role: UserRole.ORGANIZATION_ADMIN,
    organizationId: org._id as mongoose.Types.ObjectId
  });

  console.log("\nDone. Log in with:\n");
  console.log("  PLATFORM_ADMIN");
  console.log(`    email:    ${PLATFORM_ADMIN_EMAIL}`);
  console.log(`    password: ${PLATFORM_ADMIN_PASSWORD}`);
  console.log("\n  ORGANIZATION_ADMIN");
  console.log(`    email:    ${ORG_ADMIN_EMAIL}`);
  console.log(`    password: ${ORG_ADMIN_PASSWORD}`);
  console.log(`    org:      ${ORG_NAME} (${org._id})\n`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});