"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";

type Generated = { code: string; expiresAt: string };

export default function GateCodeGenerator() {
  const [generated, setGenerated] = useState<Generated | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function generate() {
    setBusy(true);
    setError("");
    setCopied(false);
    try {
      const response = await fetch("/api/self/gate-code", { method: "POST", cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Impossible de générer le code.");
      setGenerated(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erreur de connexion.");
    } finally {
      setBusy(false);
    }
  }

  async function copyCode() {
    if (!generated) return;
    try {
      await navigator.clipboard.writeText(generated.code);
      setCopied(true);
    } catch {
      setError("La copie automatique n’est pas disponible. Sélectionnez le code pour le copier.");
    }
  }

  const expires = generated ? new Date(generated.expiresAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <section className="card max-w-2xl p-5 sm:p-7">
      <div className="flex items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700">
          <Icon name="shield" className="h-6 w-6" />
        </span>
        <div>
          <h2 className="font-display text-lg font-semibold text-brand-900">Accès à usage unique</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">Générez un code juste avant l’enregistrement. Il expire au bout de 10 minutes et ne fonctionne qu’une seule fois. Un nouveau code invalide le précédent.</p>
        </div>
      </div>

      {generated && (
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">Code à saisir sur la borne</p>
          <p className="my-3 break-all font-mono text-2xl font-bold tracking-wider text-emerald-950 sm:text-3xl">{generated.code}</p>
          <p className="text-sm text-emerald-800">Valable jusqu’à {expires}. Il disparaîtra de cet écran si vous le quittez.</p>
          <button type="button" onClick={copyCode} className="btn-ghost mt-4 h-10 border border-emerald-300 text-emerald-900">
            <Icon name={copied ? "check" : "file"} className="h-4 w-4" /> {copied ? "Code copié" : "Copier le code"}
          </button>
        </div>
      )}

      {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      <button type="button" onClick={generate} disabled={busy} className="btn-primary mt-6 h-12 w-full sm:w-auto">
        <Icon name="refresh" className="h-4 w-4" />
        {busy ? "Génération…" : generated ? "Générer un nouveau code" : "Générer un code"}
      </button>

      <div className="mt-6 rounded-xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
        <strong className="text-slate-800">Étapes :</strong> générez le code, saisissez-le sur la borne, puis laissez la personne compléter son enregistrement. La borne reste ouverte pendant 20 minutes après validation.
      </div>
    </section>
  );
}
