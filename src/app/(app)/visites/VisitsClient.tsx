"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Row = {
  id: number;
  uid: string;
  personType: string;
  displayName: string;
  reason: string | null;
  occurredAt: string;
  agentName: string | null;
  syncStatus: string;
  subscriberId: number | null;
  visitorId: number | null;
};

const PAGE_SIZE = 15;

export default function VisitsClient({ rows }: { rows: Row[] }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const lq = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (lq && !r.displayName.toLowerCase().includes(lq)) return false;
      if (type && r.personType !== type) return false;
      const d = r.occurredAt.slice(0, 10);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [rows, q, type, from, to]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-5">
      <div className="card grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div><label className="label">Personne</label><input className="input" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
        <div>
          <label className="label">Type</label>
          <select className="input" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
            <option value="">Tous</option>
            <option value="abonne">Abonnés</option>
            <option value="visiteur">Visiteurs</option>
          </select>
        </div>
        <div><label className="label">Du</label><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><label className="label">Au</label><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Date et heure</th><th>Type</th><th>Personne</th><th>Motif</th><th>Agent</th><th>Synchro.</th><th>ID visite</th></tr></thead>
          <tbody>
            {current.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-slate-500">Aucune visite.</td></tr>}
            {current.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.occurredAt).toLocaleString("fr-FR")}</td>
                <td>{r.personType === "abonne" ? "Abonné" : "Visiteur"}</td>
                <td className="font-semibold">
                  {r.subscriberId ? (
                    <Link className="text-[#166534] hover:underline dark:text-[#c5a253]" href={`/abonnes/${r.subscriberId}`}>{r.displayName}</Link>
                  ) : r.visitorId ? (
                    <Link className="text-[#166534] hover:underline dark:text-[#c5a253]" href={`/visiteurs/${r.visitorId}`}>{r.displayName}</Link>
                  ) : (
                    r.displayName
                  )}
                </td>
                <td>{r.reason ?? "—"}</td>
                <td>{r.agentName ?? "—"}</td>
                <td className="text-xs">{r.syncStatus}</td>
                <td className="font-mono text-[10px] text-slate-400">{r.uid.slice(0, 8)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>{filtered.length} visite(s)</span>
        <div className="flex items-center gap-2">
          <button className="btn-ghost px-3 py-1" disabled={page <= 1} onClick={() => setPage(page - 1)}>Précédent</button>
          <span>Page {page} / {pages}</span>
          <button className="btn-ghost px-3 py-1" disabled={page >= pages} onClick={() => setPage(page + 1)}>Suivant</button>
        </div>
      </div>
    </div>
  );
}
