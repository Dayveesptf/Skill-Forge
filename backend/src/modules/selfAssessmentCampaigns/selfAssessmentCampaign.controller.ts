import { Response } from "express";

import {
  AuthenticatedRequest
} from "../../middleware/auth";

import {
  SelfAssessmentCampaignScope
} from "../../models/SelfAssessmentCampaign";

import {
  writeAuditLog
} from "../../utils/audit";

import {
  createCampaign,
  listCampaigns,
  getCampaign,
  launchCampaign,
  cancelCampaign
} from "./selfAssessmentCampaign.service";

function organizationId(
  req: AuthenticatedRequest
): string {
  if (
    !req.user?.organizationId
  ) {
    throw new Error(
      "Organization context is required"
    );
  }

  return req.user.organizationId;
}

function routeParam(
  value:
    | string
    | string[]
    | undefined,
  name: string
): string {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw new Error(
      `${name} is required`
    );
  }

  return value;
}

function parseDate(
  value: unknown,
  name: string
): Date {
  if (!value) {
    throw new Error(
      `${name} is required`
    );
  }

  const parsed =
    new Date(String(value));

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    throw new Error(
      `${name} is invalid`
    );
  }

  return parsed;
}

/* -------------------------------------------------------------------------- */
/* Create                                                                     */
/* -------------------------------------------------------------------------- */

export async function create(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const campaign =
      await createCampaign({
        organizationId:
          organizationId(req),

        createdBy:
          req.user!.userId,

        name:
          String(
            req.body.name ?? ""
          ),

        description:
          req.body.description,

        roleProfileId:
          String(
            req.body.roleProfileId ??
              ""
          ),

        scope:
          req.body.scope as
            SelfAssessmentCampaignScope,

        candidateIds:
          req.body.candidateIds,

        teamManagerId:
          req.body.teamManagerId,

        startAt:
          parseDate(
            req.body.startAt,
            "startAt"
          ),

        dueAt:
          parseDate(
            req.body.dueAt,
            "dueAt"
          ),

        corroborationRequired:
          Boolean(
            req.body
              .corroborationRequired
          )
      });

    await writeAuditLog(
      req,
      "SELF_ASSESSMENT_CAMPAIGN_CREATED",
      "SelfAssessmentCampaign",
      campaign.id
    );

    res.status(201).json({
      success: true,
      data: campaign
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to create campaign"
    });
  }
}

/* -------------------------------------------------------------------------- */
/* List                                                                       */
/* -------------------------------------------------------------------------- */

export async function list(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const campaigns =
      await listCampaigns(
        organizationId(req)
      );

    res.json({
      success: true,
      data: campaigns
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to list campaigns"
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Get                                                                        */
/* -------------------------------------------------------------------------- */

export async function get(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const campaign =
      await getCampaign(
        routeParam(
          req.params.id,
          "id"
        ),
        organizationId(req)
      );

    res.json({
      success: true,
      data: campaign
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Campaign not found"
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Launch                                                                     */
/* -------------------------------------------------------------------------- */

export async function launch(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const campaign =
      await launchCampaign(
        routeParam(
          req.params.id,
          "id"
        ),
        organizationId(req),
        req.user!.userId
      );

    await writeAuditLog(
      req,
      "SELF_ASSESSMENT_CAMPAIGN_LAUNCHED",
      "SelfAssessmentCampaign",
      campaign.id
    );

    res.json({
      success: true,
      data: campaign
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to launch campaign"
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Cancel                                                                     */
/* -------------------------------------------------------------------------- */

export async function cancel(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const campaign =
      await cancelCampaign(
        routeParam(
          req.params.id,
          "id"
        ),
        organizationId(req)
      );

    await writeAuditLog(
      req,
      "SELF_ASSESSMENT_CAMPAIGN_CANCELLED",
      "SelfAssessmentCampaign",
      campaign.id
    );

    res.json({
      success: true,
      data: campaign
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to cancel campaign"
    });
  }
}