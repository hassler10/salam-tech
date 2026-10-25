"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const FIELDS: { key: string; label: string; type?: string; help?: string }[] = [
  { key: "library_name", label: "Nom de la bibliothèque" },
  { key: "library_city", label: "Ville / pays" },
  { key: "alert_soon_days", label: "Seuil « bientôt expiré » (jours)", type: "number" },
  { key: "alert_imminent_days", label: "Seuil « expiration imminente » (jours)", type: "number" },
  { key: "duplicate_window_minutes", label: "Fenêtre anti-doublon (minutes)", type: "number", help: "Empêche l'enregistrement de deux visites identiques rapprochées." },
  { key: "session_timeout_minutes", label: "Déconnexion automatique (minutes)", type: "number" },
  { key: "self_service_enabled", label: "Borne d'auto-enregistrement (1 = activée, 0 = désactivée)", type: "number", help: "Page publique /borne : chaque personne enregistre sa propre visite sans voir les autres fiches." },
];

export default function SettingsClient({ settings }: { settings: Record<string, string> }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(settings);
  const [msg, setMsg] = useState("");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    setMsg(res.ok ? "Paramètres enregistrés." : "Enregistrement impossible.");
    router.refresh();
  };

  return (
    <form onSubmit={save} className="card grid grid-cols-1 gap-4 sm:grid-cols-2">
      {FIELDS.map((f) => (
        <div key={f.key}>
          <label className="label">{f.label}</label>
          <input
            className="input"
            type={f.type ?? "text"}
            value={values[f.key] ?? ""}
            onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
          />
          {f.help && <p className="mt-1 text-xs text-slate-500">{f.help}</p>}
        </div>
      ))}
      <div className="sm:col-span-2">
        <button className="btn-primary">Enregistrer les paramètres</button>
        {msg && <span className="ml-3 text-sm font-medium text-[#166534] dark:text-[#c5a253]">{msg}</span>}
      </div>
      <p className="text-xs text-slate-500 sm:col-span-2">
        Protection des données : seules les informations strictement nécessaires sont collectées
        (identité, contact facultatif, historique de fréquentation). Aucune donnée financière n&apos;est traitée.
      </p>
    </form>
  );
}
