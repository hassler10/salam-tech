"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Sub = {
  id: number;
  code: string;
  name: string;
  visitCount: number;
  lastVisit: string | null;
  endDate: string | null;
  daysLeft: number | null;
  typeName: string | null;
};
type Vis = { id: number; code: string; name: string; visitCount: number; lastVisit: string | null };

export default function IndividualSearch({ subs, visitors }: { subs: Sub[]; visitors: Vis[] }) {
  const [q, setQ] = useState("");
  const lq = q.trim().toLowerCase();
  const fs = useMemo(() => subs.filter((s) => !lq || s.name.toLowerCase().includes(lq) || s.code.toLowerCase().includes(lq)).slice(0, 25), [subs, lq]);
  const fv = useMemo(() => visitors.filter((v) => !lq || v.name.toLowerCase().includes(lq) || v.code.toLowerCase().includes(lq)).slice(0, 25), [visitors, lq]);

  return (
    <div className="space-y-5">
      <div className="card">
        <label className="label">Rechercher une personne</label>
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, prénoms ou identifiant" />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-bold uppercase text-slate-600 dark:text-slate-300">Abonnés ({fs.length})</h2>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Identifiant</th><th>Abonné</th><th>Visites</th><th>Dernière</th><th>Expiration</th><th></th></tr></thead>
              <tbody>
                {fs.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-slate-500">Aucun résultat.</td></tr>}
                {fs.map((s) => (
                  <tr key={s.id}>
                    <td className="font-mono text-xs">{s.code}</td>
                    <td className="font-semibold">{s.name}</td>
                    <td>{s.visitCount}</td>
                    <td>{s.lastVisit ? new Date(s.lastVisit).toLocaleDateString("fr-FR") : "—"}</td>
                    <td>{s.endDate ?? "—"}{s.daysLeft !== null ? ` (${s.daysLeft} j)` : ""}</td>
                    <td><Link className="btn-ghost px-3 py-1 text-xs" href={`/abonnes/${s.id}`}>Détails</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-bold uppercase text-slate-600 dark:text-slate-300">Visiteurs identifiés ({fv.length})</h2>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Identifiant</th><th>Visiteur</th><th>Visites</th><th>Dernière</th><th></th></tr></thead>
              <tbody>
                {fv.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-slate-500">Aucun résultat.</td></tr>}
                {fv.map((v) => (
                  <tr key={v.id}>
                    <td className="font-mono text-xs">{v.code}</td>
                    <td className="font-semibold">{v.name}</td>
                    <td>{v.visitCount}</td>
                    <td>{v.lastVisit ? new Date(v.lastVisit).toLocaleDateString("fr-FR") : "—"}</td>
                    <td><Link className="btn-ghost px-3 py-1 text-xs" href={`/visiteurs/${v.id}`}>Détails</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
