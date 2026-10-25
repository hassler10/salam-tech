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

const GREEN = "#166534";
const GOLD = "#c5a253";
const PALETTE = ["#166534", "#c5a253", "#475569", "#0ea5e9", "#f59e0b", "#ef4444", "#10b981", "#8b5cf6"];

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h3 className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">{title}</h3>
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
    <Frame title="Fréquentation quotidienne (30 derniers jours)">
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="d" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Legend />
        <Area type="monotone" dataKey="abonnes" name="Abonnés" stroke={GREEN} fill={GREEN} fillOpacity={0.25} />
        <Area type="monotone" dataKey="visiteurs" name="Visiteurs" stroke={GOLD} fill={GOLD} fillOpacity={0.25} />
      </AreaChart>
    </Frame>
  );
}

export function MonthlyChart({ data }: { data: { m: string; total: number }[] }) {
  return (
    <Frame title="Évolution mensuelle des visites">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="m" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Bar dataKey="total" name="Visites" fill={GREEN} radius={[6, 6, 0, 0]} />
      </BarChart>
    </Frame>
  );
}

export function YearlyChart({ data }: { data: { y: string; total: number }[] }) {
  return (
    <Frame title="Évolution annuelle">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="y" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Line type="monotone" dataKey="total" name="Visites" stroke={GOLD} strokeWidth={3} />
      </LineChart>
    </Frame>
  );
}

export function SplitPie({ data }: { data: { name: string; value: number }[] }) {
  return (
    <Frame title="Répartition abonnés / visiteurs">
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" outerRadius={90} label>
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </Frame>
  );
}

export function ReasonsChart({ data }: { data: { reason: string; total: number }[] }) {
  return (
    <Frame title="Motifs de visite les plus fréquents">
      <BarChart data={data} layout="vertical" margin={{ left: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="reason" width={160} tick={{ fontSize: 10 }} />
        <Tooltip />
        <Bar dataKey="total" name="Visites" fill={GOLD} radius={[0, 6, 6, 0]} />
      </BarChart>
    </Frame>
  );
}

export function StatusChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <Frame title="Abonnements par statut">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Bar dataKey="value" name="Abonnés" radius={[6, 6, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </Frame>
  );
}
