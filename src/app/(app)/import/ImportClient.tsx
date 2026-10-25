"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import type { MediaSalamState, SyncCounts, SyncPreview } from "@/lib/media-salam";

type RowResult = { line: number; cardNumber: string; name: string; action: string; message?: string };
type Summary = { crees: number; majs: number; ignores: number; erreurs: number };

const MAX_BACKUP_BYTES = 5_000_000;

const MODELE = `numero_carte;nom;prenoms;telephone;type;date_debut;date_fin
BSN-2026-000124;KOUASSI;Ibrahim;+225 0707000001;12 mois;01/01/2026;31/12/2026
BSN-2026-000125;TRAORE;Aminata;;6 mois;15/03/2026;14/09/2026`;

const dateTime = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Abidjan",
});

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateTime.format(date);
}

function CountTile({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: string;
}) {
  return (
    <div className={`rounded-xl p-3 text-center ${tone}`}>
      <p className="text-2xl font-extrabold">{value}</p>
      <p className="text-xs">{label}</p>
    </div>
  );
}

export default function ImportClient({
  strict,
  imported,
  synced,
  autoConfigured,
  upstreamUrl,
  state,
}: {
  strict: boolean;
  imported: number;
  synced: number;
  autoConfigured: boolean;
  upstreamUrl: string;
  state: MediaSalamState;
}) {
  const router = useRouter();

  const [backup, setBackup] = useState<unknown>(null);
  const [backupName, setBackupName] = useState("");
  const [backupGeneratedAt, setBackupGeneratedAt] = useState<string | null>(null);
  const [syncPreview, setSyncPreview] = useState<SyncPreview | null>(null);
  const [syncResult, setSyncResult] = useState<SyncCounts | null>(null);
  const [syncError, setSyncError] = useState("");
  const [syncBusy, setSyncBusy] = useState<"preview" | "apply" | null>(null);

  const [csv, setCsv] = useState("");
  const [updateExisting, setUpdateExisting] = useState(true);
  const [csvPreview, setCsvPreview] = useState<{ total: number; headers: string[]; errors: RowResult[] } | null>(null);
  const [results, setResults] = useState<RowResult[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [csvError, setCsvError] = useState("");
  const [csvBusy, setCsvBusy] = useState(false);

  const onBackupFile = async (file: File | undefined) => {
    if (!file) return;
    setSyncError("");
    setSyncPreview(null);
    setSyncResult(null);
    if (file.size > MAX_BACKUP_BYTES) {
      setBackup(null);
      setBackupName("");
      setBackupGeneratedAt(null);
      setSyncError("Cette sauvegarde dépasse 5 Mo. Utilisez la sauvegarde JSON sans les visages.");
      return;
    }
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (
        !parsed ||
        typeof parsed !== "object" ||
        !Array.isArray((parsed as { subscribers?: unknown }).subscribers)
      ) {
        setBackup(null);
        setBackupName("");
        setBackupGeneratedAt(null);
        setSyncError("Ce fichier n'est pas une sauvegarde media-salam (tableau « subscribers » absent).");
        return;
      }
      const generated = (parsed as { generatedAt?: unknown }).generatedAt;
      setBackup(parsed);
      setBackupName(file.name);
      setBackupGeneratedAt(
        typeof generated === "string" && !Number.isNaN(Date.parse(generated)) ? generated : null,
      );
    } catch {
      setBackup(null);
      setBackupName("");
      setBackupGeneratedAt(null);
      setSyncError("Fichier JSON illisible.");
    }
  };

  const callSync = async (mode: "preview" | "apply", source: "auto" | "file") => {
    if (source === "file" && !backup) {
      setSyncError("Choisissez d'abord une sauvegarde JSON.");
      return;
    }
    setSyncBusy(mode === "preview" ? "preview" : "apply");
    setSyncError("");
    if (mode === "apply") setSyncPreview(null);

    const res = await fetch("/api/sync/media-salam", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(source === "file" ? { mode, backup } : { mode }),
    });
    const json = await res.json().catch(() => ({}));
    setSyncBusy(null);

    if (!res.ok) {
      setSyncError(json.error ?? "Synchronisation impossible.");
      return;
    }
    if (mode === "preview") {
      setSyncPreview(json.preview as SyncPreview);
      setSyncResult(null);
    } else {
      setSyncResult(json.counts as SyncCounts);
      setSyncPreview(null);
      router.refresh();
    }
  };

  const onCsvFile = async (file: File | undefined) => {
    if (!file) return;
    setCsv(await file.text());
    setCsvPreview(null);
    setResults(null);
    setCsvError("");
  };

  const callCsv = async (dryRun: boolean) => {
    setCsvBusy(true);
    setCsvError("");
    const res = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv, dryRun, updateExisting }),
    });
    const json = await res.json().catch(() => ({}));
    setCsvBusy(false);
    if (!res.ok) {
      setCsvError(json.error ?? "Import impossible.");
      return;
    }
    if (dryRun) {
      setCsvPreview({ total: json.total, headers: json.headers, errors: json.errors });
      setResults(null);
    } else {
      setSummary(json.summary);
      setResults(json.results);
      setCsvPreview(null);
      router.refresh();
    }
  };

  const setStrict = async (value: boolean) => {
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ require_registered_card: value ? "1" : "0" }),
    });
    router.refresh();
  };

  const syncBusyLabel =
    syncBusy === "preview" ? "Vérification…" : syncBusy === "apply" ? "Synchronisation…" : "";

  return (
    <div className="space-y-5">
      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold">1. Registre officiel media-salam</h3>
            <p className="mt-1 text-xs text-slate-500">
              Salam Library Pro ne modifie jamais media-salam : il lit uniquement la sauvegarde
              officielle. Les noms, prénoms et numéros de carte de la borne proviennent de cette
              synchronisation.
            </p>
          </div>
          <span
            className={`badge ${
              state.status === "ok"
                ? "bg-emerald-100 text-emerald-800"
                : state.status === "error"
                  ? "bg-rose-100 text-rose-700"
                  : "bg-slate-200 text-slate-600"
            }`}
          >
            {state.status === "ok"
              ? "Dernière synchronisation réussie"
              : state.status === "error"
                ? "Dernière synchronisation en erreur"
                : "Jamais synchronisé"}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Dernière synchronisation</p>
            <p className="mt-1 text-sm font-semibold">{formatDateTime(state.lastSync)}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Dernière tentative</p>
            <p className="mt-1 text-sm font-semibold">{formatDateTime(state.lastAttempt)}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Automatisation</p>
            <p className="mt-1 text-sm font-semibold">
              {autoConfigured ? "Quotidienne (02:00 UTC)" : "Non configurée"}
            </p>
          </div>
        </div>

        {state.status === "error" && state.error && (
          <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
            {state.error}
          </p>
        )}

        {state.summary && (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <CountTile value={state.summary.crees} label="Créés" tone="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" />
            <CountTile value={state.summary.majs} label="Mis à jour" tone="bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300" />
            <CountTile value={state.summary.suspendus} label="Suspendus" tone="bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" />
            <CountTile value={state.summary.reactives} label="Réactivés" tone="bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300" />
            <CountTile value={state.summary.inchanges} label="Inchangés" tone="bg-slate-100 text-slate-600 dark:bg-slate-800" />
            <CountTile value={state.summary.erreurs} label="Erreurs" tone="bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300" />
          </div>
        )}

        <div className="mt-4 rounded-xl border border-brand-600/15 bg-brand-50/60 p-4 text-xs text-slate-600">
          <p className="font-semibold text-brand-900">Obtenir la sauvegarde officielle</p>
          <ol className="mt-2 list-decimal space-y-1 pl-4">
            <li>Connectez-vous à media-salam avec un compte super administrateur.</li>
            <li>Ouvrez <strong>Maintenance</strong>, puis téléchargez la sauvegarde JSON (sans les visages).</li>
            <li>Déposez ce fichier ci-dessous, vérifiez l&apos;aperçu, puis synchronisez.</li>
          </ol>
          <a
            href={`${upstreamUrl}/maintenance`}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 font-semibold text-brand-700 underline-offset-2 hover:underline"
          >
            Ouvrir media-salam
            <Icon name="arrowRight" className="h-3.5 w-3.5" />
          </a>
        </div>

        <div className="mt-4">
          <label className="label">Sauvegarde JSON de media-salam</label>
          <input
            type="file"
            accept=".json,application/json"
            onChange={(e) => onBackupFile(e.target.files?.[0])}
            className="input py-2"
          />
          {backupName && (
            <p className="mt-2 text-xs text-slate-500">
              Fichier chargé : <strong>{backupName}</strong>
              {backupGeneratedAt ? ` · généré le ${formatDateTime(backupGeneratedAt)}` : ""}
            </p>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {autoConfigured && (
            <button
              className="btn-primary"
              type="button"
              disabled={syncBusy !== null}
              onClick={() => callSync("apply", "auto")}
            >
              <Icon name="refresh" className="h-4 w-4" />
              {syncBusy === "apply" ? "Synchronisation…" : "Synchroniser depuis media-salam"}
            </button>
          )}
          {backup !== null && (
            <>
              <button
                className="btn-ghost"
                type="button"
                disabled={syncBusy !== null}
                onClick={() => callSync("preview", "file")}
              >
                <Icon name="search" className="h-4 w-4" />
                {syncBusy === "preview" ? syncBusyLabel : "Vérifier le fichier"}
              </button>
              <button
                className="btn-primary"
                type="button"
                disabled={syncBusy !== null}
                onClick={() => callSync("apply", "file")}
              >
                <Icon name="upload" className="h-4 w-4" />
                {syncBusy === "apply" ? syncBusyLabel : "Appliquer ce fichier"}
              </button>
            </>
          )}
        </div>

        {!autoConfigured && (
          <p className="mt-2 text-[11px] text-slate-400">
            La synchronisation automatique nécessite les variables serveur MEDIA_SALAM_USERNAME
            et MEDIA_SALAM_PASSWORD. L&apos;import du fichier JSON fonctionne sans elles.
          </p>
        )}

        {syncError && (
          <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{syncError}</p>
        )}

        {syncPreview && (
          <div className="mt-4 rounded-xl border border-slate-200 p-4">
            <h4 className="text-sm font-bold">Aperçu — aucune donnée n&apos;a été enregistrée</h4>
            <p className="mt-1 text-xs text-slate-500">
              {syncPreview.total} fiche(s) dans la sauvegarde, {syncPreview.valides} valide(s),
              {" "}{syncPreview.erreurs} en erreur
              {syncPreview.generatedAt ? ` · sauvegarde du ${formatDateTime(syncPreview.generatedAt)}` : ""}.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <CountTile value={syncPreview.nouveaux} label="Nouveaux" tone="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" />
              <CountTile value={syncPreview.connus} label="Déjà connus" tone="bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300" />
              <CountTile value={syncPreview.suspendus} label="Suspendus" tone="bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" />
              <CountTile value={syncPreview.erreurs} label="Erreurs" tone="bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300" />
            </div>
            {syncPreview.errorDetails.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-rose-700">
                {syncPreview.errorDetails.map((error, index) => (
                  <li key={index}>Fiche {error.line} : {error.message}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {syncResult && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
            <h4 className="text-sm font-bold text-emerald-900">Synchronisation terminée</h4>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <CountTile value={syncResult.crees} label="Créés" tone="bg-white/80 text-emerald-700" />
              <CountTile value={syncResult.majs} label="Mis à jour" tone="bg-white/80 text-sky-700" />
              <CountTile value={syncResult.suspendus} label="Suspendus" tone="bg-white/80 text-amber-700" />
              <CountTile value={syncResult.reactives} label="Réactivés" tone="bg-white/80 text-teal-700" />
              <CountTile value={syncResult.inchanges} label="Inchangés" tone="bg-white/80 text-slate-600" />
              <CountTile value={syncResult.erreurs} label="Erreurs" tone="bg-white/80 text-rose-700" />
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="mb-2 text-sm font-bold">2. Mode strict de la borne</h3>
        <p className="mb-3 text-xs text-slate-500">
          Lorsqu&apos;il est activé, la borne <strong>n&apos;accepte que les abonnés actifs issus
          de la synchronisation media-salam</strong>. Toute autre carte est refusée et renvoyée
          vers l&apos;agent d&apos;accueil. Les visiteurs occasionnels restent libres de
          s&apos;enregistrer.
          Actuellement <strong>{synced}</strong> abonné(s) synchronisé(s) depuis media-salam.
        </p>
        <label className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
          <input type="checkbox" checked={strict} onChange={(e) => setStrict(e.target.checked)} />
          <span className="text-sm font-semibold">
            N&apos;accepter que les abonnés du registre officiel media-salam
            <span className={`badge ml-2 ${strict ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}>
              {strict ? "Activé" : "Désactivé"}
            </span>
          </span>
        </label>
        {strict && synced === 0 && (
          <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            Attention : aucun abonné synchronisé. Avec le mode strict activé, la borne refusera
            tous les abonnés. Synchronisez d&apos;abord le registre.
          </p>
        )}
        {strict && synced > 0 && !state.lastSync && (
          <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            Aucune synchronisation réussie n&apos;est enregistrée : la borne refusera les cartes
            jusqu&apos;à la prochaine synchronisation.
          </p>
        )}
      </div>

      <div className="card">
        <h3 className="mb-2 text-sm font-bold">3. Import CSV de secours</h3>
        <p className="mb-3 text-xs text-slate-500">
          Disponible pour reprendre un ancien fichier, mais il ne vaut pas registre officiel :
          les fiches importées en CSV ne sont pas acceptées par le mode strict.
          {imported > 0 ? ` ${imported} fiche(s) proviennent d'un ancien import CSV.` : ""}
        </p>
        <input
          type="file"
          accept=".csv,.txt,text/csv"
          onChange={(e) => onCsvFile(e.target.files?.[0])}
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
          <button className="btn-ghost" disabled={!csv.trim() || csvBusy} onClick={() => callCsv(true)}>
            <Icon name="search" className="h-4 w-4" />
            Vérifier sans enregistrer
          </button>
          <button className="btn-primary" disabled={!csv.trim() || csvBusy} onClick={() => callCsv(false)}>
            <Icon name="upload" className="h-4 w-4" />
            {csvBusy ? "Traitement…" : "Lancer l'import"}
          </button>
        </div>
        {csvError && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{csvError}</p>}
      </div>

      {csvPreview && (
        <div className="card">
          <h3 className="mb-2 text-sm font-bold">Aperçu CSV — aucune donnée n&apos;a été enregistrée</h3>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            <strong>{csvPreview.total}</strong> ligne(s) exploitable(s), {csvPreview.errors.length} ligne(s) en erreur.
          </p>
          <p className="mt-1 text-xs text-slate-500">Colonnes détectées : {csvPreview.headers.join(" · ")}</p>
          {csvPreview.errors.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-rose-700">
              {csvPreview.errors.slice(0, 10).map((error, index) => (
                <li key={index}>Ligne {error.line} : {error.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {summary && results && (
        <div className="card">
          <h3 className="mb-3 text-sm font-bold">Résultat de l&apos;import CSV</h3>
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
                {results.map((row, index) => (
                  <tr key={index}>
                    <td>{row.line}</td>
                    <td className="font-mono text-xs">{row.cardNumber}</td>
                    <td>{row.name}</td>
                    <td>
                      <span className={`badge ${
                        row.action === "créé" ? "bg-emerald-100 text-emerald-800"
                        : row.action === "mis à jour" ? "bg-sky-100 text-sky-800"
                        : row.action === "erreur" ? "bg-rose-100 text-rose-700"
                        : "bg-slate-200 text-slate-600"}`}>{row.action}</span>
                    </td>
                    <td className="text-xs text-slate-500">{row.message ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
