import { dueScheduledReports, markScheduledReportRun, buildExportRows } from "./infrastructure.service";
import { buildOrganizationPdf, buildOrganizationXlsx } from "./report-export.service";
import { env } from "../../config/env";

async function sendEmail(to: string[], subject: string, text: string, attachment: Buffer, filename: string, contentType: string) {
  if (!env.resendApiKey) throw new Error("RESEND_API_KEY is not configured");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.reportFromEmail, to, subject, text, attachments: [{ filename, content: attachment.toString("base64") }] })
  });
  if (!response.ok) throw new Error(`Report email delivery failed (${response.status})`);
}

let running = false;
export async function runScheduledReports() {
  if (running) return;
  running = true;
  try {
    const reports = await dueScheduledReports();
    for (const report of reports) {
      try {
        await buildExportRows(report.organizationId.toString());
        const attachment = report.format === "PDF" ? await buildOrganizationPdf(report.organizationId.toString()) : await buildOrganizationXlsx(report.organizationId.toString());
        const filename = `skillforge-${report.organizationId}-${new Date().toISOString().slice(0, 10)}.${report.format === "PDF" ? "pdf" : "xlsx"}`;
        await sendEmail(report.recipients, `SkillForge report: ${report.name}`, `Your scheduled SkillForge report "${report.name}" is attached.`, attachment, filename, report.format === "PDF" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        await markScheduledReportRun(report);
      } catch (error) {
        await markScheduledReportRun(report, error instanceof Error ? error.message : "Report delivery failed");
      }
    }
  } finally { running = false; }
}

export function startScheduledReportWorker() {
  void runScheduledReports();
  return setInterval(() => void runScheduledReports(), 60_000);
}
