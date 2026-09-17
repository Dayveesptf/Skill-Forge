import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Clock3,
  Edit3,
  Layers3,
  Plus,
  Send,
  type LucideIcon,
} from "lucide-react";

import { api, unwrap } from "../../api";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  Section,
} from "../../components/ui";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

interface AssessmentSection {
  _id?: string;
  id?: string;
  title?: string;
  description?: string;
}

interface AssessmentQuestion {
  _id?: string;
  id?: string;
  sectionId?: string;
  question?: string;
  type?: string;
  difficulty?: string;
  weight?: number;
}

interface Assessment {
  _id?: string;
  id?: string;
  title?: string;
  description?: string;
  status?: string;
  type?: string;
  durationMinutes?: number;
  passingScore?: number;
  maxAttempts?: number;
  randomizeQuestions?: boolean;
  sections?: AssessmentSection[];
  questions?: AssessmentQuestion[];
}

interface AssessmentResponse extends Assessment {
  data?: Assessment;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function normalizeAssessment(
  response: AssessmentResponse,
): Assessment {
  if (
    response.data &&
    typeof response.data === "object"
  ) {
    return {
      ...response.data,
      ...response,
    };
  }

  return response;
}

function getQuestionCountForSection(
  questions: AssessmentQuestion[],
  sectionId?: string,
): number {
  if (!sectionId) {
    return 0;
  }

  return questions.filter(
    (question) =>
      String(question.sectionId) ===
      String(sectionId),
  ).length;
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function AssessmentDetailPage() {
  const { id } = useParams<{ id: string }>();

  const query = useQuery<AssessmentResponse>({
    queryKey: ["assessment", id],
    queryFn: async () =>
      unwrap<AssessmentResponse>(
        await api.get(`/assessments/${id}`),
      ),
    enabled: Boolean(id),
  });

  if (query.isLoading) {
    return (
      <Loading label="Loading assessment..." />
    );
  }

  if (query.isError || !query.data) {
    return (
      <ErrorState
        title="Assessment unavailable"
        text="The assessment could not be loaded."
        onRetry={() => void query.refetch()}
      />
    );
  }

  const assessment = normalizeAssessment(
    query.data,
  );

  const sections =
    assessment.sections ?? [];

  const questions =
    assessment.questions ?? [];

  const assessmentId =
    assessment._id || assessment.id || id;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Assessment detail"
        title={assessment.title || "Assessment"}
        description={
          assessment.description ||
          "Configure assessment structure, questions and publishing."
        }
        actions={
          <AssessmentActions
            assessmentId={assessmentId}
          />
        }
      />

      <AssessmentMetrics
        sections={sections.length}
        questions={questions.length}
        durationMinutes={
          assessment.durationMinutes
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <AssessmentStructure
          sections={sections}
          questions={questions}
        />

        <AssessmentConfiguration
          assessment={assessment}
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Actions                                                                    */
/* -------------------------------------------------------------------------- */

function AssessmentActions({
  assessmentId,
}: {
  assessmentId?: string;
}) {
  return (
    <>
      <Link
        to="/assessments"
        className="btn-secondary"
      >
        <ArrowLeft size={16} />
        Back
      </Link>

      {assessmentId && (
        <Link
          to={`/assessments/${assessmentId}/edit`}
          className="btn-secondary"
        >
          <Edit3 size={16} />
          Edit
        </Link>
      )}

      <Button type="button">
        <Send size={16} />
        Publish
      </Button>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Metrics                                                                    */
/* -------------------------------------------------------------------------- */

function AssessmentMetrics({
  sections,
  questions,
  durationMinutes,
}: {
  sections: number;
  questions: number;
  durationMinutes?: number;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Mini
        icon={Layers3}
        label="Sections"
        value={sections}
      />

      <Mini
        icon={Plus}
        label="Questions"
        value={questions}
      />

      <Mini
        icon={Clock3}
        label="Duration"
        value={
          durationMinutes
            ? `${durationMinutes} min`
            : "Not set"
        }
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Mini Metric                                                                */
/* -------------------------------------------------------------------------- */

function Mini({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500/10 text-brand-300">
          <Icon size={16} />
        </div>

        <div>
          <p className="text-xs text-slate-600">
            {label}
          </p>

          <p className="mt-1 font-semibold text-white">
            {value}
          </p>
        </div>
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Assessment Structure                                                       */
/* -------------------------------------------------------------------------- */

function AssessmentStructure({
  sections,
  questions,
}: {
  sections: AssessmentSection[];
  questions: AssessmentQuestion[];
}) {
  return (
    <Card className="p-6">
      <Section
        title="Assessment structure"
        description="Sections and questions in delivery order."
      >
        <div className="space-y-3">
          {sections.length > 0 ? (
            sections.map((section, index) => (
              <SectionRow
                key={section._id || section.id || index}
                section={section}
                index={index}
                questionCount={getQuestionCountForSection(
                  questions,
                  section._id || section.id,
                )}
              />
            ))
          ) : (
            <EmptyState
              title="No sections yet"
              text="Add sections and then build the question set."
              action={
                <Button type="button">
                  <Plus size={16} />
                  Add section
                </Button>
              }
            />
          )}
        </div>
      </Section>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Section Row                                                                */
/* -------------------------------------------------------------------------- */

function SectionRow({
  section,
  index,
  questionCount,
}: {
  section: AssessmentSection;
  index: number;
  questionCount: number;
}) {
  return (
    <div className="rounded-xl border border-line p-4 transition hover:bg-panel2">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-semibold text-white">
            {index + 1}.{" "}
            {section.title || "Untitled section"}
          </p>

          <p className="mt-1 text-xs text-slate-600">
            {section.description ||
              "No section description."}
          </p>
        </div>

        <Badge>
          {questionCount}{" "}
          {questionCount === 1
            ? "question"
            : "questions"}
        </Badge>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Configuration                                                              */
/* -------------------------------------------------------------------------- */

function AssessmentConfiguration({
  assessment,
}: {
  assessment: Assessment;
}) {
  const configuration = [
    {
      label: "Status",
      value: assessment.status || "DRAFT",
    },
    {
      label: "Type",
      value: assessment.type || "MIXED",
    },
    {
      label: "Passing score",
      value:
        assessment.passingScore !== undefined
          ? `${assessment.passingScore}%`
          : "Not set",
    },
    {
      label: "Max attempts",
      value:
        assessment.maxAttempts ??
        "—",
    },
    {
      label: "Randomize questions",
      value: assessment.randomizeQuestions
        ? "Yes"
        : "No",
    },
  ];

  return (
    <Card className="p-6">
      <Section title="Configuration">
        <div className="space-y-3">
          {configuration.map((item) => (
            <div
              key={item.label}
              className="flex justify-between gap-4 border-b border-line pb-3 last:border-b-0"
            >
              <span className="text-sm text-slate-600">
                {item.label}
              </span>

              <span className="text-right text-sm font-medium text-slate-200">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </Section>
    </Card>
  );
}