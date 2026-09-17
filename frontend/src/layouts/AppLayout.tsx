import {
  BarChart3,
  BrainCircuit,
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileBarChart2,
  LayoutDashboard,
  LogOut,
  Menu,
  Network,
  Settings2,
  ShieldCheck,
  Target,
  UserRoundCheck,
  UsersRound,
  BookOpen,
  Users,
  FileText,
  X,
  Bell,
  CreditCard,
  PlugZap,
  CalendarClock,
  LifeBuoy,
  Layers3,
  type LucideProps,
} from "lucide-react";

import {
  NavLink,
  Outlet,
  useNavigate,
} from "react-router-dom";

import {
  useState,
  type ComponentType,
  type ReactNode,
} from "react";

import { useAuth } from "../auth";
import { Logo } from "../components/ui";

type NavigationIcon = ComponentType<LucideProps>;

interface NavigationItem {
  label: string;
  path: string;
  icon: NavigationIcon;
  roles?: string[];
}

/* -------------------------------------------------------------------------- */
/* Workspace Navigation                                                       */
/* -------------------------------------------------------------------------- */

const workspaceNavigation: NavigationItem[] = [
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Organizations",
    path: "/admin/organizations",
    icon: Building2,
    roles: ["PLATFORM_ADMIN"],
  },
  {
    label: "Assessments",
    path: "/assessments",
    icon: ClipboardCheck,
  },
  {
    label: "My Team",
    path: "/manager/team",
    icon: Users,
    roles: ["MANAGER"],
  },
  {
    label: "Corroborations",
    path: "/manager-corroborations",
    icon: UserRoundCheck,
    roles: ["MANAGER"],
  },
  {
    label: "Role Profiles",
    path: "/role-profiles",
    icon: Target,
  },
  {
    label: "Career Paths",
    path: "/career-paths",
    icon: Network,
  },
  {
    label: "Self Assessments",
    path: "/self-assessments",
    icon: UserRoundCheck,
  },
  {
    label: "Reports & Gaps",
    path: "/reports",
    icon: FileBarChart2,
    roles: ["MANAGER", "STAFF"],
  },
  {
    label: "Learning Resources",
    path: "/learning-resources",
    icon: BookOpen,
  },
];

/* -------------------------------------------------------------------------- */
/* Administration Navigation                                                  */
/* -------------------------------------------------------------------------- */

const administrationNavigation: NavigationItem[] = [
  {
    label: "Organization",
    path: "/admin/organization",
    icon: Building2,
    roles: ["ORGANIZATION_ADMIN"],
  },
  {
    label: "Invitations",
    path: "/admin/invitations",
    icon: UserRoundCheck,
    roles: ["ORGANIZATION_ADMIN"],
  },
  {
    label: "Users",
    path: "/admin/users",
    icon: Users,
    roles: ["ORGANIZATION_ADMIN"],
  },
  {
    label: "Analytics",
    path: "/admin/analytics",
    icon: BarChart3,
  },
  {
    label: "AI Review",
    path: "/admin/ai-review",
    icon: BrainCircuit,
  },
  {
    label: "Audit Logs",
    path: "/admin/audit",
    icon: ShieldCheck,
  },
  { label: "Framework", path: "/admin/framework", icon: Layers3, roles: ["PLATFORM_ADMIN", "ORGANIZATION_ADMIN"] },
  { label: "Skill Library", path: "/admin/organization/skills", icon: Target, roles: ["ORGANIZATION_ADMIN"] },
  { label: "Organization Structure", path: "/admin/organization/structure", icon: Network, roles: ["ORGANIZATION_ADMIN"] },
  { label: "Billing", path: "/admin/billing", icon: CreditCard, roles: ["ORGANIZATION_ADMIN"] },
  { label: "Integrations", path: "/admin/integrations", icon: PlugZap, roles: ["ORGANIZATION_ADMIN"] },
  { label: "Scheduled Reports", path: "/admin/scheduled-reports", icon: CalendarClock, roles: ["ORGANIZATION_ADMIN"] },
];

/* -------------------------------------------------------------------------- */
/* Account Navigation                                                         */
/* -------------------------------------------------------------------------- */

const accountNavigation: NavigationItem[] = [
  { label: "Notifications", path: "/notifications", icon: Bell },
  { label: "Support", path: "/support", icon: LifeBuoy },
  { label: "Security", path: "/security", icon: ShieldCheck },
  { label: "Settings", path: "/settings", icon: Settings2 },
];

/* -------------------------------------------------------------------------- */
/* App Layout                                                                 */
/* -------------------------------------------------------------------------- */

export function AppLayout() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-ink text-slate-100">
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        isAdmin={isAdmin}
        user={user}
        onCollapse={() => setCollapsed((value) => !value)}
        onCloseMobile={() => setMobileOpen(false)}
        onLogout={handleLogout}
      />

      <div
        className={[
          "min-h-screen transition-[padding] duration-200",
          collapsed ? "lg:pl-[84px]" : "lg:pl-72",
        ].join(" ")}
      >
        <TopBar
          user={user}
          onOpenMobile={() => setMobileOpen(true)}
        />

        <main>
          <div className="mx-auto w-full max-w-[1500px] p-5 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Sidebar                                                                    */
/* -------------------------------------------------------------------------- */

interface SidebarUser {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
}

interface SidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  isAdmin: boolean;
  user: SidebarUser | null;
  onCollapse: () => void;
  onCloseMobile: () => void;
  onLogout: () => void;
}

function Sidebar({
  collapsed,
  mobileOpen,
  isAdmin,
  user,
  onCollapse,
  onCloseMobile,
  onLogout,
}: SidebarProps) {
  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 flex flex-col",
          "border-r border-line bg-[#081422]",
          "transition-all duration-200",
          "w-72",
          collapsed ? "lg:w-[84px]" : "",
          mobileOpen
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0",
        ].join(" ")}
      >
        <SidebarHeader
          collapsed={collapsed}
          onCloseMobile={onCloseMobile}
        />

        <nav className="scrollbar flex-1 overflow-y-auto px-4 py-5">
          <NavigationGroup
            label="Workspace"
            items={workspaceNavigation}
            collapsed={collapsed}
            onNavigate={onCloseMobile}
            userRole={user?.role}
          />

          {isAdmin && (
            <NavigationGroup
              label="Administration"
              items={administrationNavigation}
              collapsed={collapsed}
              onNavigate={onCloseMobile}
              userRole={user?.role}
            />
          )}

          <NavigationGroup
            label="Account"
            items={accountNavigation}
            collapsed={collapsed}
            onNavigate={onCloseMobile}
            userRole={user?.role}
          />
        </nav>

        <SidebarFooter
          collapsed={collapsed}
          user={user}
          onLogout={onLogout}
        />

        <button
          type="button"
          aria-label={
            collapsed
              ? "Expand navigation"
              : "Collapse navigation"
          }
          onClick={onCollapse}
          className="absolute -right-3 top-24 hidden h-7 w-7 place-items-center rounded-full border border-line bg-panel text-slate-500 shadow-lg transition hover:text-white lg:grid"
        >
          {collapsed ? (
            <ChevronRight size={14} />
          ) : (
            <ChevronLeft size={14} />
          )}
        </button>
      </aside>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Sidebar Header                                                             */
/* -------------------------------------------------------------------------- */

function SidebarHeader({
  collapsed,
  onCloseMobile,
}: {
  collapsed: boolean;
  onCloseMobile: () => void;
}) {
  return (
    <div className="flex h-20 shrink-0 items-center justify-between border-b border-line px-5">
      <Logo compact={collapsed} />

      <button
        type="button"
        aria-label="Close navigation"
        onClick={onCloseMobile}
        className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-800 hover:text-white lg:hidden"
      >
        <X size={18} />
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Navigation Group                                                           */
/* -------------------------------------------------------------------------- */

interface NavigationGroupProps {
  label: string;
  items: NavigationItem[];
  collapsed: boolean;
  onNavigate: () => void;
  userRole?: string;
}

function NavigationGroup({
  label,
  items,
  collapsed,
  onNavigate,
  userRole,
}: NavigationGroupProps) {
  const visibleItems = items.filter(
    (item) =>
      !item.roles ||
      (userRole && item.roles.includes(userRole)),
  );

  /*
   * Do not render an empty navigation group.
   *
   * This is especially useful for role-specific groups if more
   * restrictions are added in the future.
   */
  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <div className="mb-7">
      <p
        className={[
          "mb-2 px-3 text-[10px] font-bold uppercase",
          "tracking-[0.18em] text-slate-700",
          collapsed ? "text-center" : "",
        ].join(" ")}
      >
        {collapsed ? "•" : label}
      </p>

      <div className="space-y-1">
        {visibleItems.map((item) => (
          <NavigationLink
            key={item.path}
            item={item}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Navigation Link                                                            */
/* -------------------------------------------------------------------------- */

function NavigationLink({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavigationItem;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.path}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        [
          "flex items-center gap-3 rounded-xl px-3 py-2.5",
          "text-sm font-medium transition-colors",
          isActive
            ? "bg-brand-500/10 text-brand-300"
            : "text-slate-500 hover:bg-panel hover:text-slate-200",
          collapsed ? "justify-center" : "",
        ].join(" ")
      }
    >
      <Icon size={17} strokeWidth={1.8} />

      {!collapsed && (
        <span>{item.label}</span>
      )}
    </NavLink>
  );
}

/* -------------------------------------------------------------------------- */
/* Sidebar Footer                                                             */
/* -------------------------------------------------------------------------- */

function SidebarFooter({
  collapsed,
  user,
  onLogout,
}: {
  collapsed: boolean;
  user: SidebarUser | null;
  onLogout: () => void;
}) {
  const initials = `${user?.firstName?.[0] ?? "S"}${
    user?.lastName?.[0] ?? "F"
  }`;

  const role = user?.role
    ?.replaceAll("_", " ")
    .toLowerCase();

  return (
    <div className="shrink-0 border-t border-line p-4">
      <div
        className={[
          "mb-3 flex items-center gap-3 rounded-xl bg-panel p-3",
          collapsed ? "justify-center" : "",
        ].join(" ")}
      >
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-500/15 text-xs font-bold text-brand-300">
          {initials}
        </div>

        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              {user?.firstName} {user?.lastName}
            </p>

            <p className="mt-0.5 truncate text-[10px] uppercase tracking-wide text-slate-600">
              {role}
            </p>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onLogout}
        className={[
          "flex w-full items-center gap-3 rounded-xl",
          "px-3 py-2.5 text-sm text-slate-500",
          "transition hover:bg-slate-800 hover:text-white",
          collapsed ? "justify-center" : "",
        ].join(" ")}
      >
        <LogOut size={17} />

        {!collapsed && (
          <span>Sign out</span>
        )}
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Top Bar                                                                    */
/* -------------------------------------------------------------------------- */

function TopBar({
  user,
  onOpenMobile,
}: {
  user: SidebarUser | null;
  onOpenMobile: () => void;
}) {
  const initials = `${user?.firstName?.[0] ?? "S"}${
    user?.lastName?.[0] ?? "F"
  }`;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center border-b border-line bg-ink/85 px-5 backdrop-blur-xl lg:px-8">
      <button
        type="button"
        aria-label="Open navigation"
        onClick={onOpenMobile}
        className="rounded-xl border border-line bg-panel p-2 text-slate-400 transition hover:text-white lg:hidden"
      >
        <Menu size={18} />
      </button>

      <div className="hidden text-xs text-slate-600 lg:block">
        Skills intelligence workspace
      </div>

      <div className="ml-auto flex items-center gap-3">
        <span className="hidden max-w-[260px] truncate text-xs text-slate-500 sm:block">
          {user?.email}
        </span>

        <div className="grid h-8 w-8 place-items-center rounded-full bg-brand-500/15 text-[10px] font-bold text-brand-300">
          {initials}
        </div>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Auth Shell                                                                 */
/* -------------------------------------------------------------------------- */

export function AuthShell({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-ink text-slate-100">
      <header className="border-b border-line px-5 py-5">
        <div className="mx-auto max-w-6xl">
          <Logo />
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}