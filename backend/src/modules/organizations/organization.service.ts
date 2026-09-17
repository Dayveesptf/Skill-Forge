import mongoose, { Types } from "mongoose";
import { Organization } from "../../models/Organization";
import { User } from "../../models/User";
import { UserRole } from "../../constants/roles";
import { Skill } from "../../models/Skill";
import { BehaviouralFactor } from "../../models/BehaviouralFactor";
import { FrameworkVersion } from "../../models/FrameworkVersion";
import { slugify } from "../../utils/slug";

export async function createOrganization(data: {
  name: string;
  industry?: string;
  plan?: string;
  seatLimit?: number;
}) {
  const baseSlug = slugify(data.name);
  let slug = baseSlug;
  let suffix = 1;

  while (await Organization.exists({ slug })) {
    slug = `${baseSlug}-${suffix++}`;
  }

  return Organization.create({
    name: data.name,
    slug,
    industry: data.industry,
    subscription: {
      plan: data.plan || "STANDARD",
      seatLimit: data.seatLimit || 50,
      status: "TRIAL",
      startsAt: new Date()
    }
  });
}

export async function getOrganizationById(id: string) {
  if (!mongoose.isValidObjectId(id)) throw new Error("Invalid organization id");
  return Organization.findById(id);
}

export async function updateOrganization(
  organizationId: string,
  data: Partial<{
    name: string;
    industry: string;
    plan: string;
    seatLimit: number;
    status: "TRIAL" | "ACTIVE" | "SUSPENDED";
    frameworkVersionId: string | null;
    departments: string[];
    teams: Array<{ name: string; department?: string }>;
    skillLibrary: {
      mode: "FULL" | "CURATED";
      skills: Array<{ skillId: string; enabled: boolean; weight: number }>;
      behaviouralFactors: Array<{ behaviouralFactorId: string; enabled: boolean; weight: number }>;
    };
  }>
) {
  if (!mongoose.isValidObjectId(organizationId)) throw new Error("Invalid organization id");

  const update: Record<string, unknown> = {};
  if (data.name !== undefined) update.name = data.name.trim();
  if (data.industry !== undefined) update.industry = data.industry.trim();
  if (data.plan !== undefined) update["subscription.plan"] = data.plan;
  if (data.seatLimit !== undefined) update["subscription.seatLimit"] = data.seatLimit;
  if (data.status !== undefined) update["subscription.status"] = data.status;

  const current = await Organization.findById(organizationId).select("frameworkVersionId");
  if (!current) return null;

  let frameworkId = current.frameworkVersionId?.toString();

  if (data.frameworkVersionId !== undefined) {
    if (data.frameworkVersionId === null) {
      update.frameworkVersionId = undefined;
      frameworkId = undefined;
    } else {
      if (!Types.ObjectId.isValid(data.frameworkVersionId)) throw new Error("Invalid frameworkVersionId");
      const framework = await FrameworkVersion.findOne({
        _id: data.frameworkVersionId,
        $or: [{ organizationId }, { organizationId: { $exists: false } }]
      }).select("_id");
      if (!framework) throw new Error("Framework version not found");
      update.frameworkVersionId = framework._id;
      frameworkId = framework._id.toString();
    }
  }

  if (data.departments !== undefined) {
    update.departments = [...new Set(data.departments.map((value) => value.trim()).filter(Boolean))];
  }

  if (data.teams !== undefined) {
    update.teams = data.teams
      .map((team) => ({ name: team.name.trim(), department: team.department?.trim() || undefined }))
      .filter((team) => team.name);
  }

  if (data.skillLibrary !== undefined) {
    if (!frameworkId) throw new Error("Adopt a framework version before configuring the skill library");

    const [skills, factors] = await Promise.all([
      Skill.find({ frameworkVersionId: frameworkId, isActive: true }).select("_id"),
      BehaviouralFactor.find({ frameworkVersionId: frameworkId, isActive: true }).select("_id")
    ]);

    const validSkills = new Set(skills.map((item) => item._id.toString()));
    const validFactors = new Set(factors.map((item) => item._id.toString()));

    update.skillLibrary = {
      mode: data.skillLibrary.mode,
      skills: data.skillLibrary.skills
        .filter((item) => validSkills.has(item.skillId))
        .map((item) => ({ skillId: new Types.ObjectId(item.skillId), enabled: Boolean(item.enabled), weight: Math.max(0, Math.min(100, Number(item.weight) || 0)) })),
      behaviouralFactors: data.skillLibrary.behaviouralFactors
        .filter((item) => validFactors.has(item.behaviouralFactorId))
        .map((item) => ({ behaviouralFactorId: new Types.ObjectId(item.behaviouralFactorId), enabled: Boolean(item.enabled), weight: Math.max(0, Math.min(100, Number(item.weight) || 0)) }))
    };
  }

  return Organization.findByIdAndUpdate(organizationId, update, { new: true, runValidators: true });
}

export async function listOrganizations() {
  const organizations = await Organization.find().sort({ createdAt: -1 }).lean();

  const counts = await User.aggregate([
    { $match: { organizationId: { $in: organizations.map((org) => org._id) } } },
    { $group: { _id: "$organizationId", totalUsers: { $sum: 1 } } }
  ]);

  const countsByOrg = new Map(
    counts.map((entry) => [entry._id.toString(), entry.totalUsers])
  );

  return organizations.map((org) => ({
    ...org,
    totalUsers: countsByOrg.get(org._id.toString()) || 0
  }));
}

export async function getOrganizationStats(organizationId: string) {
  const [totalUsers, admins, managers, staff] = await Promise.all([
    User.countDocuments({ organizationId }),
    User.countDocuments({ organizationId, role: UserRole.ORGANIZATION_ADMIN }),
    User.countDocuments({ organizationId, role: UserRole.MANAGER }),
    User.countDocuments({ organizationId, role: UserRole.STAFF })
  ]);

  return { totalUsers, admins, managers, staff };
}