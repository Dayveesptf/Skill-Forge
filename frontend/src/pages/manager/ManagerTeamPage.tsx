import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BriefcaseBusiness,
  Mail,
  Users
} from "lucide-react";

import {
  api,
  errorMessage,
  unwrap
} from "../../api";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Loading,
  PageHeader
} from "../../components/ui";

interface TeamMember {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle?: string;
  department?: string;
  managerId?: string;
  isActive: boolean;
  createdAt?: string;
}

function memberName(
  member: TeamMember
) {
  const name =
    `${member.firstName ?? ""} ${member.lastName ?? ""}`
      .trim();

  return (
    name ||
    member.email ||
    "Staff member"
  );
}

export default function ManagerTeamPage() {
  const navigate =
    useNavigate();

  const query =
    useQuery({
      queryKey: [
        "manager",
        "team"
      ],

      queryFn: async () =>
        unwrap<TeamMember[]>(
          await api.get(
            "/users/my-team"
          )
        )
    });

  const team =
    query.data ?? [];

  const departments =
    useMemo(() => {
      return new Set(
        team
          .map(
            (member) =>
              member.department?.trim()
          )
          .filter(Boolean)
      ).size;
    }, [team]);

  if (query.isLoading) {
    return <Loading />;
  }

  if (query.isError) {
    return (
      <ErrorState
        text={errorMessage(
          query.error,
          "Could not load your team."
        )}
        onRetry={() =>
          query.refetch()
        }
      />
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Manager"
        title="My Team"
        description="View the staff members assigned to you and open their performance reports."
      />

      <div className="space-y-6">
        {/* ---------------------------------------------------------------- */}
        {/* Summary                                                          */}
        {/* ---------------------------------------------------------------- */}

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-brand-500/10 p-3">
                <Users
                  size={20}
                  className="text-brand-300"
                />
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-slate-600">
                  Team members
                </p>

                <p className="mt-1 text-2xl font-bold text-white">
                  {team.length}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-blue-500/10 p-3">
                <BriefcaseBusiness
                  size={20}
                  className="text-blue-300"
                />
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-slate-600">
                  Departments
                </p>

                <p className="mt-1 text-2xl font-bold text-white">
                  {departments}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-emerald-500/10 p-3">
                <Users
                  size={20}
                  className="text-emerald-300"
                />
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-slate-600">
                  Active staff
                </p>

                <p className="mt-1 text-2xl font-bold text-white">
                  {team.filter(
                    (member) =>
                      member.isActive
                  ).length}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Team list                                                        */}
        {/* ---------------------------------------------------------------- */}

        {team.length === 0 ? (
          <Card>
            <EmptyState
              title="No staff assigned yet"
              text="Staff members assigned to you will appear here."
            />
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {team.map(
              (member) => (
                <Card
                  key={member._id}
                >
                  <div className="flex flex-col gap-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-sm font-bold text-brand-300">
                          {member.firstName?.[0]?.toUpperCase() ??
                            "?"}
                          {member.lastName?.[0]?.toUpperCase() ??
                            ""}
                        </div>

                        <div className="min-w-0">
                          <h2 className="truncate text-lg font-semibold text-white">
                            {memberName(
                              member
                            )}
                          </h2>

                          <p className="mt-1 truncate text-sm text-slate-500">
                            {member.jobTitle ??
                              "Staff member"}
                          </p>
                        </div>
                      </div>

                      <Badge tone="green">
                        Active
                      </Badge>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Mail
                          size={15}
                        />

                        <span className="truncate">
                          {member.email}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <BriefcaseBusiness
                          size={15}
                        />

                        <span>
                          {member.department ??
                            "No department"}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 border-t border-line pt-4">
                      <Button
                        onClick={() =>
                          navigate(
                            `/reports?candidateId=${member._id}`
                          )
                        }
                      >
                        View report
                        <ArrowRight
                          size={16}
                        />
                      </Button>

                      <Button
                        variant="secondary"
                        onClick={() =>
                          navigate(
                            `/manager-corroborations`
                          )
                        }
                      >
                        Corroborations
                      </Button>
                    </div>
                  </div>
                </Card>
              )
            )}
          </div>
        )}
      </div>
    </>
  );
}