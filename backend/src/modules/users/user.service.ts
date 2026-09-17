import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import { User } from "../../models/User";
import { Organization } from "../../models/Organization";
import { UserRole } from "../../constants/roles";
import { sanitizeUser } from "../auth/auth.service";

const orgRoles = [
  UserRole.ORGANIZATION_ADMIN,
  UserRole.MANAGER,
  UserRole.STAFF
];

function assertObjectId(value: string, label: string) {
  if (!mongoose.isValidObjectId(value)) {
    throw new Error(`Invalid ${label}`);
  }
}

async function assertSeatAvailable(organizationId: string) {
  const org = await Organization.findById(organizationId);

  if (!org) {
    throw new Error("Organization not found");
  }

  const used = await User.countDocuments({
    organizationId,
    isActive: true,
    role: { $in: orgRoles }
  });

  if (used >= org.subscription.seatLimit) {
    throw new Error("Organization seat limit has been reached");
  }

  if (
    !org.isActive ||
    org.subscription.status === "SUSPENDED"
  ) {
    throw new Error("Organization is not active");
  }

  return org;
}

/* -------------------------------------------------------------------------- */
/* Create Organization User                                                   */
/* -------------------------------------------------------------------------- */

export async function createOrganizationUser(
  organizationId: string,
  data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    role: UserRole;
    managerId?: string;
    jobTitle?: string;
    department?: string;
  }
) {
  assertObjectId(
    organizationId,
    "organization id"
  );

  if (!orgRoles.includes(data.role)) {
    throw new Error(
      "Invalid organization user role"
    );
  }

  await assertSeatAvailable(
    organizationId
  );

  const email =
    data.email
      .toLowerCase()
      .trim();

  if (await User.exists({ email })) {
    throw new Error(
      "A user with this email already exists"
    );
  }

  if (data.managerId) {
    assertObjectId(
      data.managerId,
      "manager id"
    );

    const manager =
      await User.findOne({
        _id: data.managerId,
        organizationId,
        role: UserRole.MANAGER,
        isActive: true
      });

    if (!manager) {
      throw new Error(
        "Selected manager does not belong to this organization"
      );
    }
  }

  const passwordHash =
    await bcrypt.hash(
      data.password,
      12
    );

  const user =
    await User.create({
      ...data,
      email,
      passwordHash,
      organizationId
    });

  return sanitizeUser(user);
}

/* -------------------------------------------------------------------------- */
/* List Organization Users                                                    */
/* -------------------------------------------------------------------------- */

export async function listOrganizationUsers(
  organizationId: string,
  query: {
    role?: UserRole;
    managerId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }
) {
  const page =
    Math.max(
      query.page || 1,
      1
    );

  const limit =
    Math.min(
      Math.max(
        query.limit || 25,
        1
      ),
      100
    );

  const filter: any = {
    organizationId
  };

  if (query.role) {
    filter.role =
      query.role;
  }

  if (query.managerId) {
    filter.managerId =
      query.managerId;
  }

  if (query.search?.trim()) {
    const escaped =
      query.search
        .trim()
        .replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        );

    filter.$or = [
      {
        firstName: {
          $regex: escaped,
          $options: "i"
        }
      },
      {
        lastName: {
          $regex: escaped,
          $options: "i"
        }
      },
      {
        email: {
          $regex: escaped,
          $options: "i"
        }
      },
      {
        jobTitle: {
          $regex: escaped,
          $options: "i"
        }
      },
      {
        department: {
          $regex: escaped,
          $options: "i"
        }
      }
    ];
  }

  const [items, total] =
    await Promise.all([
      User.find(filter)
        .select(
          "-passwordHash -refreshTokenHash -refreshTokenExpiresAt"
        )
        .populate(
          "managerId",
          "firstName lastName email"
        )
        .sort({
          createdAt: -1
        })
        .skip(
          (page - 1) * limit
        )
        .limit(limit),

      User.countDocuments(
        filter
      )
    ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(
        total / limit
      )
    }
  };
}

/* -------------------------------------------------------------------------- */
/* List Manager Team                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Returns the active staff members directly assigned to a manager.
 *
 * IMPORTANT:
 * managerId comes from the authenticated request in the controller.
 * The frontend cannot choose another manager's ID.
 */
export async function listManagerTeam(
  managerId: string,
  organizationId: string
) {
  assertObjectId(
    managerId,
    "manager id"
  );

  assertObjectId(
    organizationId,
    "organization id"
  );

  const manager =
    await User.findOne({
      _id: managerId,
      organizationId,
      role: UserRole.MANAGER,
      isActive: true
    })
      .select("_id")
      .lean();

  if (!manager) {
    throw new Error(
      "Manager account not found or inactive"
    );
  }

  return User.find({
    organizationId,
    managerId,
    role: UserRole.STAFF,
    isActive: true
  })
    .select(
      "_id firstName lastName email jobTitle department managerId isActive createdAt"
    )
    .sort({
      firstName: 1,
      lastName: 1
    })
    .lean();
}

/* -------------------------------------------------------------------------- */
/* Get One User                                                               */
/* -------------------------------------------------------------------------- */

export async function getOrganizationUser(
  organizationId: string,
  userId: string
) {
  assertObjectId(
    userId,
    "user id"
  );

  return User.findOne({
    _id: userId,
    organizationId
  })
    .select(
      "-passwordHash -refreshTokenHash -refreshTokenExpiresAt"
    )
    .populate(
      "managerId",
      "firstName lastName email"
    );
}

/* -------------------------------------------------------------------------- */
/* Update User                                                                */
/* -------------------------------------------------------------------------- */

export async function updateOrganizationUser(
  organizationId: string,
  userId: string,
  data: Partial<{
    firstName: string;
    lastName: string;
    role: UserRole;
    managerId?: string | null;
    jobTitle?: string;
    department?: string;
    isActive: boolean;
  }>
) {
  assertObjectId(
    userId,
    "user id"
  );

  const user =
    await User.findOne({
      _id: userId,
      organizationId
    });

  if (!user) {
    return null;
  }

  if (
    data.role &&
    !orgRoles.includes(data.role)
  ) {
    throw new Error(
      "Invalid organization user role"
    );
  }

  if (
    data.managerId !== undefined &&
    data.managerId !== null
  ) {
    assertObjectId(
      data.managerId,
      "manager id"
    );

    if (
      data.managerId === userId
    ) {
      throw new Error(
        "A user cannot be their own manager"
      );
    }

    const manager =
      await User.findOne({
        _id: data.managerId,
        organizationId,
        role: UserRole.MANAGER,
        isActive: true
      });

    if (!manager) {
      throw new Error(
        "Selected manager does not belong to this organization"
      );
    }
  }

  Object.assign(
    user,
    data
  );

  if (
    data.managerId === null
  ) {
    user.managerId =
      undefined;
  }

  await user.save();

  return getOrganizationUser(
    organizationId,
    userId
  );
}

/* -------------------------------------------------------------------------- */
/* Deactivate User                                                            */
/* -------------------------------------------------------------------------- */

export async function deactivateOrganizationUser(
  organizationId: string,
  userId: string
) {
  assertObjectId(
    userId,
    "user id"
  );

  const user =
    await User.findOne({
      _id: userId,
      organizationId
    });

  if (!user) {
    return null;
  }

  user.isActive =
    false;

  user.refreshTokenHash =
    undefined;

  user.refreshTokenExpiresAt =
    undefined;

  await user.save();

  return sanitizeUser(
    user
  );
}