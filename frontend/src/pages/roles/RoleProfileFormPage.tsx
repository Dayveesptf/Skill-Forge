import {
  type FormEvent,
  useEffect,
  useState,
} from "react";
import {
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  Plus,
  Save,
  Trash2,
} from "lucide-react";

import {
  api,
  errorMessage,
  unwrap,
} from "../../api";
import {
  Button,
  Card,
  ErrorState,
  PageHeader,
  Section,
  SuccessMessage,
} from "../../components/ui";

type RoleProfileStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "ARCHIVED";

type CompetencyType =
  | "skill"
  | "factor";

interface RoleProfileForm {
  name: string;
  slug: string;
  description: string;
  frameworkVersionId: string;
  status: RoleProfileStatus;
}

interface SkillCompetency {
  skillId: string;
  targetLevel: number;
  weight: number;
}

interface BehaviouralCompetency {
  behaviouralFactorId: string;
  targetLevel: number;
  weight: number;
}

interface RoleProfileResponse {
  _id?: string;
  id?: string;
  name?: string;
  slug?: string;
  description?: string;
  frameworkVersionId?:
    | string
    | {
        _id?: string;
        id?: string;
      };
  status?: RoleProfileStatus;
  skills?: SkillCompetency[];
  behaviouralFactors?: BehaviouralCompetency[];
}

const INITIAL_FORM: RoleProfileForm = {
  name: "",
  slug: "",
  description: "",
  frameworkVersionId: "",
  status: "DRAFT",
};

const STATUS_OPTIONS: RoleProfileStatus[] = [
  "DRAFT",
  "PUBLISHED",
  "ARCHIVED",
];

function getFrameworkId(
  framework:
    | RoleProfileResponse["frameworkVersionId"]
    | undefined,
): string {
  if (!framework) {
    return "";
  }

  if (typeof framework === "string") {
    return framework;
  }

  return (
    framework._id ??
    framework.id ??
    ""
  );
}

function getRoleProfileId(
  response: RoleProfileResponse,
): string {
  return response._id ?? response.id ?? "";
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  textarea?: boolean;
  required?: boolean;
  placeholder?: string;
}

function Field({
  label,
  value,
  onChange,
  textarea = false,
  required = false,
  placeholder,
}: FieldProps) {
  return (
    <label className="block">
      <span className="label">
        {label}
      </span>

      {textarea ? (
        <textarea
          className="field resize-y"
          rows={5}
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
          required={required}
          placeholder={placeholder}
        />
      ) : (
        <input
          className="field"
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
          required={required}
          placeholder={placeholder}
        />
      )}
    </label>
  );
}

interface CompetencyProps {
  title: string;
  type: CompetencyType;
  item:
    | SkillCompetency
    | BehaviouralCompetency;
  onChange: (
    field: string,
    value: string | number,
  ) => void;
  onRemove: () => void;
}

function Competency({
  title,
  type,
  item,
  onChange,
  onRemove,
}: CompetencyProps) {
  const isSkill = type === "skill";

  const idKey = isSkill
    ? "skillId"
    : "behaviouralFactorId";

  const identifier = isSkill
    ? (item as SkillCompetency).skillId
    : (item as BehaviouralCompetency)
        .behaviouralFactorId;

  return (
    <div className="rounded-xl border border-line bg-ink/40 p-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-semibold text-white">
          {title}
        </p>

        <button
          type="button"
          aria-label={`Remove ${title}`}
          className="text-slate-600 transition hover:text-red-300"
          onClick={onRemove}
        >
          <Trash2 size={15} />
        </button>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_120px_100px]">
        <label>
          <span className="label">
            {isSkill
              ? "Skill ID"
              : "Factor ID"}
          </span>

          <input
            className="field"
            value={identifier}
            onChange={(event) =>
              onChange(
                idKey,
                event.target.value,
              )
            }
            required
          />
        </label>

        <label>
          <span className="label">
            Target level
          </span>

          <input
            className="field"
            type="number"
            min="1"
            max="10"
            value={item.targetLevel}
            onChange={(event) =>
              onChange(
                "targetLevel",
                Number(event.target.value),
              )
            }
          />
        </label>

        <label>
          <span className="label">
            Weight
          </span>

          <input
            className="field"
            type="number"
            min="0"
            step="0.1"
            value={item.weight}
            onChange={(event) =>
              onChange(
                "weight",
                Number(event.target.value),
              )
            }
          />
        </label>
      </div>
    </div>
  );
}

export default function RoleProfileFormPage() {
  const { id } = useParams<{
    id: string;
  }>();

  const navigate = useNavigate();

  const [form, setForm] =
    useState<RoleProfileForm>(
      INITIAL_FORM,
    );

  const [skills, setSkills] =
    useState<SkillCompetency[]>([]);

  const [factors, setFactors] =
    useState<BehaviouralCompetency[]>(
      [],
    );

  const [error, setError] =
    useState("");

  const [saved, setSaved] =
    useState(false);

  const [busy, setBusy] =
    useState(false);

  useEffect(() => {
    if (!id) {
      return;
    }

    let mounted = true;

    async function loadRoleProfile() {
      try {
        const response = await api.get(
          `/role-profiles/${id}`,
        );

        const data =
          unwrap<RoleProfileResponse>(
            response,
          );

        if (!mounted) {
          return;
        }

        setForm({
          name: data.name ?? "",
          slug: data.slug ?? "",
          description:
            data.description ?? "",
          frameworkVersionId:
            getFrameworkId(
              data.frameworkVersionId,
            ),
          status:
            data.status ?? "DRAFT",
        });

        setSkills(
          data.skills ?? [],
        );

        setFactors(
          data.behaviouralFactors ?? [],
        );
      } catch (err) {
        if (mounted) {
          setError(
            errorMessage(
              err,
              "Could not load the role profile.",
            ),
          );
        }
      }
    }

    void loadRoleProfile();

    return () => {
      mounted = false;
    };
  }, [id]);

  function updateForm(
    field: keyof RoleProfileForm,
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function addCompetency(
    type: CompetencyType,
  ) {
    if (type === "skill") {
      setSkills((current) => [
        ...current,
        {
          skillId: "",
          targetLevel: 1,
          weight: 1,
        },
      ]);

      return;
    }

    setFactors((current) => [
      ...current,
      {
        behaviouralFactorId: "",
        targetLevel: 1,
        weight: 1,
      },
    ]);
  }

  function updateSkill(
    index: number,
    field: string,
    value: string | number,
  ) {
    setSkills((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [field]: value,
            }
          : item,
      ),
    );
  }

  function updateFactor(
    index: number,
    field: string,
    value: string | number,
  ) {
    setFactors((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [field]: value,
            }
          : item,
      ),
    );
  }

  function removeSkill(
    index: number,
  ) {
    setSkills((current) =>
      current.filter(
        (_, itemIndex) =>
          itemIndex !== index,
      ),
    );
  }

  function removeFactor(
    index: number,
  ) {
    setFactors((current) =>
      current.filter(
        (_, itemIndex) =>
          itemIndex !== index,
      ),
    );
  }

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");
    setSaved(false);

    if (!form.name.trim()) {
      setError(
        "Role name is required.",
      );
      return;
    }

    if (!form.frameworkVersionId.trim()) {
      setError(
        "Framework version ID is required.",
      );
      return;
    }

    setBusy(true);

    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        slug: form.slug.trim(),
        description:
          form.description.trim(),
        frameworkVersionId:
          form.frameworkVersionId.trim(),
        skills,
        behaviouralFactors:
          factors,
      };

      const response = id
        ? await api.put(
            `/role-profiles/${id}`,
            payload,
          )
        : await api.post(
            "/role-profiles",
            payload,
          );

      const data =
        unwrap<RoleProfileResponse>(
          response,
        );

      setSaved(true);

      if (!id) {
        const roleProfileId =
          getRoleProfileId(data);

        if (roleProfileId) {
          navigate(
            `/role-profiles/${roleProfileId}`,
            { replace: true },
          );
        }
      }
    } catch (err) {
      setError(
        errorMessage(
          err,
          "Could not save the role profile.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Capability architecture"
        title={
          id
            ? "Edit role profile"
            : "Create role profile"
        }
        description="Define the target competency profile that assessments and gap analysis will use."
      />

      <form onSubmit={submit}>
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Card className="p-6">
            <Section
              title="Role information"
              description="Set the identity and framework used by this role profile."
            >
              <div className="space-y-5">
                <Field
                  label="Role name"
                  value={form.name}
                  onChange={(value) =>
                    updateForm(
                      "name",
                      value,
                    )
                  }
                  required
                />

                <Field
                  label="Slug"
                  value={form.slug}
                  onChange={(value) =>
                    updateForm(
                      "slug",
                      value,
                    )
                  }
                  placeholder="e.g. frontend-engineer"
                />

                <Field
                  label="Description"
                  value={form.description}
                  onChange={(value) =>
                    updateForm(
                      "description",
                      value,
                    )
                  }
                  textarea
                />

                <Field
                  label="Framework version ID"
                  value={
                    form.frameworkVersionId
                  }
                  onChange={(value) =>
                    updateForm(
                      "frameworkVersionId",
                      value,
                    )
                  }
                  required
                />

                <label className="block">
                  <span className="label">
                    Status
                  </span>

                  <select
                    className="field"
                    value={form.status}
                    onChange={(event) =>
                      updateForm(
                        "status",
                        event.target.value,
                      )
                    }
                  >
                    {STATUS_OPTIONS.map(
                      (status) => (
                        <option
                          key={status}
                          value={status}
                        >
                          {status}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              </div>
            </Section>
          </Card>

          <Card className="p-6">
            <Section
              title="Competency model"
              description="Each competency can have a target level and weight."
              actions={
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      addCompetency(
                        "factor",
                      )
                    }
                  >
                    <Plus size={14} />
                    Behaviour
                  </Button>

                  <Button
                    type="button"
                    onClick={() =>
                      addCompetency(
                        "skill",
                      )
                    }
                  >
                    <Plus size={14} />
                    Skill
                  </Button>
                </div>
              }
            >
              <div className="mt-5 space-y-5">
                {skills.map(
                  (skill, index) => (
                    <Competency
                      key={`skill-${index}`}
                      title={`Skill ${index + 1}`}
                      type="skill"
                      item={skill}
                      onChange={(
                        field,
                        value,
                      ) =>
                        updateSkill(
                          index,
                          field,
                          value,
                        )
                      }
                      onRemove={() =>
                        removeSkill(
                          index,
                        )
                      }
                    />
                  ),
                )}

                {factors.map(
                  (factor, index) => (
                    <Competency
                      key={`factor-${index}`}
                      title={`Behavioural factor ${
                        index + 1
                      }`}
                      type="factor"
                      item={factor}
                      onChange={(
                        field,
                        value,
                      ) =>
                        updateFactor(
                          index,
                          field,
                          value,
                        )
                      }
                      onRemove={() =>
                        removeFactor(
                          index,
                        )
                      }
                    />
                  ),
                )}

                {!skills.length &&
                  !factors.length && (
                    <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-slate-600">
                      Add skills or behavioural
                      factors to build the role
                      competency model.
                    </p>
                  )}
              </div>
            </Section>
          </Card>
        </div>

        {error && (
          <div className="mt-6">
            <ErrorState text={error} />
          </div>
        )}

        {saved && (
          <div className="mt-6">
            <SuccessMessage text="Role profile saved successfully." />
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              navigate("/role-profiles")
            }
          >
            Cancel
          </Button>

          <Button
            type="submit"
            disabled={busy}
          >
            <Save size={16} />

            {busy
              ? "Saving..."
              : "Save role profile"}
          </Button>
        </div>
      </form>
    </>
  );
}