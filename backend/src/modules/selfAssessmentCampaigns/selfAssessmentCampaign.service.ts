import { Types } from "mongoose";

import { User } from "../../models/User";
import { UserRole } from "../../constants/roles";

import {
  RoleProfile,
  RoleProfileStatus
} from "../../models/RoleProfile";

import {
  SelfAssessment,
  SelfAssessmentStatus
} from "../../models/SelfAssessment";

import {
  SelfAssessmentCampaign,
  SelfAssessmentCampaignScope,
  SelfAssessmentCampaignStatus
} from "../../models/SelfAssessmentCampaign";

import {
  createNotifications
} from "../notifications/notification.service";

import {
  NotificationPriority,
  NotificationType
} from "../../models/Notification";

function objectId(
  value: string,
  name: string
): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new Error(
      `${name} is invalid`
    );
  }

  return new Types.ObjectId(value);
}

async function getPublishedRoleProfile(
  roleProfileId: string,
  organizationId: string
) {
  const profile =
    await RoleProfile.findOne({
      _id: objectId(
        roleProfileId,
        "roleProfileId"
      ),

      organizationId: objectId(
        organizationId,
        "organizationId"
      )
    });

  if (!profile) {
    throw new Error(
      "Role profile not found"
    );
  }

  if (
    profile.status !==
    RoleProfileStatus.PUBLISHED
  ) {
    throw new Error(
      "Campaigns can only use published role profiles"
    );
  }

  return profile;
}

async function resolveCandidates(
  params: {
    organizationId: string;
    scope: SelfAssessmentCampaignScope;
    candidateIds?: string[];
    teamManagerId?: string;
  }
) {
  const organizationId =
    objectId(
      params.organizationId,
      "organizationId"
    );

  if (
    params.scope ===
    SelfAssessmentCampaignScope.ORGANIZATION
  ) {
    return User.find({
      organizationId,
      role: UserRole.STAFF,
      isActive: true
    })
      .select(
        "_id firstName lastName email jobTitle department"
      )
      .sort({
        lastName: 1,
        firstName: 1
      });
  }

  if (
    params.scope ===
    SelfAssessmentCampaignScope.TEAM
  ) {
    if (!params.teamManagerId) {
      throw new Error(
        "teamManagerId is required for a team campaign"
      );
    }

    const manager =
      await User.findOne({
        _id: objectId(
          params.teamManagerId,
          "teamManagerId"
        ),

        organizationId,

        role: UserRole.MANAGER,

        isActive: true
      });

    if (!manager) {
      throw new Error(
        "Team manager not found"
      );
    }

    return User.find({
      organizationId,

      managerId: manager._id,

      role: UserRole.STAFF,

      isActive: true
    })
      .select(
        "_id firstName lastName email jobTitle department"
      )
      .sort({
        lastName: 1,
        firstName: 1
      });
  }

  const ids =
    Array.isArray(params.candidateIds)
      ? params.candidateIds.filter(Boolean)
      : [];

  if (ids.length === 0) {
    throw new Error(
      "candidateIds are required for an individual campaign"
    );
  }

  const objectIds =
    ids.map((id) =>
      objectId(
        id,
        "candidateId"
      )
    );

  const candidates =
    await User.find({
      _id: {
        $in: objectIds
      },

      organizationId,

      role: UserRole.STAFF,

      isActive: true
    }).select(
      "_id firstName lastName email jobTitle department"
    );

  if (
    candidates.length !==
    objectIds.length
  ) {
    throw new Error(
      "One or more selected staff members are invalid"
    );
  }

  return candidates;
}

/* -------------------------------------------------------------------------- */
/* Create Campaign                                                            */
/* -------------------------------------------------------------------------- */

export async function createCampaign(
  params: {
    organizationId: string;
    createdBy: string;

    name: string;

    description?: string;

    roleProfileId: string;

    scope: SelfAssessmentCampaignScope;

    candidateIds?: string[];

    teamManagerId?: string;

    startAt: Date;

    dueAt: Date;

    corroborationRequired: boolean;
  }
) {
  if (
    !params.name.trim()
  ) {
    throw new Error(
      "Campaign name is required"
    );
  }

  if (
    !Object.values(
      SelfAssessmentCampaignScope
    ).includes(params.scope)
  ) {
    throw new Error(
      "Invalid campaign scope"
    );
  }

  if (
    params.dueAt.getTime() <=
    params.startAt.getTime()
  ) {
    throw new Error(
      "Deadline must be after the campaign start"
    );
  }

  if (
    params.dueAt.getTime() <=
    Date.now()
  ) {
    throw new Error(
      "Campaign deadline must be in the future"
    );
  }

  await getPublishedRoleProfile(
    params.roleProfileId,
    params.organizationId
  );

  await resolveCandidates(
    params
  );

  return SelfAssessmentCampaign.create({
    organizationId:
      objectId(
        params.organizationId,
        "organizationId"
      ),

    name:
      params.name.trim(),

    description:
      params.description?.trim() ||
      undefined,

    roleProfileId:
      objectId(
        params.roleProfileId,
        "roleProfileId"
      ),

    scope:
      params.scope,

    candidateIds:
      (params.candidateIds ?? []).map(
        (id) =>
          objectId(
            id,
            "candidateId"
          )
      ),

    teamManagerId:
      params.teamManagerId
        ? objectId(
            params.teamManagerId,
            "teamManagerId"
          )
        : undefined,

    startAt:
      params.startAt,

    dueAt:
      params.dueAt,

    corroborationRequired:
      Boolean(
        params.corroborationRequired
      ),

    status:
      SelfAssessmentCampaignStatus.DRAFT,

    createdBy:
      objectId(
        params.createdBy,
        "createdBy"
      )
  });
}

/* -------------------------------------------------------------------------- */
/* List Campaigns                                                             */
/* -------------------------------------------------------------------------- */

export async function listCampaigns(
  organizationId: string
) {
  return SelfAssessmentCampaign.find({
    organizationId:
      objectId(
        organizationId,
        "organizationId"
      )
  })
    .populate(
      "roleProfileId",
      "name department status"
    )
    .populate(
      "teamManagerId",
      "firstName lastName email"
    )
    .sort({
      createdAt: -1
    });
}

/* -------------------------------------------------------------------------- */
/* Get Campaign                                                               */
/* -------------------------------------------------------------------------- */

export async function getCampaign(
  campaignId: string,
  organizationId: string
) {
  const campaign =
    await SelfAssessmentCampaign.findOne({
      _id: objectId(
        campaignId,
        "campaignId"
      ),

      organizationId:
        objectId(
          organizationId,
          "organizationId"
        )
    })
      .populate(
        "roleProfileId",
        "name department status frameworkVersionId skills behaviouralFactors"
      )
      .populate(
        "teamManagerId",
        "firstName lastName email"
      )
      .populate(
        "candidateIds",
        "firstName lastName email jobTitle department"
      );

  if (!campaign) {
    throw new Error(
      "Campaign not found"
    );
  }

  return campaign;
}

/* -------------------------------------------------------------------------- */
/* Launch Campaign                                                            */
/* -------------------------------------------------------------------------- */

export async function launchCampaign(
  campaignId: string,
  organizationId: string,
  launchedBy: string
) {
  const campaign =
    await SelfAssessmentCampaign.findOne({
      _id: objectId(
        campaignId,
        "campaignId"
      ),

      organizationId:
        objectId(
          organizationId,
          "organizationId"
        )
    });

  if (!campaign) {
    throw new Error(
      "Campaign not found"
    );
  }

  if (
    campaign.status !==
    SelfAssessmentCampaignStatus.DRAFT
  ) {
    throw new Error(
      "Only draft campaigns can be launched"
    );
  }

  if (
    campaign.dueAt.getTime() <=
    Date.now()
  ) {
    throw new Error(
      "Campaign deadline has passed"
    );
  }

  const candidates =
    await resolveCandidates({
      organizationId,

      scope:
        campaign.scope,

      candidateIds:
        campaign.candidateIds.map(
          String
        ),

      teamManagerId:
        campaign.teamManagerId?.toString()
    });

  if (
    candidates.length === 0
  ) {
    throw new Error(
      "No active staff members match this campaign scope"
    );
  }

  const profile =
    await getPublishedRoleProfile(
      campaign.roleProfileId.toString(),
      organizationId
    );

  const notifications =
    [] as Parameters<
      typeof createNotifications
    >[0];

  for (const candidate of candidates) {
    const existing =
      await SelfAssessment.findOne({
        candidateId:
          candidate._id,

        roleProfileId:
          profile._id,

        status: {
          $in: [
            SelfAssessmentStatus.DRAFT,
            SelfAssessmentStatus.IN_PROGRESS,
            SelfAssessmentStatus.SUBMITTED
          ]
        }
      });

    if (existing) {
      throw new Error(
        `An active self-assessment already exists for ${candidate.firstName} ${candidate.lastName} against this role profile`
      );
    }

    const selfAssessment =
      await SelfAssessment.create({
        organizationId:
          objectId(
            organizationId,
            "organizationId"
          ),

        candidateId:
          candidate._id,

        roleProfileId:
          profile._id,

        frameworkVersionId:
          profile.frameworkVersionId,

        campaignId:
          campaign._id,

        dueAt:
          campaign.dueAt,

        corroborationRequired:
          campaign.corroborationRequired,

        status:
          SelfAssessmentStatus.DRAFT
      });

    notifications.push({
      organizationId,

      recipientId:
        candidate._id.toString(),

      type:
        NotificationType.SELF_ASSESSMENT_ASSIGNED,

      priority:
        NotificationPriority.HIGH,

      title:
        "New self-assessment assigned",

      message:
        `${campaign.name} is now open. Complete your self-assessment by ${campaign.dueAt.toLocaleString()}.`,

      entityType:
        "SelfAssessment",

      entityId:
        selfAssessment._id.toString(),

      metadata: {
        campaignId:
          campaign._id.toString(),

        roleProfileId:
          profile._id.toString(),

        dueAt:
          campaign.dueAt.toISOString()
      }
    });
  }

  await createNotifications(
    notifications
  );

  campaign.status =
    SelfAssessmentCampaignStatus.LAUNCHED;

  campaign.launchedBy =
    objectId(
      launchedBy,
      "launchedBy"
    );

  campaign.launchedAt =
    new Date();

  await campaign.save();

  return campaign;
}

/* -------------------------------------------------------------------------- */
/* Cancel Campaign                                                            */
/* -------------------------------------------------------------------------- */

export async function cancelCampaign(
  campaignId: string,
  organizationId: string
) {
  const campaign =
    await SelfAssessmentCampaign.findOne({
      _id: objectId(
        campaignId,
        "campaignId"
      ),

      organizationId:
        objectId(
          organizationId,
          "organizationId"
        )
    });

  if (!campaign) {
    throw new Error(
      "Campaign not found"
    );
  }

  if (
    campaign.status !==
    SelfAssessmentCampaignStatus.DRAFT
  ) {
    throw new Error(
      "Only draft campaigns can be cancelled"
    );
  }

  campaign.status =
    SelfAssessmentCampaignStatus.CANCELLED;

  await campaign.save();

  return campaign;
}