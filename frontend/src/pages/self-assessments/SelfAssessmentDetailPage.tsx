import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Save, Send } from "lucide-react";

import { api, errorMessage, unwrap } from "../../api";
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Loading,
  PageHeader,
  Section,
  SuccessMessage,
} from "../../components/ui";
import { EvidenceUploader } from "../../components/EvidenceUploader";

type SelfAssessmentStatus = "DRAFT" | "IN_PROGRESS" | "SUBMITTED";
type ConfidenceLevel = "LOW" | "MEDIUM" | "HIGH";
type CompetencyType = "SKILL" | "BEHAVIOURAL";

interface RoleCompetency {
  skillId?: string | { _id?: string; name?: string; title?: string };
  behaviouralFactorId?: string | { _id?: string; name?: string; title?: string };
  name?: string;
  competencyName?: string;
  targetLevel?: number;
  level?: number;
}

interface RoleProfile {
  _id?: string;
  name?: string;
  title?: string;
  skills?: RoleCompetency[];
  behaviouralFactors?: RoleCompetency[];
}

interface SelfAssessmentResponse {
  _id?: string;
  skillId?: string | { _id?: string; name?: string; title?: string };
  behaviouralFactorId?: string | { _id?: string; name?: string; title?: string };
  selectedLevel?: number;
  confidence?: ConfidenceLevel;
  evidence?: string;
}

interface SelfAssessmentRecord {
  _id?: string;
  status?: SelfAssessmentStatus;
  candidateId?: string;
  roleProfileId?: string | RoleProfile;
  frameworkVersionId?: string | { _id?: string; name?: string; version?: string };
  corroborationRequired?: boolean;
  submittedAt?: string;
}

interface SelfAssessmentPayload {
  selfAssessment: SelfAssessmentRecord;
  roleProfile?: RoleProfile;
  responses?: SelfAssessmentResponse[];
}

interface ResponseRowProps {
  assessmentId: string;
  competency: RoleCompetency & { competencyType: CompetencyType };
  response?: SelfAssessmentResponse;
  disabled: boolean;
  onSaved: () => void;
}

function idOf(value?: string | { _id?: string }): string | undefined {
  if (!value) return undefined;
  return typeof value === "string" ? value : value._id;
}

function nameOf(value?: string | { name?: string; title?: string; _id?: string }): string | undefined {
  if (!value || typeof value === "string") return undefined;
  return value.name ?? value.title ?? value._id;
}

function getCompetencyId(competency: RoleCompetency): string | undefined {
  return idOf(competency.skillId) ?? idOf(competency.behaviouralFactorId);
}

function getResponseId(response: SelfAssessmentResponse): string | undefined {
  return idOf(response.skillId) ?? idOf(response.behaviouralFactorId);
}

function getCompetencyName(competency: RoleCompetency): string {
  return (
    competency.name ??
    competency.competencyName ??
    nameOf(competency.skillId) ??
    nameOf(competency.behaviouralFactorId) ??
    "Competency"
  );
}

function statusTone(status?: SelfAssessmentStatus): "green" | "blue" | "slate" {
  if (status === "SUBMITTED") return "green";
  if (status === "IN_PROGRESS") return "blue";
  return "slate";
}

function ResponseRow({
  assessmentId,
  competency,
  response,
  disabled,
  onSaved,
}: ResponseRowProps) {
  const [selectedLevel, setSelectedLevel] = useState(response?.selectedLevel ?? 1);
  const [confidence, setConfidence] = useState<ConfidenceLevel>(response?.confidence ?? "MEDIUM");
  const [evidence, setEvidence] = useState(response?.evidence ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const competencyKey = competency.competencyType === "SKILL" ? "skillId" : "behaviouralFactorId";
  const competencyId = idOf(competency[competencyKey]);

  async function saveResponse() {
    if (!competencyId || disabled) return;
    setSaving(true);
    setError("");

    try {
      await api.post(`/self-assessments/${assessmentId}/responses`, {
        [competencyKey]: competencyId,
        selectedLevel,
        confidence,
        evidence: evidence.trim(),
      });
      setSaved(true);
      onSaved();
      window.setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      setError(errorMessage(err, "Could not save this response."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-line p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="font-semibold text-white">{getCompetencyName(competency)}</p>
          <p className="mt-1 text-xs text-slate-600">
            Target level {competency.targetLevel ?? competency.level ?? "—"} · {competency.competencyType === "SKILL" ? "Skill" : "Behavioural factor"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            className="field w-24"
            value={selectedLevel}
            disabled={disabled}
            onChange={(event) => setSelectedLevel(Number(event.target.value))}
            aria-label={`${getCompetencyName(competency)} self-assessed level`}
          >
            {Array.from({ length: 10 }, (_, index) => (
              <option key={index + 1} value={index + 1}>{index + 1}</option>
            ))}
          </select>

          <select
            className="field w-32"
            value={confidence}
            disabled={disabled}
            onChange={(event) => setConfidence(event.target.value as ConfidenceLevel)}
            aria-label={`${getCompetencyName(competency)} confidence`}
          >
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
          </select>
        </div>
      </div>

      <textarea
        className="field mt-4 resize-y"
        rows={3}
        maxLength={5000}
        value={evidence}
        disabled={disabled}
        onChange={(event) => setEvidence(event.target.value)}
        placeholder="Add evidence, examples, projects or context..."
      />

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

      <EvidenceUploader responseId={response?._id} disabled={disabled} />

      {!disabled && (
        <div className="mt-3 flex justify-end">
          <Button type="button" variant="secondary" disabled={saving} onClick={saveResponse}>
            <Save size={14} />
            {saving ? "Saving..." : saved ? "Saved" : "Save response"}
          </Button>
        </div>
      )}
    </div>
  );
}

export default function SelfAssessmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const query = useQuery({
    queryKey: ["self-assessment", id],
    enabled: Boolean(id),
    queryFn: async () => unwrap<SelfAssessmentPayload>(await api.get(`/self-assessments/${id}`)),
  });

  const assessment = query.data?.selfAssessment;
  const roleProfile = query.data?.roleProfile ?? {};
  const responses = query.data?.responses ?? [];

  const competencies = useMemo(
    () => [
      ...(roleProfile.skills ?? []).map((skill) => ({ ...skill, competencyType: "SKILL" as const })),
      ...(roleProfile.behaviouralFactors ?? []).map((factor) => ({ ...factor, competencyType: "BEHAVIOURAL" as const })),
    ],
    [roleProfile],
  );

  const status = assessment?.status ?? "DRAFT";
  const submitted = status === "SUBMITTED";
  const responseCount = responses.length;
  const complete = responseCount === competencies.length;

  async function start() {
    if (!id) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await api.post(`/self-assessments/${id}/start`);
      await query.refetch();
      setMessage("Assessment started. You can save your progress and return later.");
    } catch (err) {
      setError(errorMessage(err, "Could not start the self-assessment."));
    } finally { setBusy(false); }
  }

  async function submit() {
    if (!id) return;
    if (!complete) {
      setError(`Complete all ${competencies.length} competencies before submitting. You currently have ${responseCount}.`);
      return;
    }
    setBusy(true); setError(""); setMessage("");
    try {
      await api.post(`/self-assessments/${id}/submit`);
      await query.refetch();
      setMessage(
        assessment?.corroborationRequired
          ? "Self-assessment submitted. It is now awaiting manager corroboration."
          : "Self-assessment submitted and finalized. Your result is now locked for reporting and gap analysis.",
      );
    } catch (err) {
      setError(errorMessage(err, "Could not submit the self-assessment."));
    } finally { setBusy(false); }
  }

  if (query.isLoading) return <Loading />;
  if (query.isError) {
    return <ErrorState text={errorMessage(query.error, "Self-assessment could not be loaded.")} onRetry={() => query.refetch()} />;
  }
  if (!id || !assessment) return <ErrorState text="Self-assessment could not be found." />;

  return (
    <>
      <PageHeader
        eyebrow="Self assessment"
        title={roleProfile.name ?? roleProfile.title ?? "Self assessment"}
        description="Rate yourself against each role competency, choose your confidence and provide supporting evidence."
        actions={
          <>
            <Button type="button" variant="secondary" onClick={() => navigate("/self-assessments")}>
              <ArrowLeft size={16} /> Back
            </Button>
            {status === "DRAFT" && (
              <Button type="button" disabled={busy} onClick={start}>
                <Save size={16} /> Start
              </Button>
            )}
            {status === "IN_PROGRESS" && (
              <Button type="button" disabled={busy || !complete} onClick={submit}>
                <Send size={16} /> Submit
              </Button>
            )}
          </>
        }
      />

      {message && <div className="mb-5"><SuccessMessage text={message} /></div>}
      {error && <div className="mb-5"><ErrorState text={error} /></div>}

      <div className="grid gap-6 xl:grid-cols-[1fr_0.7fr]">
        <Card className="p-6">
          <Section
            title="Competency matrix"
            description="Use the 1–10 level scale defined by the framework and support each rating with evidence."
          >
            {competencies.length > 0 ? (
              <div className="space-y-3">
                {competencies.map((competency, index) => {
                  const competencyId = getCompetencyId(competency);
                  const response = responses.find((item) => getResponseId(item) === competencyId);
                  return (
                    <ResponseRow
                      key={competencyId ?? `${competency.competencyType}-${index}`}
                      assessmentId={id}
                      competency={competency}
                      response={response}
                      disabled={submitted || status === "DRAFT"}
                      onSaved={() => query.refetch()}
                    />
                  );
                })}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-slate-600">The role profile has no competencies configured.</p>
            )}
          </Section>
        </Card>

        <div className="space-y-6">
          <Card className="p-6">
            <Section title="Assessment status">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-slate-500">Status</span>
                  <Badge tone={statusTone(status)}>{status}</Badge>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-slate-500">Responses</span>
                  <span className="font-semibold text-white">{responseCount}/{competencies.length}</span>
                </div>
                {status === "IN_PROGRESS" && !complete && (
                  <p className="text-xs leading-5 text-amber-400">Complete every competency before submitting.</p>
                )}
                {submitted && (
                  <div className="flex items-start gap-2 rounded-xl border border-line bg-ink p-3 text-xs leading-5 text-slate-400">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-400" />
                    <span>
                      {assessment.corroborationRequired
                        ? "Submitted. Waiting for your manager to corroborate the assessment."
                        : "Finalized. Assessed levels are locked and available to gap analysis."}
                    </span>
                  </div>
                )}
              </div>
            </Section>
          </Card>

          <Card className="p-6">
            <Section title="Framework" description="The competency model used for this self-assessment.">
              <p className="text-sm font-medium text-white">
                {typeof assessment.frameworkVersionId === "string"
                  ? assessment.frameworkVersionId
                  : assessment.frameworkVersionId?.name ?? assessment.frameworkVersionId?.version ?? "Framework not shown"}
              </p>
            </Section>
          </Card>
        </div>
      </div>
    </>
  );
}