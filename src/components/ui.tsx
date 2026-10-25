import Link from "next/link";
import { STATUS_COLOR, STATUS_LABEL, type SubStatus } from "@/lib/subscriptions";
import { Icon, type IconName } from "./icons";

export function PageHeader({
  title,
  subtitle,
  eyebrow = "Salam Library Pro",
  children,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="eyebrow">
          <span className="h-1 w-6 rounded-full bg-gradient-to-r from-gold-500 to-gold-300" />
          {eyebrow}
        </p>
        <h1 className="mt-2 font-display text-[26px] font-semibold leading-tight tracking-tight text-slate-900 sm:text-[30px] dark:text-white">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">{subtitle}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function SectionHeading({
  title,
  eyebrow,
  action,
}: {
  title: string;
  eyebrow?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 className="mt-1 font-display text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

const TONES: Record<string, string> = {
  green:
    "bg-brand-600/10 text-brand-700 ring-brand-600/15 dark:bg-brand-400/10 dark:text-brand-300 dark:ring-brand-400/20",
  gold:
    "bg-gold-500/15 text-gold-700 ring-gold-600/20 dark:bg-gold-400/10 dark:text-gold-300 dark:ring-gold-400/20",
  amber:
    "bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/20",
  rose:
    "bg-rose-500/10 text-rose-600 ring-rose-500/20 dark:bg-rose-400/10 dark:text-rose-300 dark:ring-rose-400/20",
  slate:
    "bg-slate-500/10 text-slate-600 ring-slate-500/15 dark:bg-slate-400/10 dark:text-slate-300 dark:ring-slate-400/20",
};

export function StatCard({
  label,
  value,
  icon,
  tone = "green",
  href,
  hint,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  tone?: "green" | "gold" | "amber" | "rose" | "slate";
  href?: string;
  hint?: string;
}) {
  const content = (
    <div className="group relative overflow-hidden rounded-2xl border border-brand-900/[0.07] bg-[var(--surface)]/80 p-4 shadow-soft backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:shadow-lift dark:border-white/[0.08] dark:bg-white/[0.03] dark:shadow-none">
      <div className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-gold-400/10 opacity-0 blur-2xl transition group-hover:opacity-100" />
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10.5px] font-semibold uppercase leading-snug tracking-[0.12em] text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ring-1 ${TONES[tone]}`}>
          {icon}
        </span>
      </div>
      <p className="mt-3 font-display text-[28px] font-semibold leading-none tracking-tight text-slate-900 dark:text-white">
        {value}
      </p>
      {hint && <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">{hint}</p>}
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded-2xl focus-visible:outline-offset-4">
      {content}
    </Link>
  ) : (
    content
  );
}

export function StatCardIcon({ name }: { name: IconName }) {
  return <Icon name={name} className="h-[18px] w-[18px]" />;
}

export function StatusBadge({ status }: { status: SubStatus }) {
  return <span className={`badge ${STATUS_COLOR[status]}`}>{STATUS_LABEL[status]}</span>;
}

export function ReportHeader({ title, period }: { title: string; period?: string }) {
  return (
    <div className="mb-4 hidden items-center gap-4 border-b-2 border-brand-700 pb-3 print:flex">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="Logo" width={56} height={56} className="rounded-xl" />
      <div>
        <p className="text-lg font-bold text-brand-800">Bibliothèque de la Mosquée Salam du Plateau</p>
        <p className="text-sm">{title}</p>
        {period && <p className="text-xs">Période : {period}</p>}
        <p className="text-xs">Généré le {new Date().toLocaleString("fr-FR")}</p>
      </div>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="card flex flex-col items-center gap-3 border-dashed py-10 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-600/10 text-brand-700 dark:bg-brand-400/10 dark:text-brand-300">
        <Icon name="book" className="h-5 w-5" />
      </span>
      <p className="text-sm text-slate-500 dark:text-slate-400">{message}</p>
    </div>
  );
}
