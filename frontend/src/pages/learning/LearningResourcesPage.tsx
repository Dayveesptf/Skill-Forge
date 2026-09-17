import {
  useMemo,
  useState,
} from "react";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import type { LucideIcon } from "lucide-react";

import {
  BookOpen,
  ExternalLink,
  GraduationCap,
  Pencil,
  Plus,
  Search,
  Trash2,
  Video,
  FileText,
  Award,
  X,
} from "lucide-react";

import { api, errorMessage, unwrap } from "../../api";

import { useAuth } from "../../auth";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Loading,
  PageHeader,
  Section,
} from "../../components/ui";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type CompetencyType =
  | "SKILL"
  | "BEHAVIOURAL_FACTOR";

type ResourceType =
  | "COURSE"
  | "ARTICLE"
  | "VIDEO"
  | "DOCUMENT"
  | "CERTIFICATION"
  | "OTHER";

interface LearningResource {
  _id?: string;
  id?: string;

  organizationId?: string;

  competencyType: CompetencyType;

  competencyId: string;

  title: string;

  description?: string;

  url: string;

  provider?: string;

  resourceType: ResourceType;

  targetLevel: number;

  isActive: boolean;

  createdAt?: string;
  updatedAt?: string;
}

interface ResourceForm {
  competencyType: CompetencyType;
  competencyId: string;
  title: string;
  description: string;
  url: string;
  provider: string;
  resourceType: ResourceType;
  targetLevel: number;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const EMPTY_FORM: ResourceForm = {
  competencyType: "SKILL",
  competencyId: "",
  title: "",
  description: "",
  url: "",
  provider: "",
  resourceType: "COURSE",
  targetLevel: 1,
};

function getResourceId(
  resource: LearningResource,
): string {
  return (
    resource._id ??
    resource.id ??
    ""
  );
}

function formatType(
  value?: string,
): string {
  if (!value) {
    return "Other";
  }

  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) =>
      character.toUpperCase(),
    );
}

function getResourceIcon(
  type: ResourceType,
) {
  switch (type) {
    case "COURSE":
      return GraduationCap;

    case "VIDEO":
      return Video;

    case "DOCUMENT":
      return FileText;

    case "CERTIFICATION":
      return Award;

    default:
      return BookOpen;
  }
}

function getLevelTone(
  level: number,
): "slate" | "blue" | "green" | "amber" {
  if (level <= 3) {
    return "slate";
  }

  if (level <= 6) {
    return "blue";
  }

  if (level <= 8) {
    return "amber";
  }

  return "green";
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function LearningResourcesPage() {
  const { user, isAdmin } =
    useAuth();

  const queryClient =
    useQueryClient();

  const [search, setSearch] =
    useState("");

  const [typeFilter, setTypeFilter] =
    useState<
      "ALL" |
      CompetencyType
    >("ALL");

  const [showInactive, setShowInactive] =
    useState(false);

  const [formOpen, setFormOpen] =
    useState(false);

  const [editingResource, setEditingResource] =
    useState<LearningResource | null>(
      null,
    );

  const [form, setForm] =
    useState<ResourceForm>(
      EMPTY_FORM,
    );

  const [formError, setFormError] =
    useState("");

  const query = useQuery({
    queryKey: [
      "learning-resources",
      showInactive,
    ],

    queryFn: async () =>
      unwrap<LearningResource[]>(
        await api.get(
          "/learning-resources",
          {
            params: {
              includeInactive:
                showInactive,
            },
          },
        ),
      ),
  });

  const resources =
    query.data ?? [];

  const filteredResources =
    useMemo(() => {
      const term =
        search
          .trim()
          .toLowerCase();

      return resources.filter(
        (resource) => {
          if (
            typeFilter !==
              "ALL" &&
            resource.competencyType !==
              typeFilter
          ) {
            return false;
          }

          if (!term) {
            return true;
          }

          const searchable = [
            resource.title,
            resource.description,
            resource.provider,
            resource.competencyId,
            resource.resourceType,
            resource.competencyType,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return searchable.includes(
            term,
          );
        },
      );
    }, [
      resources,
      search,
      typeFilter,
    ]);

  const createMutation =
    useMutation({
      mutationFn: async (
        payload: ResourceForm,
      ) =>
        unwrap<LearningResource>(
          await api.post(
            "/learning-resources",
            payload,
          ),
        ),

      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: [
            "learning-resources",
          ],
        });

        closeForm();
      },

      onError: (error) => {
        setFormError(
          errorMessage(
            error,
            "Could not create learning resource.",
          ),
        );
      },
    });

  const updateMutation =
    useMutation({
      mutationFn: async ({
        id,
        payload,
      }: {
        id: string;
        payload: Partial<ResourceForm>;
      }) =>
        unwrap<LearningResource>(
          await api.patch(
            `/learning-resources/${id}`,
            payload,
          ),
        ),

      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: [
            "learning-resources",
          ],
        });

        closeForm();
      },

      onError: (error) => {
        setFormError(
          errorMessage(
            error,
            "Could not update learning resource.",
          ),
        );
      },
    });

  const deleteMutation =
    useMutation({
      mutationFn: async (
        id: string,
      ) =>
        unwrap(
          await api.delete(
            `/learning-resources/${id}`,
          ),
        ),

      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: [
            "learning-resources",
          ],
        });
      },
    });

  function openCreate() {
    setEditingResource(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(
    resource: LearningResource,
  ) {
    setEditingResource(resource);

    setForm({
      competencyType:
        resource.competencyType,

      competencyId:
        resource.competencyId,

      title:
        resource.title,

      description:
        resource.description ?? "",

      url:
        resource.url,

      provider:
        resource.provider ?? "",

      resourceType:
        resource.resourceType,

      targetLevel:
        resource.targetLevel,
    });

    setFormError("");
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingResource(null);
    setForm(EMPTY_FORM);
    setFormError("");
  }

  function updateField<
    K extends keyof ResourceForm
  >(
    key: K,
    value: ResourceForm[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function submitForm(
    event: React.FormEvent,
  ) {
    event.preventDefault();

    setFormError("");

    if (
      !form.competencyId.trim()
    ) {
      setFormError(
        "Competency ID is required.",
      );

      return;
    }

    if (!form.title.trim()) {
      setFormError(
        "Title is required.",
      );

      return;
    }

    if (!form.url.trim()) {
      setFormError(
        "URL is required.",
      );

      return;
    }

    if (
      editingResource
    ) {
      const id =
        getResourceId(
          editingResource,
        );

      updateMutation.mutate({
        id,

        payload: {
          title:
            form.title,

          description:
            form.description,

          url:
            form.url,

          provider:
            form.provider,

          resourceType:
            form.resourceType,

          targetLevel:
            Number(
              form.targetLevel,
            ),
        },
      });

      return;
    }

    createMutation.mutate({
      ...form,

      targetLevel:
        Number(
          form.targetLevel,
        ),
    });
  }

  function handleDelete(
    resource: LearningResource,
  ) {
    const id =
      getResourceId(resource);

    if (!id) {
      return;
    }

    const confirmed =
      window.confirm(
        `Deactivate "${resource.title}"?`,
      );

    if (!confirmed) {
      return;
    }

    deleteMutation.mutate(id);
  }

  const isSaving =
    createMutation.isPending ||
    updateMutation.isPending;

  const canManage =
    isAdmin &&
    (
      user?.role ===
        "ORGANIZATION_ADMIN" ||
      user?.role ===
        "PLATFORM_ADMIN"
    );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Development"
        title="Learning resources"
        description="Browse development resources mapped to the competencies used across SkillForge."
        actions={
          canManage ? (
            <Button
              onClick={openCreate}
            >
              <Plus size={16} />
              Add resource
            </Button>
          ) : undefined
        }
      />

      <ResourceOverview
        resources={resources}
      />

      <Card padding="lg">
        <Section
          title="Resource library"
          description="Resources are mapped to skills or behavioural factors and a target competency level."
        >
          <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
              />

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Search resources..."
                className="field pl-9"
              />
            </div>

            <select
              value={typeFilter}
              onChange={(event) =>
                setTypeFilter(
                  event.target
                    .value as
                    | "ALL"
                    | CompetencyType,
                )
              }
              className="field lg:w-52"
            >
              <option value="ALL">
                All competencies
              </option>

              <option value="SKILL">
                Skills
              </option>

              <option value="BEHAVIOURAL_FACTOR">
                Behavioural factors
              </option>
            </select>

            {canManage && (
              <label className="flex items-center gap-2 text-xs text-slate-500">
                <input
                  type="checkbox"
                  checked={
                    showInactive
                  }
                  onChange={(event) =>
                    setShowInactive(
                      event.target
                        .checked,
                    )
                  }
                />

                Show inactive
              </label>
            )}
          </div>

          {query.isLoading ? (
            <Loading
              label="Loading learning resources..."
            />
          ) : query.isError ? (
            <ErrorState
              title="Resources unavailable"
              text="We couldn't load the learning resource library."
              onRetry={() =>
                query.refetch()
              }
            />
          ) : filteredResources.length ===
            0 ? (
            <EmptyState
              title="No learning resources"
              text={
                search ||
                typeFilter !==
                  "ALL"
                  ? "No resources match the current filters."
                  : "No learning resources have been added yet."
              }
              action={
                canManage ? (
                  <Button
                    onClick={
                      openCreate
                    }
                  >
                    <Plus
                      size={15}
                    />
                    Add first resource
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredResources.map(
                (resource) => (
                  <ResourceCard
                    key={getResourceId(
                      resource,
                    )}
                    resource={
                      resource
                    }
                    canManage={
                      Boolean(
                        canManage,
                      )
                    }
                    onEdit={
                      openEdit
                    }
                    onDelete={
                      handleDelete
                    }
                  />
                ),
              )}
            </div>
          )}
        </Section>
      </Card>

      {formOpen && (
        <ResourceFormModal
          form={form}
          editing={
            Boolean(
              editingResource,
            )
          }
          error={formError}
          saving={isSaving}
          onChange={
            updateField
          }
          onClose={
            closeForm
          }
          onSubmit={
            submitForm
          }
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Overview                                                                   */
/* -------------------------------------------------------------------------- */

function ResourceOverview({
  resources,
}: {
  resources: LearningResource[];
}) {
  const active =
    resources.filter(
      (resource) =>
        resource.isActive,
    ).length;

  const skills =
    resources.filter(
      (resource) =>
        resource.competencyType ===
        "SKILL",
    ).length;

  const behavioural =
    resources.filter(
      (resource) =>
        resource.competencyType ===
        "BEHAVIOURAL_FACTOR",
    ).length;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <OverviewCard
        label="Resources"
        value={resources.length}
        icon={BookOpen}
      />

      <OverviewCard
        label="Active"
        value={active}
        icon={GraduationCap}
      />

      <OverviewCard
        label="Skills"
        value={skills}
        icon={TargetIcon}
      />

      <OverviewCard
        label="Behavioural"
        value={behavioural}
        icon={Award}
      />
    </div>
  );
}

function OverviewCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <div className="flex items-center gap-4">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500/10 text-brand-300">
          <Icon size={18} />
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {label}
          </p>

          <p className="mt-1 text-2xl font-bold text-white">
            {value}
          </p>
        </div>
      </div>
    </Card>
  );
}

/*
 * Small local icon alias so the overview remains
 * visually consistent without adding another
 * dependency.
 */
function TargetIcon(
  props: React.ComponentProps<
    typeof BookOpen
  >,
) {
  return (
    <BookOpen {...props} />
  );
}

/* -------------------------------------------------------------------------- */
/* Resource Card                                                              */
/* -------------------------------------------------------------------------- */

function ResourceCard({
  resource,
  canManage,
  onEdit,
  onDelete,
}: {
  resource: LearningResource;
  canManage: boolean;
  onEdit: (
    resource: LearningResource,
  ) => void;
  onDelete: (
    resource: LearningResource,
  ) => void;
}) {
  const Icon =
    getResourceIcon(
      resource.resourceType,
    );

  return (
    <article
      className={[
        "group rounded-2xl border bg-panel p-5 transition",
        resource.isActive
          ? "border-line hover:border-slate-600"
          : "border-red-500/20 opacity-70",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-300">
          <Icon size={19} />
        </div>

        <Badge
          tone={getLevelTone(
            resource.targetLevel,
          )}
        >
          Level{" "}
          {resource.targetLevel}
        </Badge>
      </div>

      <div className="mt-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>
            {formatType(
              resource.competencyType,
            )}
          </Badge>

          <Badge>
            {formatType(
              resource.resourceType,
            )}
          </Badge>

          {!resource.isActive && (
            <Badge tone="red">
              Inactive
            </Badge>
          )}
        </div>

        <h3 className="mt-4 text-base font-semibold text-white">
          {resource.title}
        </h3>

        {resource.provider && (
          <p className="mt-1 text-xs font-medium text-brand-300">
            {resource.provider}
          </p>
        )}

        {resource.description && (
          <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-500">
            {resource.description}
          </p>
        )}
      </div>

      <div className="mt-5 flex items-center gap-2 border-t border-line pt-4">
        <a
          href={resource.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-500/10 px-3 py-2.5 text-xs font-semibold text-brand-300 transition hover:bg-brand-500/20"
        >
          Open resource
          <ExternalLink
            size={14}
          />
        </a>

        {canManage && (
          <>
            <button
              type="button"
              onClick={() =>
                onEdit(resource)
              }
              className="grid h-10 w-10 place-items-center rounded-xl border border-line text-slate-500 transition hover:text-white"
              title="Edit resource"
            >
              <Pencil size={15} />
            </button>

            <button
              type="button"
              onClick={() =>
                onDelete(resource)
              }
              className="grid h-10 w-10 place-items-center rounded-xl border border-red-500/20 text-red-300 transition hover:bg-red-500/10"
              title="Deactivate resource"
            >
              <Trash2
                size={15}
              />
            </button>
          </>
        )}
      </div>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/* Modal                                                                      */
/* -------------------------------------------------------------------------- */

function ResourceFormModal({
  form,
  editing,
  error,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  form: ResourceForm;
  editing: boolean;
  error: string;
  saving: boolean;
  onChange: <
    K extends keyof ResourceForm
  >(
    key: K,
    value: ResourceForm[K],
  ) => void;
  onClose: () => void;
  onSubmit: (
    event: React.FormEvent,
  ) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-line bg-[#081422] shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-300">
              Development library
            </p>

            <h2 className="mt-1 text-lg font-semibold text-white">
              {editing
                ? "Edit learning resource"
                : "Add learning resource"}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-500 transition hover:bg-panel hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-5 p-6"
        >
          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold text-slate-400">
                Competency type
              </span>

              <select
                value={
                  form.competencyType
                }
                disabled={editing}
                onChange={(event) =>
                  onChange(
                    "competencyType",
                    event.target
                      .value as CompetencyType,
                  )
                }
                className="field"
              >
                <option value="SKILL">
                  Skill
                </option>

                <option value="BEHAVIOURAL_FACTOR">
                  Behavioural factor
                </option>
              </select>
            </label>

            <Input
              label="Competency ID"
              value={
                form.competencyId
              }
              disabled={editing}
              onChange={(event) =>
                onChange(
                  "competencyId",
                  event.target.value,
                )
              }
              placeholder="MongoDB ObjectId"
              hint="Use the ID of the skill or behavioural factor."
            />
          </div>

          <Input
            label="Title"
            value={form.title}
            onChange={(event) =>
              onChange(
                "title",
                event.target.value,
              )
            }
            placeholder="e.g. Advanced JavaScript Course"
          />

          <label className="block">
            <span className="mb-2 block text-xs font-semibold text-slate-400">
              Description
            </span>

            <textarea
              value={
                form.description
              }
              onChange={(event) =>
                onChange(
                  "description",
                  event.target.value,
                )
              }
              rows={4}
              className="field resize-none"
              placeholder="Explain what this resource helps the learner develop."
            />
          </label>

          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              label="Provider"
              value={
                form.provider
              }
              onChange={(event) =>
                onChange(
                  "provider",
                  event.target.value,
                )
              }
              placeholder="e.g. Coursera"
            />

            <label className="block">
              <span className="mb-2 block text-xs font-semibold text-slate-400">
                Resource type
              </span>

              <select
                value={
                  form.resourceType
                }
                onChange={(event) =>
                  onChange(
                    "resourceType",
                    event.target
                      .value as ResourceType,
                  )
                }
                className="field"
              >
                <option value="COURSE">
                  Course
                </option>

                <option value="ARTICLE">
                  Article
                </option>

                <option value="VIDEO">
                  Video
                </option>

                <option value="DOCUMENT">
                  Document
                </option>

                <option value="CERTIFICATION">
                  Certification
                </option>

                <option value="OTHER">
                  Other
                </option>
              </select>
            </label>
          </div>

          <Input
            label="Resource URL"
            type="url"
            value={form.url}
            onChange={(event) =>
              onChange(
                "url",
                event.target.value,
              )
            }
            placeholder="https://..."
          />

          <label className="block">
            <span className="mb-2 block text-xs font-semibold text-slate-400">
              Target level
            </span>

            <select
              value={
                form.targetLevel
              }
              onChange={(event) =>
                onChange(
                  "targetLevel",
                  Number(
                    event.target.value,
                  ),
                )
              }
              className="field"
            >
              {Array.from(
                { length: 10 },
                (_, index) =>
                  index + 1,
              ).map((level) => (
                <option
                  key={level}
                  value={level}
                >
                  Level {level}
                </option>
              ))}
            </select>

            <span className="mt-1.5 block text-xs text-slate-600">
              The competency level this resource is intended to support.
            </span>
          </label>

          <div className="flex justify-end gap-3 border-t border-line pt-5">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : editing
                  ? "Save changes"
                  : "Create resource"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}