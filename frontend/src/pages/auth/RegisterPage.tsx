import {
  type FormEvent,
  useState,
} from "react";
import {
  Link,
  useNavigate,
} from "react-router-dom";

import { useAuth } from "../../auth";
import { AuthShell } from "../../layouts/AppLayout";
import {
  Button,
  ErrorState,
} from "../../components/ui";
import { errorMessage } from "../../api";

interface RegistrationForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirm: string;
}

const INITIAL_FORM: RegistrationForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  password: "",
  confirm: "",
};

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  autoComplete?: string;
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  autoComplete,
}: FieldProps) {
  return (
    <label className="block">
      <span className="label">
        {label}
      </span>

      <input
        className="field"
        type={type}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        required={required}
        autoComplete={autoComplete}
      />
    </label>
  );
}

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] =
    useState<RegistrationForm>(
      INITIAL_FORM,
    );

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function updateField(
    field: keyof RegistrationForm,
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");

    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    const email = form.email.trim();
    const phone = form.phone.trim();

    if (!firstName || !lastName) {
      setError(
        "Please enter your first and last name.",
      );
      return;
    }

    if (form.password.length < 8) {
      setError(
        "Password must be at least 8 characters.",
      );
      return;
    }

    if (form.password !== form.confirm) {
      setError(
        "Passwords do not match.",
      );
      return;
    }

    setBusy(true);

    try {
      await register({
        firstName,
        lastName,
        email,
        phone: phone || undefined,
        password: form.password,
      });

      navigate("/dashboard", {
        replace: true,
      });
    } catch (err) {
      setError(
        errorMessage(
          err,
          "Unable to create your account.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <div className="mx-auto max-w-2xl px-5 py-12">
        <div className="mx-auto max-w-xl">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand-400">
            Get started
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">
            Create your SkillForge account
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Create your workspace account. Access
            permissions are controlled by the platform.
          </p>

          <div className="card mt-8 p-6 md:p-8">
            {error && (
              <div className="mb-6">
                <ErrorState text={error} />
              </div>
            )}

            <form
              onSubmit={submit}
              className="space-y-5"
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="First name"
                  value={form.firstName}
                  onChange={(value) =>
                    updateField(
                      "firstName",
                      value,
                    )
                  }
                  required
                  autoComplete="given-name"
                />

                <Field
                  label="Last name"
                  value={form.lastName}
                  onChange={(value) =>
                    updateField(
                      "lastName",
                      value,
                    )
                  }
                  required
                  autoComplete="family-name"
                />
              </div>

              <Field
                label="Email"
                type="email"
                value={form.email}
                onChange={(value) =>
                  updateField("email", value)
                }
                required
                autoComplete="email"
              />

              <Field
                label="Phone"
                type="tel"
                value={form.phone}
                onChange={(value) =>
                  updateField("phone", value)
                }
                autoComplete="tel"
              />

              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Password"
                  type="password"
                  value={form.password}
                  onChange={(value) =>
                    updateField(
                      "password",
                      value,
                    )
                  }
                  required
                  autoComplete="new-password"
                />

                <Field
                  label="Confirm password"
                  type="password"
                  value={form.confirm}
                  onChange={(value) =>
                    updateField(
                      "confirm",
                      value,
                    )
                  }
                  required
                  autoComplete="new-password"
                />
              </div>

              <Button
                type="submit"
                disabled={busy}
                className="w-full"
              >
                {busy
                  ? "Creating account..."
                  : "Create account"}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-600">
              Already registered?{" "}
              <Link
                className="font-semibold text-brand-300"
                to="/login"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </AuthShell>
  );
}