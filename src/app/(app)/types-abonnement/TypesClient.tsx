"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, durationLabel, todayIso } from "@/lib/subscriptions";

type T = { id: number; name: string; durationDays: number; description: string; active: boolean };

export default function TypesClient({ types }: { types: T[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", durationDays: 1, description: "" });
  const [msg, setMsg] = useState("");

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json().catch(() => ({}));
    setMsg(res.ok ? "Type d'abonnement créé." : (json.error ?? "Erreur."));
    if (res.ok) {
      setForm({ name: "", durationDays: 1, description: "" });
      router.refresh();
    }
  };

  const toggle = async (t: T) => {
    await fetch("/api/types", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: t.id, active: !t.active }),
    });
    router.refresh();
  };

  const today = todayIso();

  return (
    <div className="space-y-5">
      <form onSubmit={create} className="card grid grid-cols-1 gap-3 sm:grid-cols-4">
        <input className="input" required placeholder="Nom du type *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="input" type="number" min={1} max={3650} required placeholder="Durée (jours)" value={form.durationDays} onChange={(e) => setForm({ ...form, durationDays: Number(e.target.value) })} />
        <input className="input" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <button className="btn-primary">Ajouter le type</button>
        {msg && <p className="text-sm font-medium text-[#166534] sm:col-span-4">{msg}</p>}
      </form>

      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Type</th><th>Durée</th><th>Description</th><th>Exemple (début {today})</th><th>État</th><th></th></tr></thead>
          <tbody>
            {types.map((t) => (
              <tr key={t.id}>
                <td className="font-semibold">{t.name}</td>
                <td>{durationLabel(t.durationDays)}</td>
                <td>{t.description || "—"}</td>
                <td className="text-xs text-slate-500">expire le {addDays(today, t.durationDays)}</td>
                <td>
                  <span className={`badge ${t.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}>
                    {t.active ? "Actif" : "Désactivé"}
                  </span>
                </td>
                <td><button className="btn-ghost px-3 py-1 text-xs" onClick={() => toggle(t)}>{t.active ? "Désactiver" : "Activer"}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
