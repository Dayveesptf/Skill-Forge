import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link2, LockKeyhole, ShieldCheck } from "lucide-react";
import {
  Link,
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import { api, errorMessage, unwrap } from "../../api";
import {
  AuthShell,
} from "../../layouts/AppLayout";
import {
  Button,
  Card,
  Input,
  SuccessMessage,
} from "../../components/ui";

export default function AcceptInvitationPage() {
  const [searchParams] =
    useSearchParams();
  const navigate = useNavigate();

  const token =
    searchParams.get("token") ?? "";

  const [password, setPassword] =
    useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");
  const [formError, setFormError] =
    useState("");

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(
        "/invitations/accept",
        {
          token,
          password,
        },
      );

      return unwrap<{
        id: string;
        email: string;
        role: string;
      }>(response);
    },
    onSuccess: () => {
      setFormError("");
    },
    onError: (error) => {
      setFormError(
        errorMessage(
          error,
          "Unable to accept this invitation.",
        ),
      );
    },
  });

  function submit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setFormError("");

    if (!token) {
      setFormError(
        "This invitation link is missing its invitation token.",
      );
      return;
    }

    if (password.length < 8) {
      setFormError(
        "Password must contain at least 8 characters.",
      );
      return;
    }

    if (password !== confirmPassword) {
      setFormError(
        "Passwords do not match.",
      );
      return;
    }

    acceptMutation.mutate();
  }

  if (acceptMutation.isSuccess) {
    return (
      <AuthShell>
        <div className="mx-auto flex min-h-[calc(100vh-81px)] max-w-lg items-center px-5 py-12">
          <Card className="w-full">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-300">
              <ShieldCheck size={24} />
            </div>

            <h1 className="mt-5 text-center text-2xl font-bold text-white">
              Invitation accepted
            </h1>

            <p className="mt-2 text-center text-sm leading-6 text-slate-500">
              Your SkillForge account has been created successfully. You can now sign in with the invited email address and your new password.
            </p>

            <div className="mt-6">
              <SuccessMessage
                text="Your account is ready."
              />
            </div>

            <Button
              className="mt-5 w-full"
              onClick={() =>
                navigate("/login", {
                  replace: true,
                })
              }
            >
              Continue to sign in
            </Button>
          </Card>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="mx-auto flex min-h-[calc(100vh-81px)] max-w-lg items-center px-5 py-12">
        <Card className="w-full">
          <div className="flex items-center justify-center">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-500/10 text-brand-300">
              <Link2 size={23} />
            </div>
          </div>

          <h1 className="mt-5 text-center text-2xl font-bold text-white">
            Accept your invitation
          </h1>

          <p className="mt-2 text-center text-sm leading-6 text-slate-500">
            Set a password to activate the SkillForge account associated with this invitation.
          </p>

          {!token && (
            <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
              This page requires a valid invitation link.
            </div>
          )}

          <form
            onSubmit={submit}
            className="mt-7 space-y-5"
          >
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="At least 8 characters"
              autoComplete="new-password"
              required
            />

            <Input
              label="Confirm password"
              type="password"
              value={confirmPassword}
              onChange={(event) =>
                setConfirmPassword(
                  event.target.value,
                )
              }
              placeholder="Repeat your password"
              autoComplete="new-password"
              required
            />

            {formError && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
                {formError}
              </div>
            )}

            <div className="flex items-center gap-2 rounded-xl border border-line bg-ink/50 p-3 text-xs leading-5 text-slate-600">
              <LockKeyhole
                size={15}
                className="shrink-0 text-slate-500"
              />
              Your password is securely hashed before the account is created.
            </div>

            <Button
              type="submit"
              loading={acceptMutation.isPending}
              disabled={!token}
              className="w-full"
            >
              Accept invitation
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-600">
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-semibold text-brand-300 hover:text-brand-200"
            >
              Sign in
            </Link>
          </p>
        </Card>
      </div>
    </AuthShell>
  );
}
