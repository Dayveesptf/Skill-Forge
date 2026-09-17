import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

import { api, errorMessage, unwrap } from "../../api";
import { Badge, Button, Card, ErrorState, Loading, PageHeader } from "../../components/ui";
import { EvidenceUploader } from "../../components/EvidenceUploader";

interface ResponseItem {
  _id: string;
  selectedLevel: number;
  evidence?: string;
  confidence?: string;
  skillId?: { _id?: string; name?: string; title?: string };
  behaviouralFactorId?: { _id?: string; name?: string; title?: string };
}

type DecisionType = "CONFIRMED" | "ADJUSTED";

interface Decision {
  responseId: string;
  finalLevel: number;
  decision: DecisionType;
  justification?: string;
}

interface DecisionState {
  finalLevel: number;
  decision: DecisionType;
  justification: string;
}

export default function ManagerCorroborationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [decisions, setDecisions] = useState<Record<string, DecisionState>>({});

  const query = useQuery({
    queryKey: ["manager", "corroboration", id],
    enabled: Boolean(id),
    queryFn: async () => unwrap<any>(await api.get(`/manager-corroborations/${id}`)),
  });

  const data = query.data;
  const responses: ResponseItem[] = useMemo(
    () => (Array.isArray(data?.responses) ? data.responses : []),
    [data],
  );

  const status = data?.corroboration?.status ?? "PENDING";
  const candidate = data?.corroboration?.candidateId;
  const name = `${candidate?.firstName ?? ""} ${candidate?.lastName ?? ""}`.trim();

  function getDecision(response: ResponseItem): DecisionState {
    return decisions[response._id] ?? {
      finalLevel: response.selectedLevel,
      decision: "CONFIRMED",
      justification: "",
    };
  }

  function updateDecision(response: ResponseItem, patch: Partial<DecisionState>) {
    setDecisions((current) => ({
      ...current,
      [response._id]: { ...getDecision(response), ...patch },
    }));
  }

  const reviewMutation = useMutation({
    mutationFn: async (payload: { decisions: Decision[] }) =>
      unwrap<any>(await api.post(`/manager-corroborations/${id}/review`, payload)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manager", "corroborations"] });
      navigate("/manager-corroborations");
    },
  });

  function submitReview() {
    const payload: Decision[] = responses.map((response) => {
      const item = getDecision(response);
      return {
        responseId: response._id,
        finalLevel: Number(item.finalLevel),
        decision: item.decision,
        ...(item.decision === "ADJUSTED"
          ? { justification: item.justification.trim() }
          : {}),
      };
    });

    const invalid = payload.some(
      (item) =>
        !Number.isInteger(item.finalLevel) ||
        item.finalLevel < 1 ||
        item.finalLevel > 10 ||
        (item.decision === "ADJUSTED" && !item.justification),
    );

    if (invalid) {
      window.alert(
        "Please provide a valid final level for every competency. Adjusted levels require written justification.",
      );
      return;
    }

    reviewMutation.mutate({ decisions: payload });
  }

  if (query.isLoading) return <Loading />;

  if (query.isError) {
    return (
      <ErrorState
        text={errorMessage(query.error, "Could not load this corroboration.")}
        onRetry={() => query.refetch()}
      />
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Manager corroboration"
        title={name || "Assessment review"}
        description="Review the staff member's claimed levels and supporting evidence. Confirm the level or adjust it with written justification."
        actions={
          <Button variant="secondary" onClick={() => navigate("/manager-corroborations")}>
            <ArrowLeft size={16} />
            Back
          </Button>
        }
      />

      <div className="space-y-5">
        <Card>
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={status === "COMPLETED" ? "green" : "amber"}>{status}</Badge>
            <span className="text-sm text-slate-500">
              {candidate?.jobTitle ?? candidate?.department ?? candidate?.email}
            </span>
          </div>
        </Card>

        {status === "COMPLETED" ? (
          <Card>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 text-emerald-400" size={20} />
              <div>
                <h2 className="font-semibold text-white">Corroboration completed</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  The manager decisions have been finalized and the assessment result is locked for reporting and gap analysis.
                </p>
              </div>
            </div>
          </Card>
        ) : (
          <>
            {responses.map((response) => {
              const item = getDecision(response);
              const competency =
                response.skillId?.name ??
                response.skillId?.title ??
                response.behaviouralFactorId?.name ??
                response.behaviouralFactorId?.title ??
                "Competency";

              return (
                <Card key={response._id}>
                  <div className="flex flex-col gap-6">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Competency</p>
                      <h2 className="mt-2 text-lg font-semibold text-white">{competency}</h2>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-xl border border-line bg-ink p-4">
                        <p className="text-xs text-slate-600">Staff claimed level</p>
                        <p className="mt-2 text-2xl font-bold text-white">{response.selectedLevel}</p>
                      </div>

                      <label>
                        <span className="text-xs font-medium text-slate-500">Final level</span>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={item.finalLevel}
                          onChange={(event) =>
                            updateDecision(response, { finalLevel: Number(event.target.value) })
                          }
                          className="field mt-2 w-full"
                        />
                      </label>

                      <label>
                        <span className="text-xs font-medium text-slate-500">Decision</span>
                        <select
                          value={item.decision}
                          onChange={(event) =>
                            updateDecision(response, { decision: event.target.value as DecisionType })
                          }
                          className="field mt-2 w-full"
                        >
                          <option value="CONFIRMED">Confirm level</option>
                          <option value="ADJUSTED">Adjust level</option>
                        </select>
                      </label>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-slate-500">Supporting evidence</p>
                      <div className="mt-2 rounded-xl border border-line bg-ink p-4 text-sm leading-7 text-slate-400">
                        {response.evidence || "No supporting evidence provided."}
                      </div>
                      <EvidenceUploader responseId={response._id} disabled />
                    </div>

                    {item.decision === "ADJUSTED" && (
                      <label>
                        <span className="text-xs font-medium text-slate-500">Written justification</span>
                        <textarea
                          value={item.justification}
                          onChange={(event) => updateDecision(response, { justification: event.target.value })}
                          rows={4}
                          maxLength={5000}
                          className="field mt-2 w-full resize-y"
                          placeholder="Explain why the final level differs from the staff member's claimed level."
                        />
                      </label>
                    )}
                  </div>
                </Card>
              );
            })}

            <div className="flex justify-end">
              <Button onClick={submitReview} disabled={reviewMutation.isPending || responses.length === 0}>
                <CheckCircle2 size={16} />
                {reviewMutation.isPending ? "Submitting..." : "Complete corroboration"}
              </Button>
            </div>

            {reviewMutation.isError && (
              <p className="text-sm text-red-400">
                {errorMessage(reviewMutation.error, "Could not submit the corroboration.")}
              </p>
            )}
          </>
        )}
      </div>
    </>
  );
}