"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type PersonType = "abonne" | "visiteur";
type Scope = "visits" | "subscription" | "contact" | "record";

type Row = {
  id: number;
  code: string;
  lastName: string;
  firstName: string;
  phone: string | null;
  status: string | null;
  source: string;
  visitCount: number;
  periodCount: number;
  endDate: string | null;
  detail: string | null;
};

const SOURCE_LABELS: Record<string, string> = {
  media_salam: "Registre officiel",
  import: "Ancien import",
  interne: "Fiche locale",
};

const DANGER_BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50";

export default function DataReset() {
  const router = useRouter();
  const [type, setType] = useState<PersonType>("abonne");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Row | null>(null);
  const [scopes, setScopes] = useState<Scope[]>(["visits"]);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [msg, setMsg] = useState("");

  const isRegistry = selected?.source === "media_salam";

  const switchType = (next: PersonType) => {
    if (next === type) return;
    setType(next);
    setQ("");
    setResults([]);
    setSelected(null);
    setScopes(["visits"]);
    setConfirmation("");
    setMsg("");
  };

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = q.trim();
    if (query.length < 2) {
      setOk(false);
      setMsg("Saisissez au moins 2 caractères.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(
        `/api/maintenance/reset?type=${type}&q=${encodeURIComponent(query)}`,
      );
      const json = (await res.json().catch(() => ({}))) as { data?: Row[]; error?: string };
      if (!res.ok) {
        setOk(false);
        setMsg(json.error ?? "Recherche impossible.");
        return;
      }
      const data = json.data ?? [];
      setResults(data);
      setSelected(null);
      if (data.length === 0) {
        setOk(false);
        setMsg("Aucune fiche ne correspond à cette recherche.");
      }
    } catch {
      setOk(false);
      setMsg("Recherche impossible.");
    } finally {
      setBusy(false);
    }
  };

  const choose = (row: Row) => {
    setSelected(row);
    setScopes(["visits"]);
    setConfirmation("");
    setMsg("");
  };

  const toggleScope = (scope: Scope) => {
    if (scope === "record") {
      setScopes((prev) => (prev.includes("record") ? [] : ["record"]));
      return;
    }
    setScopes((prev) => {
      const base = prev.filter((s) => s !== "record");
      return base.includes(scope) ? base.filter((s) => s !== scope) : [...base, scope];
    });
  };

  const execute = async () => {
    if (!selected) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/maintenance/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id: selected.id, scopes, confirmation }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        data?: {
          visitsDeleted: number;
          periodsDeleted: number;
          contactReset: boolean;
          recordDeleted: boolean;
        };
        error?: string;
      };
      if (!res.ok || !json.data) {
        setOk(false);
        setMsg(json.error ?? "Réinitialisation impossible.");
        return;
      }
      const d = json.data;
      const parts: string[] = [];
      if (d.visitsDeleted) parts.push(`${d.visitsDeleted} visite(s)`);
      if (d.periodsDeleted) parts.push(`${d.periodsDeleted} période(s) d'abonnement`);
      if (d.contactReset) parts.push("coordonnées effacées");
      if (d.recordDeleted) parts.push("fiche supprimée");
      setOk(true);
      setMsg(
        parts.length
          ? `Réinitialisation effectuée : ${parts.join(", ")}.`
          : "Aucune donnée à réinitialiser pour cette sélection.",
      );
      setSelected(null);
      setResults([]);
      setQ("");
      setScopes(["visits"]);
      setConfirmation("");
      router.refresh();
    } catch {
      setOk(false);
      setMsg("Réinitialisation impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="data-reset" className="card scroll-mt-24">
      <div className="mb-4">
        <h2 className="section-title">Réinitialiser les données d&apos;une fiche</h2>
        <p className="mt-1 text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
          Corrigez une saisie erronée en supprimant uniquement les données choisies d&apos;un abonné
          ou d&apos;un visiteur. L&apos;opération est définitive et tracée dans le journal d&apos;audit.
        </p>
      </div>

      <div className="rounded-2xl border border-amber-500/25 bg-amber-50 px-4 py-3 text-[12px] leading-relaxed text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
        Les fiches issues du registre officiel media-salam ne peuvent pas être supprimées ici :
        corrigez-les dans media-salam. Les données locales réinitialisées seront restaurées à la
        prochaine synchronisation si elles existent toujours dans le registre.
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {([
          { value: "abonne", label: "Abonné" },
          { value: "visiteur", label: "Visiteur" },
        ] as const).map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => switchType(option.value)}
            className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
              type === option.value
                ? "border-brand-600 bg-brand-600 text-white shadow-sm dark:border-gold-400/70 dark:bg-gold-400/20 dark:text-gold-200"
                : "border-slate-200 bg-white/70 text-slate-600 hover:border-brand-600/30 hover:text-brand-800 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:border-gold-400/30 dark:hover:text-white"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <form onSubmit={search} className="mt-4 flex flex-wrap items-end gap-2">
        <div className="min-w-56 flex-1">
          <label className="label" htmlFor="reset-search">Recherche</label>
          <input
            id="reset-search"
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nom, prénoms, identifiant/carte ou téléphone"
            autoComplete="off"
          />
        </div>
        <button className="btn-ghost" disabled={busy}>
          {busy ? "Recherche…" : "Rechercher"}
        </button>
      </form>

      {results.length > 0 && (
        <ul className="mt-4 space-y-2">
          {results.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => choose(row)}
                className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                  selected?.id === row.id
                    ? "border-brand-600 bg-brand-50/80 ring-1 ring-brand-600/20 dark:border-gold-400/60 dark:bg-gold-400/10"
                    : "border-slate-200 bg-white/60 hover:border-brand-600/30 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-gold-400/30"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {row.lastName} {row.firstName}
                  </span>
                  <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                    {row.code}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <span>{SOURCE_LABELS[row.source] ?? row.source}</span>
                  <span>{row.visitCount} visite(s)</span>
                  {type === "abonne" && <span>{row.periodCount} période(s)</span>}
                  {row.phone && <span>{row.phone}</span>}
                  {row.endDate && <span>Abonnement jusqu&apos;au {row.endDate}</span>}
                  {row.detail && <span>{row.detail}</span>}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-[var(--surface-2)]/50 p-4 dark:border-white/10">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            Fiche sélectionnée : {selected.lastName} {selected.firstName}{" "}
            <span className="font-mono text-xs font-normal text-slate-500 dark:text-slate-400">
              ({selected.code})
            </span>
          </p>
          {isRegistry && (
            <p className="mt-2 rounded-xl border border-amber-500/25 bg-amber-50 px-3 py-2 text-[11.5px] leading-relaxed text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
              Cette fiche vient du registre officiel media-salam : la suppression complète est
              désactivée. Corrigez l&apos;identité directement dans media-salam.
            </p>
          )}

          <fieldset className="mt-4">
            <legend className="label">Données à réinitialiser</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex items-start gap-2 rounded-xl bg-white/60 px-3 py-2 text-sm dark:bg-white/[0.03]">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={scopes.includes("visits")}
                  disabled={scopes.includes("record")}
                  onChange={() => toggleScope("visits")}
                />
                <span>
                  Historique des visites{" "}
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    ({selected.visitCount})
                  </span>
                </span>
              </label>
              {type === "abonne" && (
                <label className="flex items-start gap-2 rounded-xl bg-white/60 px-3 py-2 text-sm dark:bg-white/[0.03]">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={scopes.includes("subscription")}
                    disabled={scopes.includes("record")}
                    onChange={() => toggleScope("subscription")}
                  />
                  <span>
                    Abonnement et périodes{" "}
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      ({selected.periodCount})
                    </span>
                  </span>
                </label>
              )}
              <label className="flex items-start gap-2 rounded-xl bg-white/60 px-3 py-2 text-sm dark:bg-white/[0.03]">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={scopes.includes("contact")}
                  disabled={scopes.includes("record")}
                  onChange={() => toggleScope("contact")}
                />
                <span>
                  {type === "abonne"
                    ? "Coordonnées (téléphone, e-mail, note)"
                    : "Coordonnées (téléphone, fonction)"}
                </span>
              </label>
              <label className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-50/60 px-3 py-2 text-sm dark:border-rose-400/20 dark:bg-rose-400/10">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={scopes.includes("record")}
                  disabled={isRegistry}
                  onChange={() => toggleScope("record")}
                />
                <span>
                  Supprimer la fiche complète
                  <span className="mt-0.5 block text-[11px] text-rose-700/80 dark:text-rose-300/80">
                    Profil, abonnement et visites
                  </span>
                </span>
              </label>
            </div>
          </fieldset>

          <div className="mt-4">
            <label className="label" htmlFor="reset-confirmation">Confirmation</label>
            <p className="mb-2 text-[11.5px] text-slate-500 dark:text-slate-400">
              Saisissez le code <span className="font-mono font-semibold">{selected.code}</span> pour
              confirmer.
            </p>
            <input
              id="reset-confirmation"
              className="input"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder={selected.code}
              autoComplete="off"
            />
          </div>

          <button
            type="button"
            onClick={execute}
            disabled={
              busy || scopes.length === 0 || confirmation.trim() !== selected.code
            }
            className={`mt-4 ${DANGER_BUTTON}`}
          >
            {busy ? "Traitement…" : "Réinitialiser les données sélectionnées"}
          </button>
        </div>
      )}

      {msg && (
        <p
          role="status"
          className={`mt-3 text-sm font-medium ${
            ok ? "text-[#166534] dark:text-[#c5a253]" : "text-rose-600 dark:text-rose-300"
          }`}
        >
          {msg}
        </p>
      )}
    </section>
  );
}
