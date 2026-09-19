import type { ReactNode } from "react";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import { useAuth } from "./auth";

import { AppLayout } from "./layouts/AppLayout";

import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";

import DashboardPage from "./pages/dashboard/DashboardPage";

import AssessmentsPage from "./pages/assessments/AssessmentsPage";
import AssessmentDetailPage from "./pages/assessments/AssessmentDetailPage";
import AssessmentFormPage from "./pages/assessments/AssessmentFormPage";

import SelfAssessmentCampaignsPage from "./pages/assessments/SelfAssessmentCampaignsPage";

import RoleProfilesPage from "./pages/roles/RoleProfilesPage";
import RoleProfileDetailPage from "./pages/roles/RoleProfileDetailPage";
import RoleProfileFormPage from "./pages/roles/RoleProfileFormPage";

import SelfAssessmentsPage from "./pages/self-assessments/SelfAssessmentsPage";
import SelfAssessmentDetailPage from "./pages/self-assessments/SelfAssessmentDetailPage";
import SelfAssessmentNewPage from "./pages/self-assessments/SelfAssessmentNewPage";

import ManagerCorroborationsPage from "./pages/manager/ManagerCorroborationsPage";
import ManagerCorroborationDetailPage from "./pages/manager/ManagerCorroborationDetailPage";
import ManagerTeamPage from "./pages/manager/ManagerTeamPage";

import ReportsPage from "./pages/reports/ReportsPage";

import AdminUsersPage from "./pages/admin/AdminUsersPage";
import AdminAnalyticsPage from "./pages/admin/AdminAnalyticsPage";
import AdminAuditPage from "./pages/admin/AdminAuditPage";
import AiReviewPage from "./pages/admin/AdminAIReviewPage";

import LearningResourcesPage from "./pages/learning/LearningResourcesPage";

import SettingsPage from "./pages/SettingsPage";
import NotFoundPage from "./pages/NotFoundPage";

import CareerPathsPage from "./pages/career-paths/CareerPathsPage";
import CareerPathDetailPage from "./pages/career-paths/CareerPathDetailPage";
import CareerPathFormPage from "./pages/career-paths/CareerPathFormPage";

import AdminOrganizationPage from "./pages/admin/AdminOrganizationPage";
import OrganizationStructurePage from "./pages/admin/OrganizationStructurePage";
import OrganizationSkillLibraryPage from "./pages/admin/OrganizationSkillLibraryPage";
import FrameworkMigrationPage from "./pages/admin/FrameworkMigrationPage";
import BillingPage from "./pages/admin/BillingPage";
import IntegrationsPage from "./pages/admin/IntegrationsPage";
import ScheduledReportsPage from "./pages/admin/ScheduledReportsPage";
import SupportPage from "./pages/SupportPage";
import SecuritySettingsPage from "./pages/SecuritySettingsPage";
import NotificationsPage from "./pages/notifications/NotificationsPage";
import SsoCallbackPage from "./pages/auth/SsoCallbackPage";
import PlatformOrganizationsPage from "./pages/admin/PlatformOrganizationsPage";
import AdminInvitationsPage from "./pages/admin/AdminInvitationsPage";
import AcceptInvitationPage from "./pages/auth/AcceptInvitationPage";

/* -------------------------------------------------------------------------- */
/* Route guard roles                                                          */
/* -------------------------------------------------------------------------- */

type GuardRole =
  | "PLATFORM_ADMIN"
  | "ORGANIZATION_ADMIN"
  | "MANAGER"
  | "STAFF";

/* -------------------------------------------------------------------------- */
/* Protected route guard                                                      */
/* -------------------------------------------------------------------------- */

function Guard({
  children,
  admin = false,
  roles,
}: {
  children: ReactNode;
  admin?: boolean;
  roles?: GuardRole[];
}) {
  const {
    user,
    loading,
    isAdmin,
  } = useAuth();

  const location = useLocation();

  /* ------------------------------------------------------------------------ */
  /* Authentication loading                                                   */
  /* ------------------------------------------------------------------------ */

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink text-slate-500">
        Loading SkillForge...
      </div>
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Authentication required                                                  */
  /* ------------------------------------------------------------------------ */

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location.pathname,
        }}
      />
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Administrator access                                                     */
  /* ------------------------------------------------------------------------ */

  if (admin && !isAdmin) {
    return (
      <Navigate
        to="/dashboard"
        replace
      />
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Role-based access                                                         */
  /* ------------------------------------------------------------------------ */

  if (
    roles &&
    !roles.includes(user.role)
  ) {
    return (
      <Navigate
        to="/dashboard"
        replace
      />
    );
  }

  return children;
}

/* -------------------------------------------------------------------------- */
/* Public-only guard                                                          */
/* -------------------------------------------------------------------------- */

function PublicOnly({
  children,
}: {
  children: ReactNode;
}) {
  const {
    user,
    loading,
  } = useAuth();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink text-slate-500">
        Loading SkillForge...
      </div>
    );
  }

  return user ? (
    <Navigate
      to="/dashboard"
      replace
    />
  ) : (
    children
  );
}

/* -------------------------------------------------------------------------- */
/* Application routes                                                         */
/* -------------------------------------------------------------------------- */

export default function App() {
  return (
    <Routes>
      {/* ================================================================== */}
      {/* PUBLIC ROUTES                                                      */}
      {/* ================================================================== */}

      <Route
        path="/login"
        element={
          <PublicOnly>
            <LoginPage />
          </PublicOnly>
        }
      />

      <Route path="/sso/callback" element={<SsoCallbackPage />} />

      <Route
        path="/register"
        element={
          <PublicOnly>
            <RegisterPage />
          </PublicOnly>
        }
      />

      <Route
        path="/accept-invitation"
        element={<AcceptInvitationPage />}
      />

      {/* ================================================================== */}
      {/* PROTECTED APPLICATION                                               */}
      {/* ================================================================== */}

      <Route
        element={
          <Guard>
            <AppLayout />
          </Guard>
        }
      >
        {/* ---------------------------------------------------------------- */}
        {/* Dashboard                                                        */}
        {/* ---------------------------------------------------------------- */}

        <Route
          path="/"
          element={
            <Navigate
              to="/dashboard"
              replace
            />
          }
        />

        <Route
          path="/dashboard"
          element={
            <DashboardPage />
          }
        />

        {/* ================================================================= */}
        {/* ASSESSMENTS                                                       */}
        {/* ================================================================= */}

        <Route
          path="/assessments"
          element={
            <AssessmentsPage />
          }
        />

        <Route
          path="/assessments/new"
          element={
            <AssessmentFormPage />
          }
        />

        <Route
          path="/assessments/:id"
          element={
            <AssessmentDetailPage />
          }
        />

        <Route
          path="/assessments/:id/edit"
          element={
            <AssessmentFormPage />
          }
        />

        {/* ================================================================= */}
        {/* SELF-ASSESSMENT CAMPAIGNS                                         */}
        {/* ================================================================= */}

        <Route
          path="/self-assessment-campaigns"
          element={
            <Guard
              roles={[
                "ORGANIZATION_ADMIN",
              ]}
            >
              <SelfAssessmentCampaignsPage />
            </Guard>
          }
        />

        {/* ================================================================= */}
        {/* ROLE PROFILES                                                     */}
        {/* ================================================================= */}

        <Route
          path="/role-profiles"
          element={
            <Guard
              roles={[
                "PLATFORM_ADMIN",
                "ORGANIZATION_ADMIN",
                "MANAGER",
                "STAFF",
              ]}
            >
              <RoleProfilesPage />
            </Guard>
          }
        />

        <Route
          path="/role-profiles/new"
          element={
            <Guard
              roles={[
                "PLATFORM_ADMIN",
                "ORGANIZATION_ADMIN",
              ]}
            >
              <RoleProfileFormPage />
            </Guard>
          }
        />

        <Route
          path="/role-profiles/:id"
          element={
            <Guard
              roles={[
                "PLATFORM_ADMIN",
                "ORGANIZATION_ADMIN",
                "MANAGER",
                "STAFF",
              ]}
            >
              <RoleProfileDetailPage />
            </Guard>
          }
        />

        <Route
          path="/role-profiles/:id/edit"
          element={
            <Guard
              roles={[
                "PLATFORM_ADMIN",
                "ORGANIZATION_ADMIN",
              ]}
            >
              <RoleProfileFormPage />
            </Guard>
          }
        />

        {/* ================================================================= */}
        {/* CAREER PATHS                                                      */}
        {/* ================================================================= */}

        <Route
          path="/career-paths"
          element={
            <Guard
              roles={[
                "ORGANIZATION_ADMIN",
                "MANAGER",
                "STAFF",
              ]}
            >
              <CareerPathsPage />
            </Guard>
          }
        />

        <Route
          path="/career-paths/new"
          element={
            <Guard
              roles={[
                "ORGANIZATION_ADMIN",
              ]}
            >
              <CareerPathFormPage />
            </Guard>
          }
        />

        <Route
          path="/career-paths/:id"
          element={
            <Guard
              roles={[
                "ORGANIZATION_ADMIN",
                "MANAGER",
                "STAFF",
              ]}
            >
              <CareerPathDetailPage />
            </Guard>
          }
        />

        <Route
          path="/career-paths/:id/edit"
          element={
            <Guard
              roles={[
                "ORGANIZATION_ADMIN",
              ]}
            >
              <CareerPathFormPage />
            </Guard>
          }
        />

        {/* ================================================================= */}
        {/* SELF ASSESSMENTS                                                  */}
        {/* ================================================================= */}

        <Route
          path="/self-assessments"
          element={
            <Guard
              roles={[
                "ORGANIZATION_ADMIN",
                "STAFF",
              ]}
            >
              <SelfAssessmentsPage />
            </Guard>
          }
        />

        <Route
          path="/self-assessments/new"
          element={
            <Guard
              roles={["STAFF"]}
            >
              <SelfAssessmentNewPage />
            </Guard>
          }
        />

        <Route
          path="/self-assessments/:id"
          element={
            <Guard
              roles={[
                "ORGANIZATION_ADMIN",
                "STAFF",
              ]}
            >
              <SelfAssessmentDetailPage />
            </Guard>
          }
        />

        {/* ================================================================= */}
        {/* MANAGER CORROBORATIONS                                             */}
        {/* ================================================================= */}
        <Route
          path="/manager/team"
          element={
            <Guard roles={["MANAGER"]}>
              <ManagerTeamPage />
            </Guard>
          }
        />

        <Route
          path="/manager-corroborations"
          element={
            <Guard
              roles={[
                "MANAGER",
              ]}
            >
              <ManagerCorroborationsPage />
            </Guard>
          }
        />

        <Route
          path="/manager-corroborations/:id"
          element={
            <Guard
              roles={[
                "MANAGER",
              ]}
            >
              <ManagerCorroborationDetailPage />
            </Guard>
          }
        />

        {/* ================================================================= */}
        {/* REPORTS & GAP ANALYSIS                                            */}
        {/* ================================================================= */}

        <Route
          path="/reports"
          element={
            <Guard roles={["MANAGER", "STAFF"]}>
              <ReportsPage />
            </Guard>
          }
        />

        {/* ================================================================= */}
        {/* LEARNING RESOURCES                                                */}
        {/* ================================================================= */}

        <Route
          path="/learning-resources"
          element={
            <LearningResourcesPage />
          }
        />

        {/* ================================================================= */}
        {/* SETTINGS                                                          */}
        {/* ================================================================= */}

        <Route
          path="/settings"
          element={
            <SettingsPage />
          }
        />

        {/* ================================================================= */}
        {/* ADMINISTRATION                                                    */}
        {/* ================================================================= */}
        <Route
          path="/admin/organizations"
          element={
            <Guard roles={["PLATFORM_ADMIN"]}>
              <PlatformOrganizationsPage />
            </Guard>
          }
        />

        <Route
          path="/admin/invitations"
          element={
            <Guard roles={["ORGANIZATION_ADMIN"]}>
              <AdminInvitationsPage />
            </Guard>
          }
        />

        <Route
          path="/admin/organization"
          element={
            <Guard roles={["ORGANIZATION_ADMIN"]}>
              <AdminOrganizationPage />
            </Guard>
          }
        />
        <Route
          path="/admin/users"
          element={
            <Guard roles={["ORGANIZATION_ADMIN"]}>
              <AdminUsersPage />
            </Guard>
          }
        />

        <Route
          path="/admin/analytics"
          element={
            <Guard admin>
              <AdminAnalyticsPage />
            </Guard>
          }
        />

        <Route
          path="/admin/audit"
          element={
            <Guard admin>
              <AdminAuditPage />
            </Guard>
          }
        />

        <Route
          path="/admin/ai-review"
          element={
            <Guard admin>
              <AiReviewPage />
            </Guard>
          }
        />

        <Route path="/admin/organization/structure" element={<Guard roles={["ORGANIZATION_ADMIN"]}><OrganizationStructurePage /></Guard>} />
        <Route path="/admin/organization/skills" element={<Guard roles={["ORGANIZATION_ADMIN"]}><OrganizationSkillLibraryPage /></Guard>} />
        <Route path="/admin/framework" element={<Guard roles={["PLATFORM_ADMIN","ORGANIZATION_ADMIN"]}><FrameworkMigrationPage /></Guard>} />
        <Route path="/admin/billing" element={<Guard roles={["ORGANIZATION_ADMIN"]}><BillingPage /></Guard>} />
        <Route path="/admin/integrations" element={<Guard roles={["ORGANIZATION_ADMIN"]}><IntegrationsPage /></Guard>} />
        <Route path="/admin/scheduled-reports" element={<Guard roles={["ORGANIZATION_ADMIN"]}><ScheduledReportsPage /></Guard>} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/security" element={<SecuritySettingsPage />} />
      </Route>

      {/* ================================================================== */}
      {/* 404                                                                 */}
      {/* ================================================================== */}

      <Route
        path="*"
        element={
          <NotFoundPage />
        }
      />
    </Routes>
  );
}