import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, ExternalLink } from "lucide-react";

import { api, errorMessage, unwrap } from "../../api";
import {
  Badge,
  Button,
  Card,
  ErrorState,
  PageHeader,
  Section,
} from "../../components/ui";
import ConfigurationNotice from "../../components/ConfigurationNotice";

interface Billing {
  status: string;
  stripeCustomerId?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
}

interface ConfigurationStatus {
  stripeConfigured: boolean;
  stripeWebhookConfigured: boolean;
  resendConfigured: boolean;
  encryptionConfigured: boolean;
}

export default function BillingPage() {
  const [notice, setNotice] = useState<{
    title: string;
    text: string;
  } | null>(null);

  const billingQuery = useQuery({
    queryKey: ["billing"],
    queryFn: async () =>
      unwrap<Billing>(await api.get("/infrastructure/billing")),
  });

  const configQuery = useQuery({
    queryKey: ["infrastructure-config-status"],
    queryFn: async () =>
      unwrap<ConfigurationStatus>(
        await api.get("/infrastructure/config-status"),
      ),
  });

  const stripePriceId =
    String(import.meta.env.VITE_STRIPE_PRICE_ID || "").trim();

  async function checkout() {
    if (!configQuery.data?.stripeConfigured) {
      setNotice({
        title: "Stripe is not configured yet",
        text: "Billing controllers and services are already installed in SkillForge, but STRIPE_SECRET_KEY has not been configured. Add the Stripe credentials when you are ready to enable live subscriptions.",
      });
      return;
    }

    if (!stripePriceId) {
      setNotice({
        title: "Stripe price is not configured yet",
        text: "The Stripe billing integration is installed, but VITE_STRIPE_PRICE_ID has not been configured. You can continue testing the rest of SkillForge without enabling live checkout.",
      });
      return;
    }

    try {
      const response = await api.post("/infrastructure/billing/checkout", {
        priceId: stripePriceId,
        successUrl: `${window.location.origin}/admin/billing?success=1`,
        cancelUrl: `${window.location.origin}/admin/billing?cancelled=1`,
      });

      const result = unwrap<{ url: string }>(response);
      window.location.href = result.url;
    } catch (error) {
      setNotice({
        title: "Stripe is not available",
        text: errorMessage(
          error,
          "Stripe billing is not configured yet. Your SkillForge application can continue running without it.",
        ),
      });
    }
  }

  async function portal() {
    if (!configQuery.data?.stripeConfigured) {
      setNotice({
        title: "Stripe is not configured yet",
        text: "The Stripe billing portal is available in the codebase, but STRIPE_SECRET_KEY has not been configured yet.",
      });
      return;
    }

    if (!billingQuery.data?.stripeCustomerId) {
      setNotice({
        title: "No Stripe customer yet",
        text: "This organization does not have a Stripe customer because live billing has not been configured or started yet.",
      });
      return;
    }

    try {
      const response = await api.post("/infrastructure/billing/portal", {
        returnUrl: `${window.location.origin}/admin/billing`,
      });
      const result = unwrap<{ url: string }>(response);
      window.location.href = result.url;
    } catch (error) {
      setNotice({
        title: "Stripe billing is unavailable",
        text: errorMessage(
          error,
          "The Stripe billing portal could not be opened.",
        ),
      });
    }
  }

  if (billingQuery.isLoading || configQuery.isLoading) {
    return <div className="p-8 text-slate-500">Loading billing...</div>;
  }

  if (billingQuery.isError || configQuery.isError) {
    return (
      <ErrorState
        text={
          billingQuery.isError
            ? errorMessage(billingQuery.error, "Unable to load billing.")
            : errorMessage(
                configQuery.error,
                "Unable to load billing configuration status.",
              )
        }
      />
    );
  }

  const billing = billingQuery.data;
  const stripeReady = Boolean(
    configQuery.data?.stripeConfigured && stripePriceId,
  );

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Organization administration"
          title="Billing & subscription"
          description="Manage your Stripe subscription and billing portal. Live billing can remain disabled while the rest of the platform is being tested."
        />

        {!stripeReady && (
          <Card className="border-amber-400/20 bg-amber-400/5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-amber-200">
                  Billing is not configured yet
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Stripe controllers and services are installed. Live checkout
                  is disabled until the provider keys are added.
                </p>
              </div>
              <Badge tone="amber">NOT CONFIGURED</Badge>
            </div>
          </Card>
        )}

        <Card>
          <Section title="Subscription">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone={billing?.status === "ACTIVE" ? "green" : "amber"}>
                {billing?.status || "UNCONFIGURED"}
              </Badge>
              {billing?.currentPeriodEnd && (
                <span className="text-sm text-slate-500">
                  Current period ends{" "}
                  {new Date(billing.currentPeriodEnd).toLocaleDateString()}
                </span>
              )}
              {billing?.cancelAtPeriodEnd && (
                <Badge tone="amber">CANCELS AT PERIOD END</Badge>
              )}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={checkout} disabled={!stripeReady}>
                <CreditCard size={15} />
                Start subscription
              </Button>

              <Button
                variant="secondary"
                onClick={portal}
                disabled={!billing?.stripeCustomerId || !configQuery.data?.stripeConfigured}
              >
                <ExternalLink size={15} />
                Open Stripe billing portal
              </Button>
            </div>
          </Section>
        </Card>
      </div>

      {notice && (
        <ConfigurationNotice
          title={notice.title}
          text={notice.text}
        />
      )}
    </>
  );
}
