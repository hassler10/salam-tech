"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";

type RowResult = { line: number; cardNumber: string; name: string; action: string; message?: string };
type Summary = { crees: number; majs: number; ignores: number; erreurs: number };

const MODELE = `numero_carte;nom;prenoms;telephone;type;date_debut;date_fin
CMP-00124;KOUASSI;Ibrahim;+225 0707000001;12 mois;01/01/2026;31/12/2026
CMP-00125;TRAORE;Aminata;;6 mois;15/03/2026;14/09/2026`;

export default function ImportClient({ strict, imported }: { strict: boolean; imported: number }) {
  const router = useRouter();
  const [csv, setCsv] = useState("");
  const [updateExisting, setUpdateExisting] = useState(true);
  const [preview, setPreview] = useState<{ total: number; headers: string[]; errors: RowResult[] } | null>(null);
  const [results, setResults] = useState<RowResult[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setCsv(await f.text());
    setPreview(null);
    setResults(null);
    setError("");
  };

  const call = async (dryRun: boolean) => {
    setBusy(true);
    setError("");
    const res = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv, dryRun, updateExisting }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Import impossible.");
      return;
    }
    if (dryRun) {
      setPreview({ total: json.total, headers: json.headers, errors: json.errors });
      setResults(null);
    } else {
      setSummary(json.summary);
      setResults(json.results);
      setPreview(null);
      router.refresh();
    }
  };

  const setStrict = async (v: boolean) => {
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ require_registered_card: v ? "1" : "0" }),
    });
    router.refresh();
  };

  return (
    <div className="space-y-5">
      <div className="card">
        <h3 className="mb-2 text-sm font-bold">1. Charger le fichier du registre existant</h3>
        <p className="mb-3 text-xs text-slate-500">
          Exportez vos abonnés depuis l&apos;autre plateforme au format CSV ou Excel (enregistré en CSV),
          puis déposez-le ici. Les en-têtes sont reconnus automatiquement
          (<code>numero_carte</code>, <code>identifiant</code>, <code>matricule</code>, <code>nom</code>,
          {" "}<code>prenoms</code>, <code>type</code>, <code>date_debut</code>, <code>date_fin</code>…).
          Les dates JJ/MM/AAAA et AAAA-MM-JJ sont acceptées.
        </p>
        <input
          type="file"
          accept=".csv,.txt,text/csv"
          onChange={(e) => onFile(e.target.files?.[0])}
          className="input mb-3 py-2"
        />
        <textarea
          className="input min-h-32 font-mono text-xs"
          placeholder="…ou collez directement le contenu CSV ici"
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button className="btn-ghost" onClick={() => setCsv(MODELE)} type="button">
            Insérer un modèle
          </button>
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={updateExisting} onChange={(e) => setUpdateExisting(e.target.checked)} />
            Mettre à jour les abonnés déjà présents
          </label>
          <button className="btn-ghost" disabled={!csv.trim() || busy} onClick={() => call(true)}>
            <Icon name="search" className="h-4 w-4" />
            Vérifier sans enregistrer
          </button>
          <button className="btn-primary" disabled={!csv.trim() || busy} onClick={() => call(false)}>
            <Icon name="upload" className="h-4 w-4" />
            {busy ? "Traitement…" : "Lancer l'import"}
          </button>
        </div>
        {error && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      </div>

      {preview && (
        <div className="card">
          <h3 className="mb-2 text-sm font-bold">Aperçu — aucune donnée n&apos;a été enregistrée</h3>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            <strong>{preview.total}</strong> ligne(s) exploitable(s), {preview.errors.length} ligne(s) en erreur.
          </p>
          <p className="mt-1 text-xs text-slate-500">Colonnes détectées : {preview.headers.join(" · ")}</p>
          {preview.errors.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-rose-700">
              {preview.errors.slice(0, 10).map((e, i) => (
                <li key={i}>Ligne {e.line} : {e.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {summary && results && (
        <div className="card">
          <h3 className="mb-3 text-sm font-bold">Résultat de l&apos;import</h3>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-emerald-50 p-3 text-center dark:bg-emerald-900/30">
              <p className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-300">{summary.crees}</p>
              <p className="text-xs">Créés</p>
            </div>
            <div className="rounded-xl bg-sky-50 p-3 text-center dark:bg-sky-900/30">
              <p className="text-2xl font-extrabold text-sky-700 dark:text-sky-300">{summary.majs}</p>
              <p className="text-xs">Mis à jour</p>
            </div>
            <div className="rounded-xl bg-slate-100 p-3 text-center dark:bg-slate-800">
              <p className="text-2xl font-extrabold text-slate-600 dark:text-slate-300">{summary.ignores}</p>
              <p className="text-xs">Ignorés</p>
            </div>
            <div className="rounded-xl bg-rose-50 p-3 text-center dark:bg-rose-900/30">
              <p className="text-2xl font-extrabold text-rose-700 dark:text-rose-300">{summary.erreurs}</p>
              <p className="text-xs">Erreurs</p>
            </div>
          </div>
          <div className="table-wrap max-h-80 overflow-y-auto">
            <table className="data">
              <thead><tr><th>Ligne</th><th>N° carte</th><th>Nom</th><th>Action</th><th>Détail</th></tr></thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i}>
                    <td>{r.line}</td>
                    <td className="font-mono text-xs">{r.cardNumber}</td>
                    <td>{r.name}</td>
                    <td>
                      <span className={`badge ${
                        r.action === "créé" ? "bg-emerald-100 text-emerald-800"
                        : r.action === "mis à jour" ? "bg-sky-100 text-sky-800"
                        : r.action === "erreur" ? "bg-rose-100 text-rose-700"
                        : "bg-slate-200 text-slate-600"}`}>{r.action}</span>
                    </td>
                    <td className="text-xs text-slate-500">{r.message ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <h3 className="mb-2 text-sm font-bold">2. Mode strict de la borne</h3>
        <p className="mb-3 text-xs text-slate-500">
          Lorsqu&apos;il est activé, la borne <strong>n&apos;accepte que les cartes issues du registre importé</strong>.
          Toute autre carte est refusée et renvoyée vers l&apos;agent d&apos;accueil.
          Actuellement <strong>{imported}</strong> abonné(s) proviennent du registre officiel.
        </p>
        <label className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
          <input type="checkbox" checked={strict} onChange={(e) => setStrict(e.target.checked)} />
          <span className="text-sm font-semibold">
            N&apos;accepter que les identifiants du registre officiel
            <span className={`badge ml-2 ${strict ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}>
              {strict ? "Activé" : "Désactivé"}
            </span>
          </span>
        </label>
        {strict && imported === 0 && (
          <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            Attention : aucun abonné importé. Avec le mode strict activé, la borne refusera tout le monde.
          </p>
        )}
      </div>
    </div>
  );
}
