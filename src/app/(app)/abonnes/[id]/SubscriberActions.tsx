"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { durationLabel, todayIso } from "@/lib/subscriptions";
import { Icon } from "@/components/icons";

type Type = { id: number; name: string; durationDays: number };

export default function SubscriberActions({
  subscriberId,
  types,
  subscriber,
}: {
  subscriberId: number;
  types: Type[];
  subscriber: { lastName: string; firstName: string; phone: string; status: string };
}) {
  const router = useRouter();
  const [typeId, setTypeId] = useState(types[0]?.id ?? 0);
  const [startDate, setStartDate] = useState(todayIso());
  const [form, setForm] = useState(subscriber);
  const [msg, setMsg] = useState("");

  const renew = async () => {
    setMsg("");
    const res = await fetch(`/api/subscribers/${subscriberId}/renew`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ typeId, startDate }),
    });
    const json = await res.json().catch(() => ({}));
    setMsg(res.ok ? `Renouvellement enregistré jusqu'au ${json.data.endDate}.` : (json.error ?? "Erreur."));
    router.refresh();
  };

  const save = async () => {
    setMsg("");
    const res = await fetch(`/api/subscribers/${subscriberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setMsg(res.ok ? "Fiche mise à jour (modification tracée)." : "Modification impossible.");
    router.refresh();
  };

  return (
    <div className="card no-print space-y-4">
      <h3 className="text-sm font-bold">Actions</h3>

      <div className="space-y-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
        <p className="text-xs font-bold uppercase text-slate-500">Renouvellement d&apos;abonnement</p>
        <select className="input" value={typeId} onChange={(e) => setTypeId(Number(e.target.value))}>
          {types.map((t) => (
            <option key={t.id} value={t.id}>{t.name} ({durationLabel(t.durationDays)})</option>
          ))}
        </select>
        <input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <button onClick={renew} className="btn-primary w-full">Enregistrer le renouvellement</button>
        <p className="text-[11px] text-slate-400">Aucune opération financière n&apos;est associée à cette action.</p>
      </div>

      <div className="space-y-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
        <p className="text-xs font-bold uppercase text-slate-500">Modifier la fiche</p>
        <input className="input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Nom" />
        <input className="input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="Prénoms" />
        <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Téléphone" />
        <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
          <option value="actif">Fiche active</option>
          <option value="suspendu">Fiche suspendue</option>
        </select>
        <button onClick={save} className="btn-ghost w-full">Enregistrer les modifications</button>
      </div>

      <button onClick={() => window.print()} className="btn-gold w-full">
        <Icon name="printer" className="h-4 w-4" />
        Imprimer la fiche
      </button>
      {msg && <p className="text-sm font-medium text-[#166534] dark:text-[#c5a253]">{msg}</p>}
    </div>
  );
}
