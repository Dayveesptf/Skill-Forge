import { Request, Response } from "express";
import { AuthenticatedRequest } from "../../middleware/auth";
import { UserRole } from "../../constants/roles";
import { writeAuditLog } from "../../utils/audit";
import {
  acceptInvitation,
  createInvitation,
  listInvitations,
  revokeInvitation
} from "./invitation.service";

function getRouteParam(
  value: string | string[] | undefined,
  paramName: string
): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${paramName} is required`);
  }

  return value;
}

function orgId(req: AuthenticatedRequest) {
  return req.user?.organizationId;
}

export async function create(req: AuthenticatedRequest, res: Response) {
  const organizationId = orgId(req);
  if (!organizationId || !req.user) {
    res.status(400).json({ success: false, message: "Organization context is required" });
    return;
  }

  const result = await createInvitation(
    organizationId,
    req.user.userId,
    req.body
  );

  await writeAuditLog(req, "INVITATION_CREATED", "Invitation", result.invitation.id, {
    email: result.invitation.email,
    role: result.invitation.role
  });

  // In production this raw token is emailed through the notification service.
  res.status(201).json({
    success: true,
    data: {
      invitation: result.invitation,
      inviteToken: result.rawToken
    }
  });
}

export async function list(req: AuthenticatedRequest, res: Response) {
  const organizationId = orgId(req);
  if (!organizationId) {
    res.status(400).json({ success: false, message: "Organization context is required" });
    return;
  }

  res.json({
    success: true,
    data: await listInvitations(organizationId)
  });
}

export async function revoke(req: AuthenticatedRequest, res: Response) {
  const organizationId = orgId(req);
  if (!organizationId) {
    res.status(400).json({ success: false, message: "Organization context is required" });
    return;
  }

  const id = getRouteParam(
    req.params.id,
    "id"
  );

  const invitation = await revokeInvitation(
    organizationId,
    id
  );

  if (!invitation) {
    res.status(404).json({ success: false, message: "Pending invitation not found" });
    return;
  }

  await writeAuditLog(
    req,
    "INVITATION_REVOKED",
    "Invitation",
    id
  );

  res.json({ success: true, data: invitation });
}

export async function accept(req: Request, res: Response) {
  const user = await acceptInvitation(req.body.token, req.body.password);

  res.status(201).json({
    success: true,
    message: "Invitation accepted. You can now sign in.",
    data: {
      id: user._id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId
    }
  });
}
