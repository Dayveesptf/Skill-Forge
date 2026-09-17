import bcrypt from "bcryptjs";
import { User } from "../../models/User";
import { Organization } from "../../models/Organization";
import { UserRole } from "../../constants/roles";

export interface ImportUserRow {
  firstName: string;
  lastName: string;
  email: string;
  role?: UserRole;
  jobTitle?: string;
  department?: string;
  managerEmail?: string;
  temporaryPassword?: string;
}

export async function bulkImportUsers(
  organizationId: string,
  rows: ImportUserRow[]
) {
  const org = await Organization.findById(organizationId);
  if (!org) throw new Error("Organization not found");

  const activeCount = await User.countDocuments({
    organizationId,
    isActive: true,
    role: { $in: [UserRole.ORGANIZATION_ADMIN, UserRole.MANAGER, UserRole.STAFF] }
  });

  if (activeCount + rows.length > org.subscription.seatLimit) {
    throw new Error("Import would exceed the organization's seat limit");
  }

  const emails = rows.map(r => r.email.toLowerCase().trim());
  const existing = await User.find({ email: { $in: emails } }).select("email");
  const existingEmails = new Set(existing.map(u => u.email));

  const managerEmails = [...new Set(
    rows.filter(r => r.managerEmail).map(r => r.managerEmail!.toLowerCase().trim())
  )];

  const managers = await User.find({
    organizationId,
    email: { $in: managerEmails },
    role: UserRole.MANAGER,
    isActive: true
  }).select("email _id");

  const managerMap = new Map(managers.map(m => [m.email, m._id]));

  const results: Array<{ row: number; email: string; status: "created" | "skipped" | "failed"; reason?: string }> = [];
  const docs: any[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const email = row.email.toLowerCase().trim();

    if (existingEmails.has(email)) {
      results.push({ row: i + 1, email, status: "skipped", reason: "Email already exists" });
      continue;
    }

    const role = row.role || UserRole.STAFF;
    if (![UserRole.ORGANIZATION_ADMIN, UserRole.MANAGER, UserRole.STAFF].includes(role)) {
      results.push({ row: i + 1, email, status: "failed", reason: "Invalid role" });
      continue;
    }

    if (row.managerEmail && !managerMap.has(row.managerEmail.toLowerCase().trim())) {
      results.push({ row: i + 1, email, status: "failed", reason: "Manager not found in organization" });
      continue;
    }

    const password = row.temporaryPassword || `Temp-${Math.random().toString(36).slice(2, 10)}!`;
    const passwordHash = await bcrypt.hash(password, 12);

    docs.push({
      firstName: row.firstName,
      lastName: row.lastName,
      email,
      passwordHash,
      role,
      organizationId,
      managerId: row.managerEmail
        ? managerMap.get(row.managerEmail.toLowerCase().trim())
        : undefined,
      jobTitle: row.jobTitle,
      department: row.department
    });

    results.push({ row: i + 1, email, status: "created" });
  }

  if (docs.length) {
    await User.insertMany(docs);
  }

  return {
    created: results.filter(r => r.status === "created").length,
    skipped: results.filter(r => r.status === "skipped").length,
    failed: results.filter(r => r.status === "failed").length,
    results
  };
}
