import Link from "next/link";
import { STATUS_COLOR, STATUS_LABEL, type SubStatus } from "@/lib/subscriptions";

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#14532d] dark:text-[#c5a253]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon,
  tone = "green",
  href,
}: {
  label: string;
  value: number | string;
  icon: string;
  tone?: "green" | "gold" | "amber" | "rose" | "slate";
  href?: string;
}) {
  const tones: Record<string, string> = {
    green: "from-[#166534] to-[#14532d]",
    gold: "from-[#c5a253] to-[#a9873b]",
    amber: "from-amber-500 to-amber-600",
    rose: "from-rose-500 to-rose-600",
    slate: "from-slate-500 to-slate-600",
  };
  const content = (
    <div className="card flex items-center gap-4 hover:-translate-y-0.5 hover:shadow-md">
      <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${tones[tone]} text-xl text-white`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">{value}</p>
      </div>
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

export function StatusBadge({ status }: { status: SubStatus }) {
  return <span className={`badge ${STATUS_COLOR[status]}`}>{STATUS_LABEL[status]}</span>;
}

export function ReportHeader({ title, period }: { title: string; period?: string }) {
  return (
    <div className="mb-4 hidden items-center gap-4 border-b-2 border-[#166534] pb-3 print:flex">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="Logo" width={56} height={56} />
      <div>
        <p className="text-lg font-bold text-[#14532d]">Bibliothèque de la Mosquée Salam du Plateau</p>
        <p className="text-sm">{title}</p>
        {period && <p className="text-xs">Période : {period}</p>}
        <p className="text-xs">Généré le {new Date().toLocaleString("fr-FR")}</p>
      </div>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="card text-center text-sm text-slate-500 dark:text-slate-400">{message}</div>
  );
}
