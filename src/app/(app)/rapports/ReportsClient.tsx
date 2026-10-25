"use client";

import { useState } from "react";
import { todayIso } from "@/lib/subscriptions";

function isoDaysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
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
          <a className="btn-primary w-full" href={url({ type: "visites", from, to, personType })}>⬇️ Exporter la fréquentation (CSV)</a>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {quick.map((q) => (
          <a key={q.label} className="card block hover:-translate-y-0.5 hover:shadow-md" href={url({ type: "visites", from: q.from, to: q.to })}>
            <p className="text-lg">🧾</p>
            <p className="mt-1 font-bold text-[#14532d] dark:text-[#c5a253]">{q.label}</p>
            <p className="text-xs text-slate-500">{q.from} → {q.to}</p>
          </a>
        ))}
        <a className="card block hover:-translate-y-0.5 hover:shadow-md" href={url({ type: "abonnes", status: "actif" })}>
          <p className="text-lg">✅</p><p className="mt-1 font-bold text-[#14532d] dark:text-[#c5a253]">Liste des abonnés actifs</p>
        </a>
        <a className="card block hover:-translate-y-0.5 hover:shadow-md" href={url({ type: "abonnes", status: "bientot" })}>
          <p className="text-lg">⏳</p><p className="mt-1 font-bold text-[#14532d] dark:text-[#c5a253]">Abonnements bientôt expirés</p>
        </a>
        <a className="card block hover:-translate-y-0.5 hover:shadow-md" href={url({ type: "abonnes", status: "expire" })}>
          <p className="text-lg">⛔</p><p className="mt-1 font-bold text-[#14532d] dark:text-[#c5a253]">Abonnements expirés</p>
        </a>
        <a className="card block hover:-translate-y-0.5 hover:shadow-md" href={url({ type: "abonnes" })}>
          <p className="text-lg">👥</p><p className="mt-1 font-bold text-[#14532d] dark:text-[#c5a253]">Tous les abonnés</p>
        </a>
        <a className="card block hover:-translate-y-0.5 hover:shadow-md" href={url({ type: "visiteurs" })}>
          <p className="text-lg">🚶</p><p className="mt-1 font-bold text-[#14532d] dark:text-[#c5a253]">Rapport des visiteurs</p>
        </a>
        <a className="card block hover:-translate-y-0.5 hover:shadow-md" href={url({ type: "motifs" })}>
          <p className="text-lg">📌</p><p className="mt-1 font-bold text-[#14532d] dark:text-[#c5a253]">Rapport des motifs de visite</p>
        </a>
        <button className="card text-left hover:-translate-y-0.5 hover:shadow-md" onClick={() => window.print()}>
          <p className="text-lg">🖨️</p><p className="mt-1 font-bold text-[#14532d] dark:text-[#c5a253]">Imprimer / exporter en PDF</p>
          <p className="text-xs text-slate-500">Utilise l&apos;impression du navigateur (avec logo et en-tête).</p>
        </button>
      </div>

      <p className="text-xs text-slate-500">
        Les fichiers CSV utilisent le point-virgule et l&apos;encodage UTF-8 avec BOM : ils s&apos;ouvrent directement dans Excel.
      </p>
    </div>
  );
}
