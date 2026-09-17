import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from "react";

import type { LucideIcon } from "lucide-react";

import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Search,
  SlidersHorizontal,
} from "lucide-react";

import logo from "../assets/logo.png"

/* -------------------------------------------------------------------------- */
/* Logo                                                                       */
/* -------------------------------------------------------------------------- */

export function Logo({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-500 text-sm font-black text-slate-950">
        <img src={logo} alt="SkillForge" className="h-full w-full" />
      </div>

      {!compact && (
        <span className="text-lg font-bold tracking-tight text-white">
          Skill<span className="text-brand-400">Forge</span>
        </span>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Page Header                                                                */
/* -------------------------------------------------------------------------- */

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({
  eyebrow = "Workspace",
  title,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <header className="flex flex-col justify-between gap-5 md:flex-row md:items-end mb-5">
      <div className="min-w-0">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-400">
          {eyebrow}
        </p>

        <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
          {title}
        </h1>

        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Card                                                                       */
/* -------------------------------------------------------------------------- */

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
}

export function Card({
  children,
  className = "",
  padding = "md",
}: CardProps) {
  const paddingClasses = {
    none: "",
    sm: "p-4",
    md: "p-5",
    lg: "p-6",
  };

  return (
    <div
      className={[
        "rounded-2xl border border-line bg-panel",
        paddingClasses[padding],
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Stat Card                                                                  */
/* -------------------------------------------------------------------------- */

interface StatCardProps {
  label: string;
  value: ReactNode;
  sub?: string;
  icon?: LucideIcon;
  trend?: string;
}

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  trend,
}: StatCardProps) {
  return (
    <Card padding="md">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {label}
          </p>

          <p className="mt-3 truncate text-2xl font-bold text-white">
            {value}
          </p>

          {sub && (
            <p className="mt-1 text-xs text-slate-600">
              {sub}
            </p>
          )}
        </div>

        {Icon && (
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-300">
            <Icon size={19} />
          </div>
        )}
      </div>

      {trend && (
        <p className="mt-4 text-xs font-medium text-emerald-400">
          {trend}
        </p>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Badge                                                                      */
/* -------------------------------------------------------------------------- */

export type BadgeTone =
  | "slate"
  | "green"
  | "amber"
  | "red"
  | "blue";

interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
}

export function Badge({
  children,
  tone = "slate",
}: BadgeProps) {
  const styles: Record<BadgeTone, string> = {
    slate:
      "border-slate-700 bg-slate-800/70 text-slate-300",
    green:
      "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    amber:
      "border-amber-500/20 bg-amber-500/10 text-amber-300",
    red:
      "border-red-500/20 bg-red-500/10 text-red-300",
    blue:
      "border-brand-500/20 bg-brand-500/10 text-brand-300",
  };

  return (
    <span
      className={[
        "inline-flex items-center rounded-full border",
        "px-2.5 py-1",
        "text-[10px] font-bold uppercase tracking-wide",
        styles[tone],
      ].join(" ")}
    >
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Loading                                                                    */
/* -------------------------------------------------------------------------- */

export function Loading({
  label = "Loading...",
}: {
  label?: string;
}) {
  return (
    <div className="flex min-h-[240px] items-center justify-center">
      <div className="flex items-center gap-2.5 text-sm text-slate-500">
        <Loader2
          size={17}
          className="animate-spin text-brand-400"
        />

        <span>{label}</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Error State                                                                */
/* -------------------------------------------------------------------------- */

interface ErrorStateProps {
  text?: string;
  title?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Something went wrong",
  text = "Unable to load this information.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
      <div className="flex gap-3">
        <AlertCircle
          size={18}
          className="mt-0.5 shrink-0 text-red-300"
        />

        <div>
          <p className="text-sm font-semibold text-red-200">
            {title}
          </p>

          <p className="mt-1 text-sm leading-6 text-red-200/60">
            {text}
          </p>

          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 text-xs font-semibold text-red-200 underline underline-offset-2 hover:text-white"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Empty State                                                                */
/* -------------------------------------------------------------------------- */

interface EmptyStateProps {
  title: string;
  text?: string;
  action?: ReactNode;
}

export function EmptyState({
  title,
  text,
  action,
}: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-panel/30 p-10 text-center">
      <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-slate-800 text-slate-500">
        <Search size={18} />
      </div>

      <h3 className="mt-4 text-sm font-semibold text-white">
        {title}
      </h3>

      {text && (
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
          {text}
        </p>
      )}

      {action && (
        <div className="mt-5">
          {action}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Section                                                                    */
/* -------------------------------------------------------------------------- */

interface SectionProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Section({
  title,
  description,
  actions,
  children,
  className = "",
}: SectionProps) {
  return (
    <section className={className}>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-white">
            {title}
          </h2>

          {description && (
            <p className="mt-1 text-xs leading-5 text-slate-600">
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div className="shrink-0">
            {actions}
          </div>
        )}
      </div>

      {children}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Toolbar                                                                    */
/* -------------------------------------------------------------------------- */

interface ToolbarProps {
  search?: string;
  onSearch?: (value: string) => void;
  placeholder?: string;
  filters?: ReactNode;
}

export function Toolbar({
  search = "",
  onSearch,
  placeholder = "Search...",
  filters,
}: ToolbarProps) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
        />

        <input
          type="search"
          value={search}
          onChange={(event) =>
            onSearch?.(event.target.value)
          }
          placeholder={placeholder}
          className="field pl-9"
        />
      </div>

      {filters && (
        <div className="flex items-center gap-2">
          <SlidersHorizontal
            size={15}
            className="shrink-0 text-slate-600"
          />

          {filters}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Input                                                                      */
/* -------------------------------------------------------------------------- */

interface InputProps
  extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Input({
  label,
  error,
  hint,
  id,
  className = "",
  ...props
}: InputProps) {
  const inputId =
    id ?? props.name ?? `input-${Math.random()}`;

  return (
    <label className="block" htmlFor={inputId}>
      {label && (
        <span className="mb-2 block text-xs font-semibold text-slate-400">
          {label}
        </span>
      )}

      <input
        {...props}
        id={inputId}
        className={[
          "field",
          error
            ? "border-red-500/50 focus:border-red-400"
            : "",
          className,
        ].join(" ")}
      />

      {error && (
        <span className="mt-1.5 block text-xs text-red-300">
          {error}
        </span>
      )}

      {!error && hint && (
        <span className="mt-1.5 block text-xs text-slate-600">
          {hint}
        </span>
      )}
    </label>
  );
}

/* -------------------------------------------------------------------------- */
/* Button                                                                     */
/* -------------------------------------------------------------------------- */

type ButtonVariant =
  | "primary"
  | "secondary"
  | "danger"
  | "ghost";

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
}

export function Button({
  children,
  variant = "primary",
  loading = false,
  disabled,
  className = "",
  ...props
}: ButtonProps) {
  const variants: Record<ButtonVariant, string> = {
    primary:
      "btn-primary",
    secondary:
      "btn-secondary",
    danger:
      "inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50",
    ghost:
      "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-panel hover:text-white disabled:cursor-not-allowed disabled:opacity-50",
  };

  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={[
        variants[variant],
        className,
      ].join(" ")}
    >
      {loading && (
        <Loader2
          size={15}
          className="animate-spin"
        />
      )}

      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Success Message                                                            */
/* -------------------------------------------------------------------------- */

export function SuccessMessage({
  text,
}: {
  text: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-300">
      <CheckCircle2 size={17} className="shrink-0" />
      <span>{text}</span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Divider                                                                    */
/* -------------------------------------------------------------------------- */

export function Divider() {
  return <div className="h-px bg-line" />;
}

/* -------------------------------------------------------------------------- */
/* Page Container                                                             */
/* -------------------------------------------------------------------------- */

export function PageContainer({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "mx-auto w-full max-w-[1500px]",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Tab                                                                        */
/* -------------------------------------------------------------------------- */

export function Tab({
  active = false,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
}) {
  return (
    <button
      type="button"
      {...props}
      className={[
        "border-b-2 px-4 py-3 text-sm font-medium transition",
        active
          ? "border-brand-400 text-brand-300"
          : "border-transparent text-slate-500 hover:text-slate-200",
      ].join(" ")}
    >
      {children}
    </button>
  );
}