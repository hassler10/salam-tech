"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Row = {
  id: number;
  code: string;
  lastName: string;
  firstName: string;
  phone: string | null;
  organization: string | null;
  createdAt: string;
  visitCount: number;
  lastVisit: string | null;
};

const PAGE_SIZE = 10;

export default function VisitorsClient({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ lastName: "", firstName: "", phone: "", organization: "" });
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");

  const filtered = useMemo(() => {
    const lq = q.trim().toLowerCase();
    if (!lq) return rows;
    return rows.filter(
      (r) =>
        r.lastName.toLowerCase().includes(lq) ||
        r.firstName.toLowerCase().includes(lq) ||
        r.code.toLowerCase().includes(lq),
    );
  }, [rows, q]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/visitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json().catch(() => ({}));
    setMsg(res.ok ? "Fiche visiteur enregistrée (doublons évités)." : (json.error ?? "Erreur."));
    if (res.ok) {
      setForm({ lastName: "", firstName: "", phone: "", organization: "" });
      setOpen(false);
      router.refresh();
    }
  };

  return (
    <div className="space-y-5">
      <div className="card flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <label className="label">Recherche</label>
          <input className="input" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Nom, prénoms ou identifiant" />
        </div>
        <button className="btn-ghost" onClick={() => setOpen((v) => !v)}>{open ? "Fermer" : "+ Nouvelle fiche visiteur"}</button>
      </div>

      {open && (
        <form onSubmit={create} className="card grid grid-cols-1 gap-3 sm:grid-cols-4">
          <input className="input" required placeholder="Nom *" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          <input className="input" required placeholder="Prénoms *" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          <input className="input" placeholder="Contact" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input className="input" placeholder="Organisme" value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} />
          <button className="btn-primary sm:col-span-4">Créer la fiche</button>
        </form>
      )}
      {msg && <p className="text-sm font-medium text-[#166534]">{msg}</p>}

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr><th>Identifiant</th><th>Nom et prénoms</th><th>Contact</th><th>Organisme</th><th>Visites</th><th>Dernière visite</th><th></th></tr>
          </thead>
          <tbody>
            {current.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-slate-500">Aucun visiteur.</td></tr>}
            {current.map((r) => (
              <tr key={r.id}>
                <td className="font-mono text-xs">{r.code}</td>
                <td className="font-semibold">{r.lastName} {r.firstName}</td>
                <td>{r.phone ?? "—"}</td>
                <td>{r.organization ?? "—"}</td>
                <td>{r.visitCount}</td>
                <td>{r.lastVisit ? new Date(r.lastVisit).toLocaleString("fr-FR") : "—"}</td>
                <td><Link className="btn-ghost px-3 py-1 text-xs" href={`/visiteurs/${r.id}`}>Fiche</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>{filtered.length} visiteur(s)</span>
        <div className="flex items-center gap-2">
          <button className="btn-ghost px-3 py-1" disabled={page <= 1} onClick={() => setPage(page - 1)}>Précédent</button>
          <span>Page {page} / {pages}</span>
          <button className="btn-ghost px-3 py-1" disabled={page >= pages} onClick={() => setPage(page + 1)}>Suivant</button>
        </div>
      </div>
    </div>
  );
}
