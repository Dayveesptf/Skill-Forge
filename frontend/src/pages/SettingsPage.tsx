import { LockKeyhole, UserCircle2 } from "lucide-react";
import { useAuth } from "../auth";
import {
  Badge,
  Card,
  PageHeader,
  Section,
} from "../components/ui";

function formatRole(role?: string) {
  if (!role) {
    return "Not assigned";
  }

  return role
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

interface ProfileSectionProps {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
}

function ProfileSection({
  firstName,
  lastName,
  email,
  role,
}: ProfileSectionProps) {
  const fullName =
    [firstName, lastName].filter(Boolean).join(" ") || "User";

  return (
    <Card className="p-6">
      <Section title="Profile">
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand-500/10 text-brand-300">
            <UserCircle2 size={28} />
          </div>

          <div className="min-w-0">
            <p className="text-lg font-semibold text-white">
              {fullName}
            </p>

            <p className="mt-1 truncate text-sm text-slate-600">
              {email || "No email address"}
            </p>
          </div>
        </div>

        <div className="mt-6 border-t border-line pt-5">
          <p className="label">Access level</p>

          <div className="mt-2">
            <Badge tone="blue">{formatRole(role)}</Badge>
          </div>
        </div>
      </Section>
    </Card>
  );
}

function SecuritySection() {
  return (
    <Card className="p-6">
      <Section title="Security">
        <div className="flex gap-3">
          <LockKeyhole
            className="mt-0.5 shrink-0 text-brand-300"
            size={19}
          />

          <div>
            <p className="font-medium text-white">
              Protected workspace
            </p>

            <p className="mt-1 text-sm leading-6 text-slate-600">
              Authentication, authorization and organization isolation are
              enforced by the SkillForge backend.
            </p>
          </div>
        </div>
      </Section>
    </Card>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Review your profile, role and security context."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <ProfileSection
          firstName={user?.firstName}
          lastName={user?.lastName}
          email={user?.email}
          role={user?.role}
        />

        <SecuritySection />
      </div>
    </>
  );
}