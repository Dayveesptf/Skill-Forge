import { useMemo, useState } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  BrainCircuit,
  Check,
  Eye,
  RefreshCw,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import { api, unwrap } from "../../api";
import { PageHeader } from "../../components/ui";
import {
  DataTable,
  type DataTableColumn,
} from "../../components/DataTable";

type AIReviewDecision = "APPROVE" | "REJECT";

type GenerationType =
  | "ROLE_SKILL_MAPPING"
  | "INTERVIEW_QUESTIONS"
  | string;

interface RoleSkillSuggestion {
  skillId: string;
  targetLevel: number;
  confidence: number;
  rationale: string;
}

interface BehaviouralFactorSuggestion {
  behaviouralFactorId: string;
  targetLevel: number;
  confidence: number;
  rationale: string;
}

interface InterviewQuestion {
  question: string;
  scenario?: string;
  type?: string;
  difficulty?: string;
  skillId?: string;
  behaviouralFactorId?: string;
  level?: number;
  options?: string[];
  explanation?: string;
  guidance?: string;
  weight?: number;
  isRequired?: boolean;
}

interface RoleSkillMappingOutput {
  skills?: RoleSkillSuggestion[];
  behaviouralFactors?: BehaviouralFactorSuggestion[];
  summary?: string;
}

interface InterviewQuestionsOutput {
  questions?: InterviewQuestion[];
  summary?: string;
}

interface AIGeneration {
  _id: string;
  generationType?: GenerationType;
  aiModel?: string;
  model?: string;
  status?: string;
  createdAt?: string;

  roleProfileId?:
    | string
    | {
        _id?: string;
        name?: string;
        slug?: string;
        status?: string;
      };

  assessmentId?:
    | string
    | {
        _id?: string;
        title?: string;
        status?: string;
      };

  output?:
    | RoleSkillMappingOutput
    | InterviewQuestionsOutput
    | unknown;
}

interface AIGenerationsResponse {
  generations?: AIGeneration[];
  items?: AIGeneration[];
  data?: AIGeneration[];
}

interface ReviewPayload {
  decision: AIReviewDecision;
  approvedIndexes: number[];
  reviewNotes: string;
  applyToRoleProfile: boolean;
  applyToAssessment: boolean;
}

function extractGenerations(
  response: AIGenerationsResponse | AIGeneration[],
): AIGeneration[] {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.generations)) {
    return response.generations;
  }

  if (Array.isArray(response?.items)) {
    return response.items;
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  return [];
}

function formatGenerationType(
  generationType?: string,
): string {
  if (!generationType) {
    return "AI Generation";
  }

  return generationType
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) =>
      char.toUpperCase(),
    );
}

function formatDate(value?: string): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString();
}

function getStatusTone(status?: string): string {
  switch (status) {
    case "PENDING_REVIEW":
      return "bg-amber-100 text-amber-800";

    case "APPROVED":
      return "bg-emerald-100 text-emerald-800";

    case "REJECTED":
      return "bg-red-100 text-red-800";

    default:
      return "bg-slate-100 text-slate-700";
  }
}

function isPendingReview(generation: AIGeneration): boolean {
  return generation.status === "PENDING_REVIEW";
}

function isRoleSkillMapping(
  generation: AIGeneration,
): boolean {
  return (
    generation.generationType ===
    "ROLE_SKILL_MAPPING"
  );
}

function isInterviewQuestions(
  generation: AIGeneration,
): boolean {
  return (
    generation.generationType ===
    "INTERVIEW_QUESTIONS"
  );
}

function getRoleMappingOutput(
  generation: AIGeneration,
): RoleSkillMappingOutput {
  if (
    !generation.output ||
    typeof generation.output !== "object"
  ) {
    return {};
  }

  return generation.output as RoleSkillMappingOutput;
}

function getInterviewOutput(
  generation: AIGeneration,
): InterviewQuestionsOutput {
  if (
    !generation.output ||
    typeof generation.output !== "object"
  ) {
    return {};
  }

  return generation.output as InterviewQuestionsOutput;
}

function getRoleProfileName(
  generation: AIGeneration,
): string {
  if (
    generation.roleProfileId &&
    typeof generation.roleProfileId === "object"
  ) {
    return (
      generation.roleProfileId.name ||
      generation.roleProfileId.slug ||
      "Role profile"
    );
  }

  return "Role profile";
}

function getAssessmentName(
  generation: AIGeneration,
): string {
  if (
    generation.assessmentId &&
    typeof generation.assessmentId === "object"
  ) {
    return (
      generation.assessmentId.title ||
      "Assessment"
    );
  }

  return "Assessment";
}

function getGenerationSummary(
  generation: AIGeneration,
): string {
  if (isRoleSkillMapping(generation)) {
    return (
      getRoleMappingOutput(generation).summary ||
      "No summary provided."
    );
  }

  if (isInterviewQuestions(generation)) {
    return (
      getInterviewOutput(generation).summary ||
      "No summary provided."
    );
  }

  return "No summary provided.";
}

function getSuggestionCount(
  generation: AIGeneration,
): number {
  if (isRoleSkillMapping(generation)) {
    const output =
      getRoleMappingOutput(generation);

    return (
      (output.skills?.length ?? 0) +
      (output.behaviouralFactors?.length ?? 0)
    );
  }

  if (isInterviewQuestions(generation)) {
    return (
      getInterviewOutput(generation)
        .questions?.length ?? 0
    );
  }

  return 0;
}

function getGenerationDescription(
  generation: AIGeneration,
): string {
  if (isRoleSkillMapping(generation)) {
    return `AI-generated competency mapping for ${getRoleProfileName(
      generation,
    )}.`;
  }

  if (isInterviewQuestions(generation)) {
    return `AI-generated interview questions for ${getAssessmentName(
      generation,
    )}.`;
  }

  return "AI-generated content awaiting review.";
}

function getOutputCountLabel(
  generation: AIGeneration,
): string {
  const count =
    getSuggestionCount(generation);

  if (isRoleSkillMapping(generation)) {
    return `${count} competency suggestion${
      count === 1 ? "" : "s"
    }`;
  }

  if (isInterviewQuestions(generation)) {
    return `${count} question${
      count === 1 ? "" : "s"
    }`;
  }

  return `${count} item${
    count === 1 ? "" : "s"
  }`;
}

interface ReviewModalProps {
  generation: AIGeneration;
  onClose: () => void;
  onSuccess: () => void;
}

function ReviewModal({
  generation,
  onClose,
  onSuccess,
}: ReviewModalProps) {
  const canReview =
    generation.status === "PENDING_REVIEW";

  const [decision, setDecision] =
    useState<AIReviewDecision>("APPROVE");

  const [selectedIndexes, setSelectedIndexes] =
    useState<number[]>([]);

  const [reviewNotes, setReviewNotes] =
    useState("");

  const [applyChanges, setApplyChanges] =
    useState(true);

  const [expandedIndexes, setExpandedIndexes] =
    useState<number[]>([]);

  const reviewMutation =
    useMutation({
      mutationFn: async (
        payload: ReviewPayload,
      ) => {
        return api.post(
          `/ai/generations/${generation._id}/review`,
          payload,
        );
      },

      onSuccess: () => {
        onSuccess();
      },
    });

  const roleOutput =
    getRoleMappingOutput(generation);

  const interviewOutput =
    getInterviewOutput(generation);

  const skills =
    roleOutput.skills ?? [];

  const behaviouralFactors =
    roleOutput.behaviouralFactors ?? [];

  const questions =
    interviewOutput.questions ?? [];

  const totalItems =
    isRoleSkillMapping(generation)
      ? skills.length +
        behaviouralFactors.length
      : questions.length;

  function toggleSelection(index: number) {
    setSelectedIndexes((current) => {
      if (current.includes(index)) {
        return current.filter(
          (item) => item !== index,
        );
      }

      return [...current, index].sort(
        (a, b) => a - b,
      );
    });
  }

  function toggleExpanded(index: number) {
    setExpandedIndexes((current) => {
      if (current.includes(index)) {
        return current.filter(
          (item) => item !== index,
        );
      }

      return [...current, index];
    });
  }

  function selectAll() {
    setSelectedIndexes(
      Array.from(
        { length: totalItems },
        (_, index) => index,
      ),
    );
  }

  function clearAll() {
    setSelectedIndexes([]);
  }

  function handleSubmit() {
    if (!canReview) {
      window.alert(
        "This AI generation has already been reviewed.",
      );
      return;
    }

    if (
      decision === "APPROVE" &&
      selectedIndexes.length === 0
    ) {
      window.alert(
        "Select at least one item to approve.",
      );
      return;
    }

    const payload: ReviewPayload = {
      decision,

      approvedIndexes:
        decision === "APPROVE"
          ? selectedIndexes
          : [],

      reviewNotes:
        reviewNotes.trim(),

      applyToRoleProfile:
        decision === "APPROVE" &&
        applyChanges &&
        isRoleSkillMapping(generation),

      applyToAssessment:
        decision === "APPROVE" &&
        applyChanges &&
        isInterviewQuestions(generation),
    };

    reviewMutation.mutate(payload);
  }

  const roleProfileName =
    getRoleProfileName(generation);

  const assessmentName =
    getAssessmentName(generation);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <div className="flex items-center gap-2">
              <BrainCircuit
                size={20}
                className="text-blue-600"
              />

              <h2 className="text-lg font-semibold text-slate-900">
                {isRoleSkillMapping(
                  generation,
                )
                  ? "Review AI Role Skill Mapping"
                  : "Review AI Interview Questions"}
              </h2>
            </div>

            <p className="mt-1 text-sm text-slate-500">
              {isRoleSkillMapping(
                generation,
              )
                ? roleProfileName
                : assessmentName}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm leading-6 text-slate-700">
              {getGenerationSummary(
                generation,
              )}
            </p>
          </div>

          {isRoleSkillMapping(
            generation,
          ) && (
            <div className="space-y-6">
              {skills.length > 0 && (
                <section>
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        Skills
                      </h3>

                      <p className="text-sm text-slate-500">
                        {skills.length} AI-generated
                        skill mappings
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {skills.map(
                      (skill, index) => {
                        const expanded =
                          expandedIndexes.includes(
                            index,
                          );

                        const selected =
                          selectedIndexes.includes(
                            index,
                          );

                        return (
                          <div
                            key={`skill-${index}`}
                            className={`rounded-xl border ${
                              selected
                                ? "border-blue-300 bg-blue-50/40"
                                : "border-slate-200"
                            }`}
                          >
                            <div className="flex items-start gap-3 p-4">
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() =>
                                  toggleSelection(
                                    index,
                                  )
                                }
                                className="mt-1 h-4 w-4 rounded border-slate-300"
                              />

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-medium text-slate-900">
                                    Skill{" "}
                                    {index + 1}
                                  </span>

                                  <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                                    Target level{" "}
                                    {
                                      skill.targetLevel
                                    }
                                  </span>

                                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                                    {Math.round(
                                      skill.confidence *
                                        100,
                                    )}
                                    % confidence
                                  </span>
                                </div>

                                <p className="mt-1 break-all text-xs text-slate-400">
                                  {skill.skillId}
                                </p>

                                {expanded && (
                                  <p className="mt-3 text-sm leading-6 text-slate-600">
                                    {
                                      skill.rationale
                                    }
                                  </p>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  toggleExpanded(
                                    index,
                                  )
                                }
                                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                              >
                                {expanded ? (
                                  <ChevronUp
                                    size={18}
                                  />
                                ) : (
                                  <ChevronDown
                                    size={18}
                                  />
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>
                </section>
              )}

              {behaviouralFactors.length >
                0 && (
                <section>
                  <div className="mb-3">
                    <h3 className="font-semibold text-slate-900">
                      Behavioural Factors
                    </h3>

                    <p className="text-sm text-slate-500">
                      {
                        behaviouralFactors.length
                      }{" "}
                      AI-generated behavioural
                      mappings
                    </p>
                  </div>

                  <div className="space-y-3">
                    {behaviouralFactors.map(
                      (
                        factor,
                        factorIndex,
                      ) => {
                        const index =
                          skills.length +
                          factorIndex;

                        const expanded =
                          expandedIndexes.includes(
                            index,
                          );

                        const selected =
                          selectedIndexes.includes(
                            index,
                          );

                        return (
                          <div
                            key={`factor-${factorIndex}`}
                            className={`rounded-xl border ${
                              selected
                                ? "border-blue-300 bg-blue-50/40"
                                : "border-slate-200"
                            }`}
                          >
                            <div className="flex items-start gap-3 p-4">
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() =>
                                  toggleSelection(
                                    index,
                                  )
                                }
                                className="mt-1 h-4 w-4 rounded border-slate-300"
                              />

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-medium text-slate-900">
                                    Behavioural
                                    factor{" "}
                                    {factorIndex +
                                      1}
                                  </span>

                                  <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                                    Target level{" "}
                                    {
                                      factor.targetLevel
                                    }
                                  </span>

                                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                                    {Math.round(
                                      factor.confidence *
                                        100,
                                    )}
                                    % confidence
                                  </span>
                                </div>

                                <p className="mt-1 break-all text-xs text-slate-400">
                                  {
                                    factor.behaviouralFactorId
                                  }
                                </p>

                                {expanded && (
                                  <p className="mt-3 text-sm leading-6 text-slate-600">
                                    {
                                      factor.rationale
                                    }
                                  </p>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  toggleExpanded(
                                    index,
                                  )
                                }
                                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                              >
                                {expanded ? (
                                  <ChevronUp
                                    size={18}
                                  />
                                ) : (
                                  <ChevronDown
                                    size={18}
                                  />
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>
                </section>
              )}
            </div>
          )}

          {isInterviewQuestions(
            generation,
          ) && (
            <section>
              <div className="mb-3">
                <h3 className="font-semibold text-slate-900">
                  Interview Questions
                </h3>

                <p className="text-sm text-slate-500">
                  Select the questions that should
                  be approved.
                </p>
              </div>

              <div className="space-y-3">
                {questions.map(
                  (question, index) => {
                    const selected =
                      selectedIndexes.includes(
                        index,
                      );

                    const expanded =
                      expandedIndexes.includes(
                        index,
                      );

                    return (
                      <div
                        key={`question-${index}`}
                        className={`rounded-xl border ${
                          selected
                            ? "border-blue-300 bg-blue-50/40"
                            : "border-slate-200"
                        }`}
                      >
                        <div className="flex items-start gap-3 p-4">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() =>
                              toggleSelection(
                                index,
                              )
                            }
                            className="mt-1 h-4 w-4 rounded border-slate-300"
                          />

                          <div className="min-w-0 flex-1">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <span className="font-medium text-slate-900">
                                Question{" "}
                                {index + 1}
                              </span>

                              {question.type && (
                                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                                  {
                                    question.type
                                  }
                                </span>
                              )}

                              {question.difficulty && (
                                <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
                                  {
                                    question.difficulty
                                  }
                                </span>
                              )}

                              {question.level !==
                                undefined && (
                                <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                                  Level{" "}
                                  {
                                    question.level
                                  }
                                </span>
                              )}
                            </div>

                            <p className="text-sm leading-6 text-slate-800">
                              {
                                question.question
                              }
                            </p>

                            {expanded && (
                              <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
                                {question.scenario && (
                                  <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                      Scenario
                                    </p>

                                    <p className="mt-1 text-sm leading-6 text-slate-600">
                                      {
                                        question.scenario
                                      }
                                    </p>
                                  </div>
                                )}

                                {question.options &&
                                  question.options
                                    .length >
                                    0 && (
                                    <div>
                                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Options
                                      </p>

                                      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-600">
                                        {question.options.map(
                                          (
                                            option,
                                            optionIndex,
                                          ) => (
                                            <li
                                              key={
                                                optionIndex
                                              }
                                            >
                                              {
                                                option
                                              }
                                            </li>
                                          ),
                                        )}
                                      </ul>
                                    </div>
                                  )}

                                {question.explanation && (
                                  <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                      Explanation
                                    </p>

                                    <p className="mt-1 text-sm leading-6 text-slate-600">
                                      {
                                        question.explanation
                                      }
                                    </p>
                                  </div>
                                )}

                                {question.guidance && (
                                  <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                      Guidance
                                    </p>

                                    <p className="mt-1 text-sm leading-6 text-slate-600">
                                      {
                                        question.guidance
                                      }
                                    </p>
                                  </div>
                                )}

                                {question.skillId && (
                                  <p className="break-all text-xs text-slate-400">
                                    Skill ID:{" "}
                                    {
                                      question.skillId
                                    }
                                  </p>
                                )}

                                {question.behaviouralFactorId && (
                                  <p className="break-all text-xs text-slate-400">
                                    Behavioural
                                    factor ID:{" "}
                                    {
                                      question.behaviouralFactorId
                                    }
                                  </p>
                                )}
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              toggleExpanded(
                                index,
                              )
                            }
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                          >
                            {expanded ? (
                              <ChevronUp
                                size={18}
                              />
                            ) : (
                              <ChevronDown
                                size={18}
                              />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            </section>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={selectAll}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Select all
            </button>

            <button
              type="button"
              onClick={clearAll}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Clear selection
            </button>

            <span className="text-sm text-slate-500">
              {selectedIndexes.length} of{" "}
              {totalItems} selected
            </span>
          </div>

          {canReview && (
          <div className="mt-8 border-t border-slate-200 pt-6">
            <h3 className="font-semibold text-slate-900">
              Review decision
            </h3>

            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() =>
                  setDecision("APPROVE")
                }
                className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium ${
                  decision === "APPROVE"
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 text-slate-600"
                }`}
              >
                <Check size={16} />
                Approve selected
              </button>

              <button
                type="button"
                onClick={() =>
                  setDecision("REJECT")
                }
                className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium ${
                  decision === "REJECT"
                    ? "border-red-300 bg-red-50 text-red-700"
                    : "border-slate-200 text-slate-600"
                }`}
              >
                <X size={16} />
                Reject
              </button>
            </div>

            <textarea
              value={reviewNotes}
              onChange={(event) =>
                setReviewNotes(
                  event.target.value,
                )
              }
              rows={4}
              placeholder="Add review notes..."
              className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />

            {decision === "APPROVE" && (
              <label className="mt-4 flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={applyChanges}
                  onChange={(event) =>
                    setApplyChanges(
                      event.target.checked,
                    )
                  }
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                />

                <span>
                  <span className="block text-sm font-medium text-slate-800">
                    Apply approved items immediately
                  </span>

                  <span className="block text-sm text-slate-500">
                    {isRoleSkillMapping(
                      generation,
                    )
                      ? "Add the approved competency mappings to the role profile."
                      : "Add the approved questions to the assessment."}
                  </span>
                </span>
              </label>
            )}
          </div>
          )}

          {reviewMutation.isError && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              Unable to submit the AI review. Please
              check the generation status and try
              again.
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={
              reviewMutation.isPending
            }
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={
              reviewMutation.isPending
            }
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
              decision === "APPROVE"
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {reviewMutation.isPending
              ? "Submitting..."
              : decision === "APPROVE"
                ? "Approve selected"
                : "Reject generation"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AiReviewPage() {
  const queryClient =
    useQueryClient();

  const [page, setPage] =
    useState(1);

  const [
    selectedGenerationId,
    setSelectedGenerationId,
  ] = useState<string | null>(null);

  const [status, setStatus] =
    useState("");

  const [
    generationType,
    setGenerationType,
  ] = useState("");

  const query =
    useQuery({
      queryKey: [
        "ai-generations",
        page,
        status,
        generationType,
      ],

      queryFn: async () => {
        const response =
          await api.get(
            "/ai/generations",
            {
              params: {
                page,
                limit: 25,

                ...(status
                  ? { status }
                  : {}),

                ...(generationType
                  ? {
                      generationType,
                    }
                  : {}),
              },
            },
          );

        return extractGenerations(
          unwrap<
            AIGenerationsResponse |
              AIGeneration[]
          >(response),
        );
      },
    });

  const generations =
    query.data ?? [];

  const pendingCount =
    generations.filter(
      (generation) =>
        generation.status ===
        "PENDING_REVIEW",
    ).length;

  const approvedCount =
    generations.filter(
      (generation) =>
        generation.status ===
        "APPROVED",
    ).length;

  const rejectedCount =
    generations.filter(
      (generation) =>
        generation.status ===
        "REJECTED",
    ).length;

  const columns =
    useMemo<
      DataTableColumn<AIGeneration>[]
    >(
      () => [
        {
          key: "generationType",
          label: "Type",

          render: (generation) => (
            <div>
              <p className="font-medium text-slate-900">
                {formatGenerationType(
                  generation.generationType,
                )}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                {getOutputCountLabel(
                  generation,
                )}
              </p>
            </div>
          ),
        },

        {
          key: "target",
          label: "Target",

          render: (generation) => (
            <div>
              <p className="font-medium text-slate-800">
                {isRoleSkillMapping(
                  generation,
                )
                  ? getRoleProfileName(
                      generation,
                    )
                  : getAssessmentName(
                      generation,
                    )}
              </p>

              <p className="mt-1 max-w-xs text-xs text-slate-500">
                {getGenerationDescription(
                  generation,
                )}
              </p>
            </div>
          ),
        },

        {
          key: "model",
          label: "Model",

          render: (generation) => (
            <span className="text-sm text-slate-600">
              {generation.aiModel ||
                generation.model ||
                "—"}
            </span>
          ),
        },

        {
          key: "status",
          label: "Status",

          render: (generation) => (
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getStatusTone(
                generation.status,
              )}`}
            >
              {generation.status ||
                "UNKNOWN"}
            </span>
          ),
        },

        {
          key: "createdAt",
          label: "Created",

          render: (generation) => (
            <span className="text-sm text-slate-500">
              {formatDate(
                generation.createdAt,
              )}
            </span>
          ),
        },

        {
          key: "actions",
          label: "",

          render: (generation) => {
            const pending = isPendingReview(generation);

            return (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();

                  if (!pending) {
                    return;
                  }

                  setSelectedGenerationId(
                    generation._id,
                  );
                }}
                disabled={!pending}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                  pending
                    ? "border-slate-200 text-slate-700 hover:bg-slate-50"
                    : "cursor-default border-slate-100 text-slate-400"
                }`}
              >
                <Eye size={16} />
                {pending ? "Review" : "Reviewed"}
              </button>
            );
          },
        },
      ],
      [],
    );

  const selectedGeneration =
    generations.find(
      (generation) =>
        generation._id ===
        selectedGenerationId,
    ) ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Review"
        description="Review AI-generated role mappings and interview questions before applying them."
        actions={
          <button
            type="button"
            onClick={() =>
              query.refetch()
            }
            disabled={
              query.isFetching
            }
            className="btn-secondary inline-flex items-center gap-2"
          >
            <RefreshCw
              size={16}
              className={
                query.isFetching
                  ? "animate-spin"
                  : ""
              }
            />

            Refresh
          </button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">
            Pending review
          </p>

          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {pendingCount}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">
            Approved
          </p>

          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {approvedCount}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">
            Rejected
          </p>

          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {rejectedCount}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap gap-3">
          <select
            value={generationType}
            onChange={(event) => {
              setPage(1);
              setGenerationType(
                event.target.value,
              );
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400"
          >
            <option value="">
              All generation types
            </option>

            <option value="ROLE_SKILL_MAPPING">
              Role skill mapping
            </option>

            <option value="INTERVIEW_QUESTIONS">
              Interview questions
            </option>
          </select>

          <select
            value={status}
            onChange={(event) => {
              setPage(1);
              setStatus(
                event.target.value,
              );
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400"
          >
            <option value="">
              All statuses
            </option>

            <option value="PENDING_REVIEW">
              Pending review
            </option>

            <option value="APPROVED">
              Approved
            </option>

            <option value="REJECTED">
              Rejected
            </option>
          </select>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white">
        {query.isLoading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Loading AI generations...
          </div>
        ) : query.isError ? (
          <div className="p-8 text-center text-sm text-red-600">
            Unable to load AI generations.
          </div>
        ) : generations.length === 0 ? (
          <div className="p-8 text-center">
            <BrainCircuit
              size={32}
              className="mx-auto text-slate-300"
            />

            <p className="mt-3 font-medium text-slate-700">
              No AI generations found
            </p>

            <p className="mt-1 text-sm text-slate-500">
              AI-generated role mappings and
              interview questions will appear here
              when available.
            </p>
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={generations}
            rowKey={(generation) =>
              generation._id
            }
            empty={
              <div className="p-8 text-center text-sm text-slate-500">
                No AI generations found.
              </div>
            }
          />
        )}
      </div>

      {selectedGeneration && (
        <ReviewModal
          generation={
            selectedGeneration
          }
          onClose={() =>
            setSelectedGenerationId(
              null,
            )
          }
          onSuccess={() => {
            setSelectedGenerationId(
              null,
            );

            queryClient.invalidateQueries({
              queryKey: [
                "ai-generations",
              ],
            });
          }}
        />
      )}
    </div>
  );
}