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
const PALETTE = ["#157a4e", "#c5a253", "#2a9d73", "#64748b", "#0ea5e9", "#f59e0b", "#ef4444", "#8b5cf6"];
const AXIS = { fill: "#94a3b8", fontSize: 11 };
const GRID = "rgba(148,163,184,0.18)";

type TipEntry = { name?: string; value?: number | string; color?: string };

function ChartTip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TipEntry[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white/95 px-3 py-2 text-[11px] shadow-xl backdrop-blur dark:border-white/10 dark:bg-[#0c1a13]/95">
      {label !== undefined && <p className="mb-1 font-semibold text-slate-700 dark:text-slate-200">{label}</p>}
      {payload.map((entry, i) => (
        <p key={i} className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: entry.color ?? GREEN }} />
          <span>{entry.name}</span>
          <span className="ml-auto pl-3 font-semibold text-slate-800 dark:text-slate-100">{entry.value}</span>
        </p>
      ))}
    </div>
  );
}

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-600/10 text-brand-700 dark:bg-brand-400/10 dark:text-brand-300">
            <Icon name="chart" className="h-3.5 w-3.5" />
          </span>
          <h3 className="font-display text-[13.5px] font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
        </div>
        <span className="h-1 w-5 rounded-full bg-gradient-to-r from-gold-500 to-gold-300" />
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {children as React.ReactElement}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function DailyChart({ data }: { data: { d: string; abonnes: number; visiteurs: number }[] }) {
  return (
    <Frame title="Fréquentation quotidienne · 30 derniers jours">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="gradAbonnes" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={GREEN} stopOpacity={0.32} />
            <stop offset="100%" stopColor={GREEN} stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="gradVisiteurs" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={GOLD} stopOpacity={0.3} />
            <stop offset="100%" stopColor={GOLD} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 6" stroke={GRID} vertical={false} />
        <XAxis dataKey="d" tick={AXIS} axisLine={false} tickLine={false} dy={6} />
        <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} width={32} />
        <Tooltip content={<ChartTip />} cursor={{ stroke: "rgba(148,163,184,0.35)", strokeDasharray: "4 4" }} />
        <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
        <Area type="monotone" dataKey="abonnes" name="Abonnés" stroke={GREEN} strokeWidth={2.2} fill="url(#gradAbonnes)" />
        <Area type="monotone" dataKey="visiteurs" name="Visiteurs" stroke={GOLD} strokeWidth={2.2} fill="url(#gradVisiteurs)" />
      </AreaChart>
    </Frame>
  );
}

export function MonthlyChart({ data }: { data: { m: string; total: number }[] }) {
  return (
    <Frame title="Évolution mensuelle des visites">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 6" stroke={GRID} vertical={false} />
        <XAxis dataKey="m" tick={AXIS} axisLine={false} tickLine={false} dy={6} />
        <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} width={32} />
        <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(21,122,78,0.06)" }} />
        <Bar dataKey="total" name="Visites" fill={GREEN} radius={[8, 8, 0, 0]} maxBarSize={44} />
      </BarChart>
    </Frame>
  );
}

export function YearlyChart({ data }: { data: { y: string; total: number }[] }) {
  return (
    <Frame title="Évolution annuelle">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 6" stroke={GRID} vertical={false} />
        <XAxis dataKey="y" tick={AXIS} axisLine={false} tickLine={false} dy={6} />
        <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} width={32} />
        <Tooltip content={<ChartTip />} cursor={{ stroke: "rgba(148,163,184,0.35)", strokeDasharray: "4 4" }} />
        <Line
          type="monotone"
          dataKey="total"
          name="Visites"
          stroke={GOLD}
          strokeWidth={2.8}
          dot={{ r: 3.5, fill: GOLD, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </Frame>
  );
}

export function SplitPie({ data }: { data: { name: string; value: number }[] }) {
  return (
    <Frame title="Répartition abonnés / visiteurs">
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={56}
          outerRadius={88}
          paddingAngle={4}
          cornerRadius={6}
          label
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} stroke="none" />
          ))}
        </Pie>
        <Tooltip content={<ChartTip />} />
        <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </Frame>
  );
}

export function ReasonsChart({ data }: { data: { reason: string; total: number }[] }) {
  return (
    <Frame title="Motifs de visite les plus fréquents">
      <BarChart data={data} layout="vertical" margin={{ left: 30 }}>
        <CartesianGrid strokeDasharray="3 6" stroke={GRID} horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="reason" width={160} tick={AXIS} axisLine={false} tickLine={false} />
        <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(197,162,83,0.08)" }} />
        <Bar dataKey="total" name="Visites" fill={GOLD} radius={[0, 8, 8, 0]} maxBarSize={22} />
      </BarChart>
    </Frame>
  );
}

export function StatusChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <Frame title="Abonnements par statut">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 6" stroke={GRID} vertical={false} />
        <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} dy={6} />
        <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} width={32} />
        <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(21,122,78,0.06)" }} />
        <Bar dataKey="value" name="Abonnés" radius={[8, 8, 0, 0]} maxBarSize={54}>
          {data.map((_, i) => (
            <Cell key={i} fill={i === 0 ? MINT : PALETTE[i % PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </Frame>
  );
}
