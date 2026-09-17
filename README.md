# SkillForge

SkillForge is a multi-tenant, role-based skills assessment platform.

The idea is simple: an organization can create assessment campaigns using a specific version of its skills framework, staff can assess themselves, managers can review what their team members submitted, and the system uses the results to show skill gaps and suggest learning resources.

This README is mainly here to explain what is currently in the project and what still depends on external services.

## 1. What is currently built

### Backend

The backend is an Express + TypeScript application using MongoDB. The code is split into modules based on the different parts of the platform.

Some of the main models currently in the project are:

- Organization
- User
- FrameworkVersion
- Skill
- SkillLevel
- BehaviouralFactor
- RoleProfile
- CareerPath
- SelfAssessmentCampaign
- SelfAssessment
- SelfAssessmentResponse
- AssessmentAssignment
- AssessmentAttempt
- EvidencePrompt
- ManagerCorroboration
- AssessmentScore
- GapAnalysis
- LearningResource
- Notification
- AuditLog
- Invitation
- IndustryTemplate

The project is multi-tenant, so organization data is kept separate using `organizationId`. User roles are also used to control what each person can access.

The current roles are:

- `PLATFORM_ADMIN`
- `ORGANIZATION_ADMIN`
- `MANAGER`
- `STAFF`

Authentication and authorization are handled through the existing auth middleware, instead of checking roles manually in every controller.

### Frameworks and assessments

Framework versions are stored separately from the skills that belong to them. This allows an assessment campaign to stay connected to the exact framework version it was created with.

The main assessment flow currently follows this structure:

```text
Campaign
   ↓
Assignment
   ↓
Self Assessment
   ↓
Evidence
   ↓
Manager Corroboration
   ↓
Scoring
   ↓
Gap Analysis
```

Each part has its own module with the relevant models, services, controllers and routes.

### Evidence uploads

Evidence files are handled using presigned upload URLs.

The frontend gets a temporary upload URL from the backend and uploads the file directly to S3 or another compatible storage provider. The actual file is not stored inside MongoDB. MongoDB only keeps the information needed to reference the uploaded file.

The storage setup can work with S3-compatible providers such as AWS S3, Cloudflare R2, Backblaze B2 or MinIO.

### Redis

Redis is supported as an optional cache.

If `REDIS_URL` is not provided, the application can continue running without Redis. The cache layer simply does not perform the Redis operations.

### Audit logs and impersonation

The project has audit logging for important actions, along with support for platform administrators to impersonate an organization when that functionality is required.

The impersonation flow has its own `ImpersonationSession` model and keeps an audit trail.

### Reports

Reports and analytics are already part of the backend.

There are endpoints for candidate reports, organization analytics and report exports. Scheduled report functionality is also present, although sending those reports by email depends on the email provider being configured.

### Other features

A few features were added after the original MVP requirements and are already present in the codebase:

- AI features using Gemini
- Bulk user import
- Invitations
- Stripe billing and subscriptions
- Support tickets
- SSO
- MFA
- HRIS/LMS integration support

These are in the project as actual modules rather than just placeholders.

---

## 2. Frontend

The frontend is built with React, TypeScript, Vite and Tailwind CSS.

TanStack Query is used for server state, Axios handles API requests, and Recharts is used for some of the analytics screens.

The main frontend areas include:

### Admin

The admin section currently contains pages for things such as:

- Organization management
- Users
- Skills
- Invitations
- Analytics
- Audit logs
- Framework management
- Framework migration
- Billing
- Integrations
- Scheduled reports

### Manager

Managers have access to:

- Their team
- Corroboration requests
- Team member reports
- Related assessment information

Managers are restricted to the staff members assigned to them.

### Staff

Staff can access:

- Self assessments
- Assessment details
- Their reports
- Gap analysis
- Learning resources
- Career paths
- Notifications

### Other feature areas

There are also frontend pages for:

- Role profiles
- Career paths
- Learning resources
- Reports
- Notifications
- AI features

There are shared components for things like tables, evidence uploads and configuration notices.

---

## 3. What was different from the original plan

The original architecture suggested using React Hook Form and Zod together for the form-heavy parts of the frontend.

The current frontend does not use that combination. The forms are handled with the existing React/TypeScript setup and manual validation instead.

This does not stop the application from working; it is just different from what was originally suggested in the architecture document.

---

## 4. Where the project currently stands

The main phases from the original plan have corresponding implementations in the project:

```text
Foundation
    ↓
Frameworks
    ↓
Organization setup
    ↓
Role profiles
    ↓
Assessments
    ↓
Manager corroboration
    ↓
Scoring
    ↓
Gap analysis
    ↓
Reports and analytics
```

The core platform is therefore already in place.

There are also additional modules around billing, authentication, integrations, AI and administration.

Some of these features depend on external services, which is why they may not be fully usable in a local/demo environment until their provider keys are added.

---

# Optional provider configuration

The external services are set up so that the main application can still be tested without configuring every provider.

The following environment variables can be left empty for a basic local/demo setup:

```env
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

RESEND_API_KEY=
REPORT_FROM_EMAIL=reports@yourdomain.com

APP_ENCRYPTION_KEY=

VITE_STRIPE_PRICE_ID=
```

## Stripe

Without `STRIPE_SECRET_KEY` or `VITE_STRIPE_PRICE_ID`, the billing section can still be opened and subscription information can be viewed.

Live Stripe checkout will not work until the required Stripe values are configured.

Instead of the application crashing, the billing action shows a message telling the user that Stripe has not been configured yet.

The Stripe controllers, services and routes are already in the project, so the provider can be connected later.

## Resend and scheduled reports

Without `RESEND_API_KEY`, the scheduled reports section can still be opened.

The report generation functionality is still there, including PDF/XLSX generation and the automation worker.

What is disabled is the actual email delivery.

The UI displays a message that report email delivery has not been configured yet rather than treating it as a server error.

## APP_ENCRYPTION_KEY

`APP_ENCRYPTION_KEY` is optional in the current demo setup.

The existing encryption utility can fall back to the JWT access secret when a separate application encryption key has not been provided.

For a production deployment, a separate `APP_ENCRYPTION_KEY` should be configured.

---

## Provider setup later

When the required provider accounts and credentials are available, the backend can be configured with:

```env
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...

RESEND_API_KEY=...
REPORT_FROM_EMAIL=reports@yourdomain.com

APP_ENCRYPTION_KEY=...
```

The frontend can use:

```env
VITE_STRIPE_PRICE_ID=...
```

After changing environment variables, restart the frontend and backend so the new values are picked up.

For now, the provider-dependent parts can remain unconfigured while the main SkillForge features are being tested.
