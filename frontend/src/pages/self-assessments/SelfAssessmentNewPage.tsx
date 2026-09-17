import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ClipboardCheck } from "lucide-react";

import {
  api,
  errorMessage,
  unwrap,
} from "../../api";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
} from "../../components/ui";

interface RoleProfile {
  _id: string;
  name?: string;
  title?: string;
  description?: string;
  status?: string;
}

export default function SelfAssessmentNewPage() {
  const navigate = useNavigate();

  const [selectedRoleProfile, setSelectedRoleProfile] =
    useState("");

  const query = useQuery({
    queryKey: [
      "staff",
      "published-role-profiles",
    ],
    queryFn: async () => {
      const response =
        await api.get(
          "/role-profiles?status=PUBLISHED"
        );

      return unwrap<any>(response);
    },
  });

  const profiles: RoleProfile[] =
    useMemo(() => {
      const data = query.data;

      if (Array.isArray(data)) {
        return data;
      }

      return (
        data?.roleProfiles ??
        data?.items ??
        data?.data ??
        []
      );
    }, [query.data]);

  const createMutation =
    useMutation({
      mutationFn: async (
        roleProfileId: string
      ) => {
        const response =
          await api.post(
            `/self-assessments/role-profiles/${roleProfileId}`
          );

        return unwrap<any>(
          response
        );
      },
      onSuccess: (assessment) => {
        const id =
          assessment?._id ??
          assessment?.id ??
          assessment?.selfAssessment?._id ??
          assessment?.selfAssessment?.id;

        if (id) {
          navigate(
            `/self-assessments/${id}`
          );
        }
      },
    });

  function handleCreate() {
    if (!selectedRoleProfile) {
      return;
    }

    createMutation.mutate(
      selectedRoleProfile
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Self assessment"
        title="Start a self-assessment"
        description="Choose a published role profile to begin rating your current skills and providing supporting evidence."
        actions={
          <Button
            variant="secondary"
            onClick={() =>
              navigate(
                "/self-assessments"
              )
            }
          >
            <ArrowLeft size={16} />
            Back
          </Button>
        }
      />

      {query.isLoading ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState
          text={errorMessage(
            query.error,
            "Could not load published role profiles."
          )}
          onRetry={() =>
            query.refetch()
          }
        />
      ) : profiles.length === 0 ? (
        <EmptyState
          title="No published role profiles"
          text="There are currently no published role profiles available for a self-assessment."
        />
      ) : (
        <div className="max-w-4xl space-y-6">
          <Card>
            <div className="flex items-start gap-4">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-300">
                <ClipboardCheck
                  size={20}
                />
              </div>

              <div>
                <h2 className="text-lg font-semibold text-white">
                  Select your role profile
                </h2>

                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Your assessment will use the
                  competencies and target levels
                  defined by the published role
                  profile.
                </p>
              </div>
            </div>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            {profiles.map(
              (profile) => {
                const id =
                  profile._id;

                const selected =
                  selectedRoleProfile ===
                  id;

                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() =>
                      setSelectedRoleProfile(
                        id
                      )
                    }
                    className={[
                      "rounded-2xl border p-5 text-left transition",
                      selected
                        ? "border-brand-400 bg-brand-500/10"
                        : "border-line bg-panel hover:border-slate-600",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-white">
                          {profile.name ??
                            profile.title ??
                            "Untitled role profile"}
                        </h3>

                        <p className="mt-2 text-sm leading-6 text-slate-500">
                          {profile.description ??
                            "Published role profile"}
                        </p>
                      </div>

                      <Badge tone="green">
                        PUBLISHED
                      </Badge>
                    </div>
                  </button>
                );
              }
            )}
          </div>

          <div className="flex justify-end">
            <Button
              onClick={
                handleCreate
              }
              disabled={
                !selectedRoleProfile ||
                createMutation.isPending
              }
            >
              {createMutation.isPending
                ? "Creating..."
                : "Start assessment"}
            </Button>
          </div>

          {createMutation.isError && (
            <p className="text-sm text-red-400">
              {errorMessage(
                createMutation.error,
                "Could not create the self-assessment."
              )}
            </p>
          )}
        </div>
      )}
    </>
  );
}