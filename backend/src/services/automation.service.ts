import {
  SelfAssessmentCampaign,
  SelfAssessmentCampaignStatus,
} from "../models/SelfAssessmentCampaign";
import { SelfAssessment, SelfAssessmentStatus } from "../models/SelfAssessment";
import { ManagerCorroboration, ManagerCorroborationStatus } from "../models/ManagerCorroboration";
import { Notification, NotificationType, NotificationPriority } from "../models/Notification";
import { createNotifications } from "../modules/notifications/notification.service";
import { launchCampaign } from "../modules/selfAssessmentCampaigns/selfAssessmentCampaign.service";

const CAMPAIGN_REMINDER = "CAMPAIGN_REMINDER" as NotificationType;
const MANAGER_CORROBORATION_PENDING = "MANAGER_CORROBORATION_PENDING" as NotificationType;

let running = false;

async function autoLaunchDueCampaigns() {
  const campaigns = await SelfAssessmentCampaign.find({
    status: SelfAssessmentCampaignStatus.DRAFT,
    startAt: { $lte: new Date() },
    dueAt: { $gt: new Date() },
  }).select("_id organizationId createdBy");

  for (const campaign of campaigns) {
    try {
      await launchCampaign(
        campaign._id.toString(),
        campaign.organizationId.toString(),
        campaign.createdBy.toString(),
      );
    } catch (error) {
      console.error(`Scheduled campaign ${campaign._id} was not launched:`, error);
    }
  }
}

async function sendAssessmentReminders() {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const assessments = await SelfAssessment.find({
    status: { $in: [SelfAssessmentStatus.DRAFT, SelfAssessmentStatus.IN_PROGRESS] },
    dueAt: { $gt: now, $lte: tomorrow },
  }).select("_id organizationId candidateId dueAt campaignId");

  for (const assessment of assessments) {
    const alreadySent = await Notification.exists({
      recipientId: assessment.candidateId,
      type: CAMPAIGN_REMINDER,
      entityType: "SelfAssessment",
      entityId: assessment._id,
      createdAt: { $gte: new Date(now.getTime() - 20 * 60 * 60 * 1000) },
    });
    if (alreadySent) continue;

    await createNotifications([{
      organizationId: assessment.organizationId?.toString(),
      recipientId: assessment.candidateId.toString(),
      type: CAMPAIGN_REMINDER,
      priority: NotificationPriority.HIGH,
      title: "Assessment deadline approaching",
      message: `Your self-assessment is due by ${assessment.dueAt?.toLocaleString() ?? "the campaign deadline"}.`,
      entityType: "SelfAssessment",
      entityId: assessment._id.toString(),
    }]);
  }
}

async function sendCorroborationReminders() {
  const pending = await ManagerCorroboration.find({
    status: ManagerCorroborationStatus.PENDING,
  }).select("_id organizationId managerId candidateId createdAt");

  for (const item of pending) {
    const alreadySent = await Notification.exists({
      recipientId: item.managerId,
      type: MANAGER_CORROBORATION_PENDING,
      entityType: "ManagerCorroboration",
      entityId: item._id,
      createdAt: { $gte: new Date(Date.now() - 20 * 60 * 60 * 1000) },
    });
    if (alreadySent) continue;

    await createNotifications([{
      organizationId: item.organizationId?.toString(),
      recipientId: item.managerId.toString(),
      type: MANAGER_CORROBORATION_PENDING,
      priority: NotificationPriority.HIGH,
      title: "Corroboration pending",
      message: "A staff self-assessment is waiting for your corroboration and written review where adjustments are required.",
      entityType: "ManagerCorroboration",
      entityId: item._id.toString(),
    }]);
  }
}

export async function runAutomationCycle() {
  if (running) return;
  running = true;
  try {
    await autoLaunchDueCampaigns();
    await sendAssessmentReminders();
    await sendCorroborationReminders();
  } finally {
    running = false;
  }
}

export function startAutomationWorker() {
  void runAutomationCycle();
  const timer = setInterval(() => void runAutomationCycle(), 60_000);
  timer.unref?.();
  return timer;
}
