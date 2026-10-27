"use client";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Label,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Icon } from "./icons";

const GREEN = "#157a4e";
const MINT = "#2a9d73";
const GOLD = "#c5a253";
const COLORS = [GREEN, GOLD, MINT, "#64748b", "#0ea5e9", "#f59e0b", "#ef4444", "#8b5cf6"];
const STATUS_COLORS: Record<string, string> = {
  Actifs: GREEN,
  "Bientôt expirés": GOLD,
  Expirés: "#dc5252",
};
const DOT_COLORS: Record<string, string> = {
  [GREEN]: "bg-[#157a4e]",
  [GOLD]: "bg-[#c5a253]",
  [MINT]: "bg-[#2a9d73]",
  "#64748b": "bg-[#64748b]",
  "#0ea5e9": "bg-[#0ea5e9]",
  "#f59e0b": "bg-[#f59e0b]",
  "#ef4444": "bg-[#ef4444]",
  "#8b5cf6": "bg-[#8b5cf6]",
};
const AXIS = { fill: "#64748b", fontSize: 11 };
const GRID = "rgba(100,116,139,0.16)";
const NUMBER = new Intl.NumberFormat("fr-FR");

type TipEntry = { name?: string; value?: number | string; color?: string };
type Insight = { title: string; detail: string; tone?: "green" | "gold" | "rose" | "slate" };

function formatMonth(value: string) {
  if (!/^\d{4}-\d{2}$/.test(value)) return value;
  const date = new Date(`${value}-01T12:00:00.000Z`);
  return new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" }).format(date).replace(".", "");
}

function formatDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(`${value}T12:00:00.000Z`);
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(date);
}

function formatTipLabel(value: string | number) {
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${text}T12:00:00.000Z`));
  if (/^\d{4}-\d{2}$/.test(text)) return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${text}-01T12:00:00.000Z`));
  return text;
}

function ChartTip({ active, payload, label }: { active?: boolean; payload?: TipEntry[]; label?: string | number }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-xs shadow-xl dark:border-slate-700 dark:bg-slate-900">
      {label !== undefined && <p className="mb-2 font-semibold text-slate-800 dark:text-white">{formatTipLabel(label)}</p>}
      <div className="space-y-1.5">
        {payload.map((entry, index) => (
          <p key={`${entry.name}-${index}`} className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <span className={`h-2 w-2 rounded-full ${DOT_COLORS[entry.color ?? GREEN] ?? "bg-slate-500"}`} />
            <span>{entry.name}</span>
            <strong className="ml-auto pl-4 tabular-nums text-slate-900 dark:text-white">{typeof entry.value === "number" ? NUMBER.format(entry.value) : entry.value}</strong>
          </p>
        ))}
      </div>
    </div>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const tone = {
    green: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200",
    gold: "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200",
    rose: "border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200",
    slate: "border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200",
  }[insight.tone ?? "green"];
  return (
    <div className={`mt-4 flex gap-3 rounded-2xl border p-3.5 ${tone}`}>
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/80 text-brand-700 shadow-sm dark:bg-black/20 dark:text-emerald-300">
        <Icon name="sparkles" className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] opacity-65">Interprétation automatique</p>
        <p className="mt-0.5 text-sm font-bold leading-snug">{insight.title}</p>
        <p className="mt-1 text-xs leading-relaxed opacity-80">{insight.detail}</p>
      </div>
    </div>
  );
}

function Frame({
  title,
  subtitle,
  insight,
  hasData,
  children,
}: {
  title: string;
  subtitle: string;
  insight: Insight;
  hasData: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="card overflow-hidden p-4 sm:p-5" aria-label={title}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-600/10 text-brand-700 dark:bg-brand-400/10 dark:text-brand-300">
            <Icon name="chart" className="h-4 w-4" />
          </span>
          <div>
            <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{subtitle}</p>
          </div>
        </div>
        <span className="mt-1 h-1.5 w-8 shrink-0 rounded-full bg-gradient-to-r from-brand-600 to-gold-400" />
      </div>
      {hasData ? (
        <div className="h-64 w-full min-w-0 sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            {children as React.ReactElement}
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="grid h-64 place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 text-center dark:border-slate-700 dark:bg-slate-900/40 sm:h-72">
          <div>
            <span className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <Icon name="chart" className="h-4 w-4" />
            </span>
            <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Pas encore de données</p>
            <p className="mt-1 text-xs text-slate-500">Le graphique apparaîtra dès les premiers enregistrements de cette période.</p>
          </div>
        </div>
      )}
      <InsightCard insight={insight} />
    </section>
  );
}

function trendInsight(recent: number, previous: number, period: string): Insight {
  if (recent === 0 && previous === 0) return { title: `Aucune visite enregistrée ${period}`, detail: "Les courbes seront plus parlantes une fois des passages enregistrés.", tone: "slate" };
  if (previous === 0) return { title: `${NUMBER.format(recent)} visite(s) dans la période récente`, detail: "Il n'y a pas encore assez d'historique pour comparer avec la période précédente.", tone: "gold" };
  const change = Math.round(((recent - previous) / previous) * 100);
  if (Math.abs(change) < 5) return { title: `Fréquentation stable ${period}`, detail: `${NUMBER.format(recent)} visite(s) récemment, contre ${NUMBER.format(previous)} sur la période précédente.`, tone: "slate" };
  const up = change > 0;
  return {
    title: `Fréquentation en ${up ? "hausse" : "baisse"} de ${Math.abs(change)} % ${period}`,
    detail: `${NUMBER.format(recent)} visite(s) récemment, contre ${NUMBER.format(previous)} auparavant.`,
    tone: up ? "green" : "gold",
  };
}

export function DailyChart({ data }: { data: { d: string; abonnes: number; visiteurs: number }[] }) {
  const total = data.reduce((sum, row) => sum + row.abonnes + row.visiteurs, 0);
  const memberTotal = data.reduce((sum, row) => sum + row.abonnes, 0);
  const visitorTotal = data.reduce((sum, row) => sum + row.visiteurs, 0);
  const peak = data.reduce<(typeof data)[number] | null>((best, row) => !best || row.abonnes + row.visiteurs > best.abonnes + best.visiteurs ? row : best, null);
  const half = Math.floor(data.length / 2);
  const previous = data.slice(0, half).reduce((sum, row) => sum + row.abonnes + row.visiteurs, 0);
  const recent = data.slice(half).reduce((sum, row) => sum + row.abonnes + row.visiteurs, 0);
  const trend = trendInsight(recent, previous, "sur la période récente");
  const insight: Insight = total === 0
    ? trend
    : {
        ...trend,
        detail: `${NUMBER.format(total)} visite(s) au total : ${NUMBER.format(memberTotal)} abonné(s) et ${NUMBER.format(visitorTotal)} visiteur(s). ${peak ? `Pic le ${formatDay(peak.d)} avec ${NUMBER.format(peak.abonnes + peak.visiteurs)} passage(s).` : ""}`,
      };
  return (
    <Frame title="Fréquentation quotidienne" subtitle="Visites par jour · 30 derniers jours" insight={insight} hasData={total > 0}>
      <AreaChart data={data} margin={{ top: 6, right: 8, left: -12, bottom: 4 }}>
        <defs>
          <linearGradient id="daily-members-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={GREEN} stopOpacity={0.28} /><stop offset="100%" stopColor={GREEN} stopOpacity={0.015} /></linearGradient>
          <linearGradient id="daily-visitors-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={GOLD} stopOpacity={0.3} /><stop offset="100%" stopColor={GOLD} stopOpacity={0.015} /></linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 6" stroke={GRID} vertical={false} />
        <XAxis dataKey="d" tick={AXIS} tickFormatter={formatDay} interval={Math.max(0, Math.ceil(data.length / 6) - 1)} axisLine={false} tickLine={false} tickMargin={10} />
        <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} width={42} />
        <Tooltip content={<ChartTip />} cursor={{ stroke: "rgba(100,116,139,0.4)", strokeDasharray: "4 4" }} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
        <Area type="monotone" dataKey="abonnes" name="Abonnés" stroke={GREEN} strokeWidth={2.5} fill="url(#daily-members-fill)" activeDot={{ r: 5, strokeWidth: 0 }} />
        <Area type="monotone" dataKey="visiteurs" name="Visiteurs" stroke={GOLD} strokeWidth={2.5} fill="url(#daily-visitors-fill)" activeDot={{ r: 5, strokeWidth: 0 }} />
      </AreaChart>
    </Frame>
  );
}

export function MonthlyChart({ data }: { data: { m: string; total: number }[] }) {
  const total = data.reduce((sum, row) => sum + row.total, 0);
  const peak = data.reduce<(typeof data)[number] | null>((best, row) => !best || row.total > best.total ? row : best, null);
  const average = data.length ? Math.round(total / data.length) : 0;
  const insight: Insight = total === 0
    ? { title: "Aucune visite sur les 12 derniers mois", detail: "Les mois sans enregistrement sont affichés à zéro pour faciliter la comparaison.", tone: "slate" }
    : { title: peak ? `${formatMonth(peak.m)} est le mois le plus fréquenté` : "Évolution mensuelle", detail: `${NUMBER.format(total)} visite(s) sur 12 mois, soit environ ${NUMBER.format(average)} par mois. ${peak ? `${NUMBER.format(peak.total)} visite(s) en ${formatMonth(peak.m)}.` : ""}`, tone: "green" };
  return (
    <Frame title="Évolution mensuelle" subtitle="Comparaison des 12 derniers mois · les mois vides valent zéro" insight={insight} hasData={total > 0}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 6" stroke={GRID} vertical={false} />
        <XAxis dataKey="m" tick={AXIS} tickFormatter={formatMonth} interval={1} axisLine={false} tickLine={false} tickMargin={10} />
        <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} width={42} />
        <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(21,122,78,0.07)" }} />
        <Bar dataKey="total" name="Visites" fill={GREEN} radius={[8, 8, 3, 3]} maxBarSize={40} />
      </BarChart>
    </Frame>
  );
}

export function YearlyChart({ data }: { data: { y: string; total: number }[] }) {
  const total = data.reduce((sum, row) => sum + row.total, 0);
  const peak = data.reduce<(typeof data)[number] | null>((best, row) => !best || row.total > best.total ? row : best, null);
  const insight: Insight = total === 0
    ? { title: "Aucune visite sur la période affichée", detail: "Les années sans passage restent visibles avec une valeur nulle.", tone: "slate" }
    : { title: peak ? `${peak.y} est l'année avec le plus de visites` : "Fréquentation annuelle", detail: `${NUMBER.format(total)} visite(s) sur les ${data.length} dernières années. ${peak ? `${NUMBER.format(peak.total)} visite(s) en ${peak.y}.` : ""} L'année en cours peut être incomplète.`, tone: "gold" };
  return (
    <Frame title="Évolution annuelle" subtitle="Visites par année · jusqu'à 6 années" insight={insight} hasData={total > 0}>
      <LineChart data={data} margin={{ top: 12, right: 16, left: -12, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 6" stroke={GRID} vertical={false} />
        <XAxis dataKey="y" tick={AXIS} axisLine={false} tickLine={false} tickMargin={10} />
        <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} width={42} />
        <Tooltip content={<ChartTip />} cursor={{ stroke: "rgba(100,116,139,0.4)", strokeDasharray: "4 4" }} />
        <Line type="monotone" dataKey="total" name="Visites" stroke={GOLD} strokeWidth={3} dot={{ r: 4, fill: GOLD, strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 0 }} />
      </LineChart>
    </Frame>
  );
}

export function SplitPie({ data }: { data: { name: string; value: number }[] }) {
  const total = data.reduce((sum, row) => sum + row.value, 0);
  const leader = [...data].sort((a, b) => b.value - a.value)[0];
  const leaderPercent = total && leader ? Math.round((leader.value / total) * 100) : 0;
  const insight: Insight = total === 0
    ? { title: "Aucune visite aujourd'hui", detail: "La répartition apparaîtra dès le premier passage enregistré.", tone: "slate" }
    : { title: `${leader?.name ?? "Aucun groupe"} : ${leaderPercent} % des visites du jour`, detail: data.map((row) => `${row.name.toLowerCase()} : ${NUMBER.format(row.value)}`).join(" · "), tone: leader?.name === "Abonnés" ? "green" : "gold" };
  return (
    <Frame title="Qui fréquente la bibliothèque ?" subtitle="Part des abonnés et visiteurs · aujourd'hui" insight={insight} hasData={total > 0}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={62} outerRadius={94} paddingAngle={3} cornerRadius={5} labelLine={false} label={({ name, percent }) => `${name} ${Math.round((percent ?? 0) * 100)} %`}>
          {data.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} stroke="none" />)}
          <Label position="center" content={({ viewBox }) => {
            const box = viewBox as { cx?: number; cy?: number } | undefined;
            return box?.cx !== undefined && box.cy !== undefined ? (
              <g><text x={box.cx} y={box.cy - 4} textAnchor="middle" className="fill-slate-900 dark:fill-white" fontSize="22" fontWeight="700">{NUMBER.format(total)}</text><text x={box.cx} y={box.cy + 15} textAnchor="middle" className="fill-slate-500 dark:fill-slate-400" fontSize="10">visites</text></g>
            ) : null;
          }} />
        </Pie>
        <Tooltip content={<ChartTip />} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </Frame>
  );
}

export function ReasonsChart({ data }: { data: { reason: string; total: number }[] }) {
  const total = data.reduce((sum, row) => sum + row.total, 0);
  const top = data[0];
  const share = total && top ? Math.round((top.total / total) * 100) : 0;
  const insight: Insight = total === 0
    ? { title: "Aucun motif de visite enregistré", detail: "Le classement s'actualise à partir des motifs saisis à l'accueil.", tone: "slate" }
    : { title: top ? `Motif principal : ${top.reason}` : "Motifs de visite", detail: `${NUMBER.format(top?.total ?? 0)} visite(s), soit ${share} % des motifs affichés. Le graphique présente les huit motifs les plus fréquents.`, tone: "gold" };
  return (
    <Frame title="Pourquoi les personnes viennent ?" subtitle="Les huit motifs les plus fréquents" insight={insight} hasData={total > 0}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 18, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 6" stroke={GRID} horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="reason" width={125} tick={AXIS} tickFormatter={(value: string) => value.length > 19 ? `${value.slice(0, 18)}…` : value} axisLine={false} tickLine={false} />
        <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(197,162,83,0.08)" }} />
        <Bar dataKey="total" name="Visites" fill={GOLD} radius={[0, 8, 8, 0]} maxBarSize={22} />
      </BarChart>
    </Frame>
  );
}

export function StatusChart({ data }: { data: { name: string; value: number }[] }) {
  const total = data.reduce((sum, row) => sum + row.value, 0);
  const active = data.find((row) => row.name === "Actifs")?.value ?? 0;
  const percent = total ? Math.round((active / total) * 100) : 0;
  const expiring = data.find((row) => row.name === "Bientôt expirés")?.value ?? 0;
  const expired = data.find((row) => row.name === "Expirés")?.value ?? 0;
  const insight: Insight = total === 0
    ? { title: "Aucun abonnement à analyser", detail: "Ajoutez ou synchronisez des abonnés pour afficher leur statut.", tone: "slate" }
    : { title: `${percent} % des abonnements affichés sont actifs`, detail: `${NUMBER.format(active)} actif(s) · ${NUMBER.format(expiring)} bientôt à renouveler · ${NUMBER.format(expired)} expiré(s).`, tone: expiring + expired > active ? "rose" : "green" };
  return (
    <Frame title="État des abonnements" subtitle="Actifs, à renouveler prochainement ou expirés" insight={insight} hasData={total > 0}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 6" stroke={GRID} vertical={false} />
        <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} tickMargin={10} />
        <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} width={42} />
        <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(21,122,78,0.07)" }} />
        <Bar dataKey="value" name="Abonnés" radius={[8, 8, 3, 3]} maxBarSize={54}>
          {data.map((row, index) => <Cell key={`${row.name}-${index}`} fill={STATUS_COLORS[row.name] ?? COLORS[index % COLORS.length]} />)}
        </Bar>
      </BarChart>
    </Frame>
  );
}
