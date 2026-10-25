"use client";

import { useState } from "react";
import { todayIso } from "@/lib/subscriptions";
import { Icon, type IconName } from "@/components/icons";

function isoDaysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const EXPORTS: { icon: IconName; label: string; params: Record<string, string> }[] = [
  { icon: "check", label: "Liste des abonnés actifs", params: { type: "abonnes", status: "actif" } },
  { icon: "clock", label: "Abonnements bientôt expirés", params: { type: "abonnes", status: "bientot" } },
  { icon: "alert", label: "Abonnements expirés", params: { type: "abonnes", status: "expire" } },
  { icon: "users", label: "Tous les abonnés", params: { type: "abonnes" } },
  { icon: "userPlus", label: "Rapport des visiteurs", params: { type: "visiteurs" } },
  { icon: "list", label: "Rapport des motifs de visite", params: { type: "motifs" } },
];

function Tile({ name }: { name: IconName }) {
  return (
    <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600/10 text-brand-700 ring-1 ring-brand-600/15 dark:bg-brand-400/10 dark:text-brand-300 dark:ring-brand-400/20">
      <Icon name={name} className="h-[18px] w-[18px]" />
    </span>
  );
}

export default function ReportsClient() {
  const [from, setFrom] = useState(isoDaysAgo(30));
  const [to, setTo] = useState(todayIso());
  const [personType, setPersonType] = useState("");

  const url = (params: Record<string, string>) =>
    "/api/export?" + new URLSearchParams(params).toString();

  const quick = [
    { label: "Rapport journalier", from: todayIso(), to: todayIso() },
    { label: "Rapport hebdomadaire", from: isoDaysAgo(6), to: todayIso() },
    { label: "Rapport mensuel", from: isoDaysAgo(29), to: todayIso() },
    { label: "Rapport annuel", from: `${new Date().getFullYear()}-01-01`, to: todayIso() },
  ];

  return (
    <div className="space-y-5">
      <div className="card grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div><label className="label">Du</label><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><label className="label">Au</label><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div>
          <label className="label">Type de personne</label>
          <select className="input" value={personType} onChange={(e) => setPersonType(e.target.value)}>
            <option value="">Tous</option>
            <option value="abonne">Abonnés</option>
            <option value="visiteur">Visiteurs</option>
          </select>
        </div>
        <div className="flex items-end">
          <a className="btn-primary w-full" href={url({ type: "visites", from, to, personType })}>
            <Icon name="download" className="h-4 w-4" />
            Exporter la fréquentation (CSV)
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {quick.map((q) => (
          <a key={q.label} className="card block transition duration-300 hover:-translate-y-0.5 hover:shadow-lift" href={url({ type: "visites", from: q.from, to: q.to })}>
            <Tile name="calendar" />
            <p className="mt-3 font-semibold text-slate-800 dark:text-white">{q.label}</p>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{q.from} → {q.to}</p>
          </a>
        ))}
        {EXPORTS.map((e) => (
          <a key={e.label} className="card block transition duration-300 hover:-translate-y-0.5 hover:shadow-lift" href={url(e.params)}>
            <Tile name={e.icon} />
            <p className="mt-3 font-semibold text-slate-800 dark:text-white">{e.label}</p>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Export CSV · UTF-8</p>
          </a>
        ))}
        <button className="card text-left transition duration-300 hover:-translate-y-0.5 hover:shadow-lift" onClick={() => window.print()}>
          <Tile name="printer" />
          <p className="mt-3 font-semibold text-slate-800 dark:text-white">Imprimer / exporter en PDF</p>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Impression navigateur avec logo et en-tête.</p>
        </button>
      </div>

      <p className="text-xs text-slate-500">
        Les fichiers CSV utilisent le point-virgule et l&apos;encodage UTF-8 avec BOM : ils s&apos;ouvrent directement dans Excel.
      </p>
    </div>
  );
}
