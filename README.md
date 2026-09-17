# SkillForge — Optional Provider Configuration

This patch makes the external infrastructure integrations **gracefully optional** for local/demo testing.

## What happens when the provider keys are missing?

The SkillForge application does **not** require the following values in order to run the core platform:

```env
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
RESEND_API_KEY=
REPORT_FROM_EMAIL=reports@yourdomain.com
APP_ENCRYPTION_KEY=
VITE_STRIPE_PRICE_ID=
```

### Stripe

If `STRIPE_SECRET_KEY` or `VITE_STRIPE_PRICE_ID` is missing:

- Billing still opens normally.
- The subscription status can still be viewed.
- Live checkout is disabled.
- Clicking a billing action displays a **"Stripe is not configured yet"** popup instead of throwing an application error.
- The Stripe controllers and services remain installed and ready for configuration later.

### Resend / scheduled reports

If `RESEND_API_KEY` is missing:

- The scheduled-report page still loads.
- PDF/XLSX report generation code remains installed.
- The automation worker remains installed.
- Email scheduling is disabled in the UI.
- The user sees a **"Report email delivery is not configured yet"** popup instead of an error.

### APP_ENCRYPTION_KEY

`APP_ENCRYPTION_KEY` is optional for the current demo environment. The existing secret-encryption utility falls back to the JWT access secret when the application encryption key is not provided, so the server does not fail to start merely because this value is blank.

For production, configure a dedicated `APP_ENCRYPTION_KEY`.

## Important: the integrations are already implemented

The provider integrations have already been added to the SkillForge codebase. This includes controllers, services, routes and UI for:

- Stripe billing/subscriptions
- Stripe webhooks
- Resend report delivery
- Scheduled PDF/XLSX reports
- Secret encryption
- SSO/OIDC/SAML
- MFA/TOTP
- HRIS/LMS integrations
- Support tickets and audited impersonation

The current demo environment simply does **not have the external provider API keys configured yet**.

This is intentional so the core SkillForge platform can be tested without creating external Stripe, Resend or other provider accounts first.

## Provider configuration later

When credentials become available, add them to the appropriate `.env` files:

```env
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
RESEND_API_KEY=...
REPORT_FROM_EMAIL=reports@yourdomain.com
APP_ENCRYPTION_KEY=...
```

and the frontend:

```env
VITE_STRIPE_PRICE_ID=...
```

Restart both frontend and backend after changing environment variables.
