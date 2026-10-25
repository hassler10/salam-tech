"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Field = {
  key: string;
  label: string;
  type?: "text" | "number" | "textarea";
  help?: string;
  wide?: boolean;
};

const PUBLIC_FIELDS: Field[] = [
  {
    key: "library_tagline",
    label: "Accroche de la page d'accueil",
    help: "Titre principal affiché en haut de la vitrine publique.",
    wide: true,
  },
  {
    key: "library_about",
    label: "Présentation de la bibliothèque",
    type: "textarea",
    help: "Texte affiché dans la section « La bibliothèque ».",
    wide: true,
  },
  { key: "library_address", label: "Adresse" },
  {
    key: "opening_hours",
    label: "Horaires d'ouverture",
    help: "Ex. : Lundi – Samedi · 09h00 – 18h00. Laisser vide affiche un renvoi vers l'accueil.",
  },
  { key: "library_phone", label: "Téléphone / WhatsApp" },
  { key: "library_email", label: "Adresse e-mail" },
  {
    key: "library_map_url",
    label: "Lien de localisation",
    help: "Laisser vide pour une recherche automatique sur Google Maps.",
    wide: true,
  },
];

const SYSTEM_FIELDS: Field[] = [
  { key: "library_name", label: "Nom de la bibliothèque" },
  { key: "library_city", label: "Ville / pays" },
  { key: "alert_soon_days", label: "Seuil « bientôt expiré » (jours)", type: "number" },
  { key: "alert_imminent_days", label: "Seuil « expiration imminente » (jours)", type: "number" },
  {
    key: "duplicate_window_minutes",
    label: "Fenêtre anti-doublon (minutes)",
    type: "number",
    help: "Empêche l'enregistrement de deux visites identiques rapprochées.",
  },
  { key: "session_timeout_minutes", label: "Déconnexion automatique (minutes)", type: "number" },
  {
    key: "self_service_enabled",
    label: "Borne d'auto-enregistrement (1 = activée, 0 = désactivée)",
    type: "number",
    help: "Page publique /borne : chaque personne enregistre sa propre visite sans voir les autres fiches.",
    wide: true,
  },
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

  const renderField = (f: Field) => (
    <div key={f.key} className={f.wide ? "sm:col-span-2" : undefined}>
      <label className="label" htmlFor={`setting-${f.key}`}>
        {f.label}
      </label>
      {f.type === "textarea" ? (
        <textarea
          id={`setting-${f.key}`}
          className="input min-h-[120px] resize-y"
          value={values[f.key] ?? ""}
          onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
        />
      ) : (
        <input
          id={`setting-${f.key}`}
          className="input"
          type={f.type ?? "text"}
          value={values[f.key] ?? ""}
          onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
        />
      )}
      {f.help && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{f.help}</p>}
    </div>
  );

  return (
    <form onSubmit={save} className="space-y-5">
      <section className="card">
        <div className="mb-5">
          <h2 className="section-title">Page d&apos;accueil publique</h2>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
            Ces informations sont visibles par tous les visiteurs de la vitrine, avant toute
            connexion.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {PUBLIC_FIELDS.map(renderField)}
        </div>
      </section>

      <section className="card">
        <div className="mb-5">
          <h2 className="section-title">Exploitation & sécurité</h2>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
            Identité de l&apos;établissement, seuils d&apos;alerte et règles de fonctionnement.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {SYSTEM_FIELDS.map(renderField)}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary">Enregistrer les paramètres</button>
        {msg && (
          <span className="text-sm font-medium text-[#166534] dark:text-[#c5a253]">{msg}</span>
        )}
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Protection des données : seules les informations strictement nécessaires sont collectées
        (identité, contact facultatif, historique de fréquentation). Aucune donnée financière n&apos;est traitée.
      </p>
    </form>
  );
}
