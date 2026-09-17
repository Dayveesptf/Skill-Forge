# SkillForge

SkillForge is a multi-tenant, role-based skills assessment platform: organizations run self-assessment campaigns against a versioned skills framework, managers corroborate what staff report, a scoring engine turns that into per-skill scores, and gap analysis compares people against role targets so gaps can be closed with recommended learning resources.

This README covers two things:

1. **What has actually been built**, mapped against the original architecture/spec document, so it's clear what's implemented vs. what was scoped but deferred.
2. **Optional provider configuration** — how the app degrades gracefully when third-party keys (Stripe, Resend, etc.) aren't set, for local/demo use.

---

## 1. What's built, against the spec

The original spec called for a modular monolith — React/TypeScript frontend talking to an Express/TypeScript backend, MongoDB as the primary store, with Redis, object storage and email layered in as "optional/recommended." That's the shape the codebase follows.

### Backend (`/backend`)

Organized as a modules-per-domain monolith under `src/modules/`, matching the spec's proposed structure almost one-to-one:

- **Core domain models** (`src/models/`): `Organization`, `User`, `FrameworkVersion`, `Skill`, `SkillLevel`, `BehaviouralFactor`, `RoleProfile`, `CareerPath`, `SelfAssessmentCampaign`, `SelfAssessment` / `SelfAssessmentResponse`, `AssessmentAssignment`, `AssessmentAttempt`, `EvidencePrompt`, `ManagerCorroboration`, `AssessmentScore`, `GapAnalysis`, `LearningResource`, `Notification`, `AuditLog`, `Invitation`, `IndustryTemplate`. This lines up with the ~20 "core entities" called out in the spec (Tenant → here named `Organization`, User, Framework/Version, Skill, RoleProfile, CareerPath, Campaign, Assessment, Evidence, Corroboration, Score, GapAnalysis, LearningResource, Notification, AuditLog).
- **Multi-tenancy**: every organization-scoped model carries `organizationId`, and `User.role` + `organizationId` drive access — the tenant-isolation pattern the spec called "critical for security."
- **RBAC**: `PLATFORM_ADMIN`, `ORGANIZATION_ADMIN`, `MANAGER`, `STAFF` (`src/constants/roles.ts`), enforced via `authenticate` / `authorize` / `requireOrganization` middleware rather than scattered `if (role === "ADMIN")` checks.
- **Auth**: JWT access tokens plus SSO (OIDC/SAML) support (`modules/auth/sso.*`), and MFA/TOTP models (`MfaCredential` in `modules/infrastructure`).
- **Framework versioning**: `FrameworkVersion` is a separate, versioned document from `Skill`/`SkillLevel`, so a campaign and its assessments stay pinned to the version they were scored against — the spec flagged this as one of the most important database decisions, and it's implemented as designed.
- **Assessment workflow**: `selfAssessmentCampaigns` → `AssessmentAssignment` → `SelfAssessment`/`AssessmentAttempt` → `Evidence` → `ManagerCorroboration` → `scoring` → `gapAnalysis`, each as its own module with controller/service/routes, matching the spec's phase breakdown (Phases 5–7).
- **Evidence storage**: `config/storage.ts` wraps AWS S3 / any S3-compatible provider (R2, B2, MinIO). Files never transit the API server — the client requests a presigned PUT URL, uploads directly, then the backend confirms and stores only metadata, exactly per the spec's "don't store binaries in MongoDB" recommendation. Reads use short-lived presigned GET URLs.
- **Caching**: `config/redis.ts` is a cache-aside layer over `ioredis` that's fully optional — with no `REDIS_URL` set it transparently no-ops rather than failing, matching the spec's "not required for MVP but architect for it" guidance.
- **Audit logging & impersonation**: `AuditLog` model plus an `ImpersonationSession` model and controller (`modules/infrastructure`), covering the platform-admin "impersonate a tenant with full audit logging" use case called out in the spec.
- **Reporting**: `modules/reports` and `modules/infrastructure/report-export.service.ts` generate exportable reports; scheduled report delivery and email are wired up but provider-gated (see section 2).
- **Extras beyond the original spec**: an AI module (`modules/ai`) using Google's Gemini SDK, user import/bulk invitations (`modules/imports`, `modules/invitations`), Stripe billing/subscriptions, and support tickets — these weren't in the original architecture doc but have been added as the platform grew past the MVP scope.

### Frontend (`/frontend`)

React + TypeScript + Tailwind, with TanStack Query for server state and Recharts for analytics, as specified. Pages are organized by role, mirroring the spec's route plan (`/platform`, `/org`, `/manager`, `/staff` conceptually, though the actual route names differ slightly):

- `pages/admin/` — organization structure, skill library, invitations, users, analytics, audit log, framework migration, billing, integrations, scheduled reports, platform-level organization management.
- `pages/manager/` — team view and corroboration queue/detail.
- `pages/self-assessments/` — the staff-facing assessment list, detail, and "new assessment" flow.
- `pages/career-paths/`, `pages/roles/`, `pages/learning/`, `pages/reports/`, `pages/notifications/`, `pages/ai/` — supporting feature areas from the spec (career paths, role profiles, learning resources, reporting, notifications) plus the AI extension.
- Shared components: a `DataTable`, an `EvidenceUploader` (pairs with the presigned-upload backend flow), and a `ConfigurationNotice` component that renders the "not configured yet" banners referenced in section 2.

**Deviation from the original spec**: the spec recommended React Hook Form + Zod for all the form-heavy flows (org setup, campaigns, assessments, evidence, corroboration). The frontend currently only depends on `@tanstack/react-query`, `axios`, `lucide-react`, `react-router-dom`, and `recharts` — form validation is handled without that library pairing, so forms are more manually wired than the spec envisioned.

### Where this sits against the phased plan

Phases 1–7 from the spec (foundation, framework, org setup, role profiles, assessments, manager corroboration, scoring + gap analysis) all have corresponding modules on both sides of the stack. Phase 8 (reports + analytics) is present but partially provider-gated — report generation code and the scheduling UI exist, but actually emailing a scheduled report needs `RESEND_API_KEY` (see below). Billing/subscriptions, SSO, MFA, HRIS/LMS integrations and audited impersonation — called "already implemented" ahead of provider configuration — are all present as real controllers/services/models, not stubs; they just have no live credentials in this environment.

---

## 2. Optional provider configuration

This patch makes the external infrastructure integrations **gracefully optional** for local/demo testing.

### What happens when the provider keys are missing?

The SkillForge application does **not** require the following values in order to run the core platform:

```env
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
RESEND_API_KEY=
REPORT_FROM_EMAIL=reports@yourdomain.com
APP_ENCRYPTION_KEY=
VITE_STRIPE_PRICE_ID=
```

#### Stripe

If `STRIPE_SECRET_KEY` or `VITE_STRIPE_PRICE_ID` is missing:

- Billing still opens normally.
- The subscription status can still be viewed.
- Live checkout is disabled.
- Clicking a billing action displays a **"Stripe is not configured yet"** popup instead of throwing an application error.
- The Stripe controllers and services remain installed and ready for configuration later.

#### Resend / scheduled reports

If `RESEND_API_KEY` is missing:

- The scheduled-report page still loads.
- PDF/XLSX report generation code remains installed.
- The automation worker remains installed.
- Email scheduling is disabled in the UI.
- The user sees a **"Report email delivery is not configured yet"** popup instead of an error.

#### APP_ENCRYPTION_KEY

`APP_ENCRYPTION_KEY` is optional for the current demo environment. The existing secret-encryption utility falls back to the JWT access secret when the application encryption key is not provided, so the server does not fail to start merely because this value is blank.

For production, configure a dedicated `APP_ENCRYPTION_KEY`.

### Important: the integrations are already implemented

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

### Provider configuration later

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