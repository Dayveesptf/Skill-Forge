import mongoose from "mongoose";
import { Invitation } from "../../models/Invitation";
import { Organization } from "../../models/Organization";
import { User } from "../../models/User";
import { UserRole } from "../../constants/roles";
import { env } from "../../config/env";
import { randomToken, sha256 } from "../../utils/security";
import bcrypt from "bcryptjs";

export async function createInvitation(
  organizationId: string,
  invitedBy: string,
  data: {
    email: string;
    firstName?: string;
    lastName?: string;
    role: UserRole;
    managerId?: string;
  }
) {
  if (!mongoose.isValidObjectId(organizationId)) throw new Error("Invalid organization id");
  if (!mongoose.isValidObjectId(invitedBy)) throw new Error("Invalid inviter id");

  const org = await Organization.findById(organizationId);
  if (!org || !org.isActive || org.subscription.status === "SUSPENDED") {
    throw new Error("Organization is not active");
  }

  const email = data.email.toLowerCase().trim();

  if (await User.exists({ email })) {
    throw new Error("A user with this email already exists");
  }

  const existing = await Invitation.findOne({
    organizationId,
    email,
    status: "PENDING",
    expiresAt: { $gt: new Date() }
  });

  if (existing) throw new Error("A pending invitation already exists for this email");

  const activeUsers = await User.countDocuments({
    organizationId,
    isActive: true,
    role: { $in: [UserRole.ORGANIZATION_ADMIN, UserRole.MANAGER, UserRole.STAFF] }
  });

  const pendingInvites = await Invitation.countDocuments({
    organizationId,
    status: "PENDING",
    expiresAt: { $gt: new Date() }
  });

  if (activeUsers + pendingInvites >= org.subscription.seatLimit) {
    throw new Error("This invitation would exceed the organization's seat limit");
  }

  if (data.managerId) {
    if (!mongoose.isValidObjectId(data.managerId)) throw new Error("Invalid manager id");
    const manager = await User.findOne({
      _id: data.managerId,
      organizationId,
      role: UserRole.MANAGER,
      isActive: true
    });
    if (!manager) throw new Error("Selected manager does not belong to this organization");
  }

  const token = randomToken();
  const invitation = await Invitation.create({
    organizationId,
    invitedBy,
    email,
    firstName: data.firstName,
    lastName: data.lastName,
    role: data.role,
    managerId: data.managerId,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + env.invitationExpiresDays * 24 * 60 * 60 * 1000)
  });

  return {
    invitation,
    rawToken: token
  };
}

export async function listInvitations(organizationId: string) {
  return Invitation.find({ organizationId })
    .select("-tokenHash")
    .populate("invitedBy", "firstName lastName email")
    .populate("managerId", "firstName lastName email")
    .sort({ createdAt: -1 });
}

export async function revokeInvitation(organizationId: string, id: string) {
  if (!mongoose.isValidObjectId(id)) throw new Error("Invalid invitation id");

  return Invitation.findOneAndUpdate(
    { _id: id, organizationId, status: "PENDING" },
    { status: "REVOKED" },
    { new: true }
  ).select("-tokenHash");
}

export async function acceptInvitation(token: string, password: string) {
  const invitation = await Invitation.findOne({
    tokenHash: sha256(token),
    status: "PENDING",
    expiresAt: { $gt: new Date() }
  }).select("+tokenHash");

  if (!invitation) throw new Error("Invitation is invalid or has expired");

  if (await User.exists({ email: invitation.email })) {
    throw new Error("A user with this email already exists");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await User.create({
    firstName: invitation.firstName || "",
    lastName: invitation.lastName || "",
    email: invitation.email,
    passwordHash,
    role: invitation.role,
    organizationId: invitation.organizationId,
    managerId: invitation.managerId
  });

  invitation.status = "ACCEPTED";
  invitation.acceptedAt = new Date();
  await invitation.save();

  return user;
}
