"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type R = { id: number; label: string; active: boolean };

export default function ReasonsClient({ reasons }: { reasons: R[] }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [msg, setMsg] = useState("");

  const send = async (method: string, body: unknown) => {
    const res = await fetch("/api/reasons", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    setMsg(res.ok ? "Motifs mis à jour." : (json.error ?? "Erreur."));
    router.refresh();
    return res.ok;
  };

  return (
    <div className="card">
      <h3 className="mb-1 text-sm font-bold">Motifs de visite configurables</h3>
      <p className="mb-3 text-xs text-slate-500">
        Les motifs actifs apparaissent dans la liste déroulante de la page « Accueil et fréquentation ».
      </p>

      <form
        className="mb-4 flex flex-wrap gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await send("POST", { label })) setLabel("");
        }}
      >
        <input
          className="input flex-1"
          placeholder="Nouveau motif de visite"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          required
        />
        <button className="btn-primary">Ajouter</button>
      </form>

      <ul className="space-y-2">
        {reasons.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800">
            <input
              className="input flex-1 py-1 text-sm"
              defaultValue={r.label}
              onBlur={(e) => {
                if (e.target.value.trim() && e.target.value !== r.label) {
                  send("PATCH", { id: r.id, label: e.target.value });
                }
              }}
            />
            <span className={`badge ${r.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}>
              {r.active ? "Actif" : "Masqué"}
            </span>
            <button
              type="button"
              className="btn-ghost px-3 py-1 text-xs"
              onClick={() => send("PATCH", { id: r.id, active: !r.active })}
            >
              {r.active ? "Masquer" : "Réactiver"}
            </button>
          </li>
        ))}
        {reasons.length === 0 && <li className="text-sm text-slate-500">Aucun motif configuré.</li>}
      </ul>

      {msg && <p className="mt-3 text-sm font-medium text-[#166534] dark:text-[#c5a253]">{msg}</p>}
    </div>
  );
}
