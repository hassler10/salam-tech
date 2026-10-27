"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { STATUS_LABEL, STATUS_COLOR, type SubStatus } from "@/lib/subscriptions";

type Sub = {
  id: number;
  code: string;
  lastName: string;
  firstName: string;
  phone: string | null;
  cardNumber?: string | null;
  registeredAt: string;
  typeName: string | null;
  startDate: string | null;
  endDate: string | null;
  visitCount: number;
  lastVisit: string | null;
  computed: SubStatus;
  daysLeft: number | null;
};
const PAGE_SIZE = 10;

export default function SubscribersClient({ subs }: { subs: Sub[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    cardNumber: "",
    lastName: "",
    firstName: "",
  });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const lq = q.trim().toLowerCase();
    return subs.filter((s) => {
      const matchQ =
        !lq ||
        s.lastName.toLowerCase().includes(lq) ||
        s.firstName.toLowerCase().includes(lq) ||
        s.code.toLowerCase().includes(lq);
      const matchS =
        !status ||
        (status === "bientot" ? s.computed === "bientot" || s.computed === "imminent" : s.computed === status);
      return matchQ && matchS;
    });
  }, [subs, q, status]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/subscribers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg(json.error ?? "Vérification impossible.");
      return;
    }
    setMsg("Carte reconnue dans Media Salam et synchronisée.");
    setForm({ cardNumber: "", lastName: "", firstName: "" });
    setShowForm(false);
    router.refresh();
  };

  return (
    <div className="space-y-5">
      <div className="card flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <label className="label">Recherche</label>
          <input className="input" placeholder="Nom, prénoms ou identifiant" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
        <div>
          <label className="label">Statut</label>
          <select className="input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">Tous</option>
            <option value="actif">Actifs</option>
            <option value="bientot">Bientôt expirés</option>
            <option value="expire">Expirés</option>
            <option value="suspendu">Suspendus</option>
            <option value="aucun">Sans abonnement</option>
          </select>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Fermer" : "Vérifier une carte Media Salam"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={create} className="card grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Numéro de carte Media Salam *</label>
            <input className="input" required value={form.cardNumber} onChange={(e) => setForm({ ...form, cardNumber: e.target.value })} />
          </div>
          <div>
            <label className="label">Nom *</label>
            <input className="input" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          </div>
          <div>
            <label className="label">Prénoms *</label>
            <input className="input" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          </div>
          <div className="flex items-end">
            <button className="btn-primary w-full" disabled={busy}>{busy ? "Vérification…" : "Vérifier et synchroniser"}</button>
          </div>
          {msg && <p className="sm:col-span-2 text-sm font-medium text-[#166534]">{msg}</p>}
        </form>
      )}

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Identifiant</th>
              <th>Nom et prénoms</th>
              <th>Téléphone</th>
              <th>Type</th>
              <th>Expiration</th>
              <th>Jours restants</th>
              <th>Statut</th>
              <th>Visites</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {current.length === 0 && (
              <tr><td colSpan={9} className="py-8 text-center text-slate-500">Aucun abonné trouvé.</td></tr>
            )}
            {current.map((s) => (
              <tr key={s.id}>
                <td className="font-mono text-xs">{s.code}</td>
                <td className="font-semibold">{s.lastName} {s.firstName}</td>
                <td>{s.phone ?? "—"}</td>
                <td>{s.typeName ?? "—"}</td>
                <td>{s.endDate ?? "—"}</td>
                <td>{s.daysLeft !== null ? `${s.daysLeft} j` : "—"}</td>
                <td><span className={`badge ${STATUS_COLOR[s.computed]}`}>{STATUS_LABEL[s.computed]}</span></td>
                <td>{s.visitCount}</td>
                <td>
                  <Link href={`/abonnes/${s.id}`} className="btn-ghost px-3 py-1 text-xs">Fiche</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>{filtered.length} abonné(s)</span>
        <div className="flex items-center gap-2">
          <button className="btn-ghost px-3 py-1" disabled={page <= 1} onClick={() => setPage(page - 1)}>Précédent</button>
          <span>Page {page} / {pages}</span>
          <button className="btn-ghost px-3 py-1" disabled={page >= pages} onClick={() => setPage(page + 1)}>Suivant</button>
        </div>
      </div>
    </div>
  );
}
