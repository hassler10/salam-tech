"use client";

import Image from "next/image";
import { useEffect, useState, useCallback } from "react";
import { Icon } from "@/components/icons";

type Me = {
  code: string;
  firstName: string;
  lastName: string;
  typeName: string | null;
  endDate: string | null;
  daysLeft: number | null;
  status: string;
  statusLabel: string;
};

const TONES: Record<string, string> = {
  actif: "bg-emerald-100 text-emerald-900",
  bientot: "bg-amber-100 text-amber-900",
  imminent: "bg-orange-100 text-orange-900",
  expire: "bg-rose-100 text-rose-900",
  suspendu: "bg-slate-200 text-slate-800",
  aucun: "bg-slate-200 text-slate-800",
};

function Frame({
  children,
  libraryName,
  city,
}: {
  children: React.ReactNode;
  libraryName: string;
  city: string;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-brand-950 px-4 py-8 text-white sm:px-6">
      <Image
        src="/hero-library.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover opacity-25"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-brand-950/95 via-brand-950/85 to-brand-900/55" />
      <div className="absolute inset-0 pattern-grid opacity-20" />
      <div className="pointer-events-none absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-gold-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-10 h-80 w-80 rounded-full bg-brand-400/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-3xl flex-col justify-center">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Image
            src="/logo.png"
            alt="Logo"
            width={72}
            height={72}
            className="rounded-2xl shadow-2xl ring-1 ring-white/20"
          />
          <div>
            <p className="font-display text-[13px] font-semibold tracking-[0.16em] text-white">{libraryName}</p>
            <p className="mt-1 text-[10.5px] uppercase tracking-[0.22em] text-gold-300">{city}</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60 backdrop-blur">
            <Icon name="ticket" className="h-3.5 w-3.5 text-gold-300" />
            Borne de visite
          </span>
        </div>

        <div className="kiosk rounded-[30px] border border-white/15 bg-white p-5 text-slate-900 shadow-[0_40px_90px_-30px_rgb(0_0_0/0.65)] sm:p-8">
          {children}
        </div>

        <p className="mt-5 text-center text-[10.5px] text-white/40">
          Vos informations sont confidentielles : vous ne voyez que votre propre fiche.
        </p>
      </div>
    </div>
  );
}

export default function KioskClient({
  enabled,
  reasons,
  libraryName,
  city,
}: {
  enabled: boolean;
  reasons: string[];
  libraryName: string;
  city: string;
}) {
  const [mode, setMode] = useState<"choix" | "abonne" | "visiteur">("choix");
  const [code, setCode] = useState("");
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [organization, setOrganization] = useState("");
  const [reason, setReason] = useState(reasons[0] ?? "");
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = useCallback(() => {
    setMode("choix");
    setCode("");
    setLastName("");
    setFirstName("");
    setOrganization("");
    setReason(reasons[0] ?? "");
    setMe(null);
    setError("");
    setBusy(false);
  }, [reasons]);

  // Retour automatique à l'écran d'accueil : aucune donnée ne reste affichée.
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => {
      setDone(null);
      reset();
    }, 6000);
    return () => clearTimeout(t);
  }, [done, reset]);

  useEffect(() => {
    if (mode === "choix" || done) return;
    const t = setTimeout(() => reset(), 120000);
    return () => clearTimeout(t);
  }, [mode, done, reset]);

  const identify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/self/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, lastName }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Identification impossible.");
      return;
    }
    setMe(json.data as Me);
  };

  const register = async (personType: "abonne" | "visiteur") => {
    setBusy(true);
    setError("");
    const res = await fetch("/api/self/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personType,
        code,
        lastName,
        firstName,
        organization,
        reason,
        uid: crypto.randomUUID(),
      }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.status === 409) {
      setDone(json.message ?? "Visite déjà enregistrée.");
      return;
    }
    if (!res.ok) {
      setError(json.error ?? "Enregistrement impossible.");
      return;
    }
    setDone("Votre visite a bien été enregistrée. Bonne lecture !");
  };

  if (!enabled) {
    return (
      <Frame libraryName={libraryName} city={city}>
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-8 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-200/70 text-slate-500">
            <Icon name="alert" className="h-6 w-6" />
          </span>
          <p className="mt-4 text-sm text-slate-600">
            La borne d&apos;auto-enregistrement est actuellement désactivée.
            Veuillez vous adresser à l&apos;agent d&apos;accueil.
          </p>
        </div>
      </Frame>
    );
  }

  if (done) {
    return (
      <Frame libraryName={libraryName} city={city}>
        <div className="animate-fade-up py-4 text-center">
          <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-brand-600/10 text-brand-700 ring-8 ring-brand-600/[0.05]">
            <Icon name="check" className="h-9 w-9" strokeWidth={2.2} />
          </span>
          <h2 className="mt-5 font-display text-2xl font-semibold text-brand-900">Merci !</h2>
          <p className="mt-2 text-sm text-slate-600">{done}</p>
          <p className="mt-1 text-xs text-slate-400">Retour automatique à l&apos;écran d&apos;accueil…</p>
          <button
            onClick={() => { setDone(null); reset(); }}
            className="btn-primary mt-6 px-8 py-3 text-base"
          >
            Terminer maintenant
            <Icon name="arrowRight" className="h-4 w-4" />
          </button>
        </div>
      </Frame>
    );
  }

  if (mode === "choix") {
    return (
      <Frame libraryName={libraryName} city={city}>
        <p className="mb-5 text-center text-sm text-slate-500">
          Bienvenue. Indiquez votre situation pour commencer.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <button
            onClick={() => setMode("abonne")}
            className="group rounded-2xl border border-brand-600/20 bg-brand-50/60 p-6 text-center transition hover:-translate-y-0.5 hover:border-brand-600/40 hover:shadow-lg active:scale-[0.99]"
          >
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/25 transition group-hover:scale-105">
              <Icon name="ticket" className="h-6 w-6" />
            </span>
            <p className="mt-4 font-display text-lg font-semibold text-brand-900">Je suis abonné</p>
            <p className="mt-1 text-xs text-slate-500">Avec ma carte ou mon identifiant</p>
          </button>
          <button
            onClick={() => setMode("visiteur")}
            className="group rounded-2xl border border-gold-500/30 bg-gold-50/70 p-6 text-center transition hover:-translate-y-0.5 hover:border-gold-500/50 hover:shadow-lg active:scale-[0.99]"
          >
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-b from-gold-300 to-gold-500 text-brand-950 shadow-glow transition group-hover:scale-105">
              <Icon name="userPlus" className="h-6 w-6" />
            </span>
            <p className="mt-4 font-display text-lg font-semibold text-brand-900">Je suis visiteur</p>
            <p className="mt-1 text-xs text-slate-500">Visite occasionnelle</p>
          </button>
        </div>
        <p className="mt-6 text-center text-[11px] text-slate-400">
          Enregistrement en moins de 30 secondes · Aucune donnée partagée
        </p>
      </Frame>
    );
  }

  if (mode === "abonne") {
    return (
      <Frame libraryName={libraryName} city={city}>
        {!me ? (
          <form onSubmit={identify} className="space-y-4">
            <div className="text-center">
              <p className="eyebrow justify-center">Étape 1 · Identification</p>
              <p className="mt-1.5 text-sm text-slate-500">
                Saisissez votre identifiant d&apos;abonné et votre nom de famille.
              </p>
            </div>
            <div>
              <label className="label">Identifiant d&apos;abonné</label>
              <input
                className="input h-12 text-center text-base tracking-wider"
                placeholder="AB-2026-0001"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div>
              <label className="label">Nom de famille</label>
              <input
                className="input h-12 text-center text-base"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
            {error && (
              <p className="flex items-center justify-center gap-2 rounded-xl border border-rose-500/15 bg-rose-50 px-4 py-3 text-center text-sm font-medium text-rose-700">
                <Icon name="alert" className="h-4 w-4 shrink-0" />
                {error}
              </p>
            )}
            <div className="flex gap-3">
              <button type="button" onClick={reset} className="btn-ghost flex-1 py-3">Retour</button>
              <button className="btn-primary flex-1 py-3 text-base" disabled={busy}>
                {busy ? "Vérification…" : "Continuer"}
                {!busy && <Icon name="arrowRight" className="h-4 w-4" />}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-2xl border border-brand-600/15 bg-gradient-to-br from-brand-50 to-white p-6 text-center">
              <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gold-400/15 blur-2xl" />
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white text-brand-700 shadow-sm ring-1 ring-brand-600/10">
                <Icon name="check" className="h-6 w-6" />
              </span>
              <p className="mt-3 text-[10.5px] uppercase tracking-[0.18em] text-slate-400">Bienvenue</p>
              <p className="mt-1 font-display text-2xl font-semibold text-brand-900">{me.firstName} {me.lastName}</p>
              <p className="font-mono text-[11px] text-slate-400">{me.code}</p>
              <span className={`badge mt-3 ${TONES[me.status] ?? "bg-slate-200"}`}>{me.statusLabel}</span>
              {me.endDate && (
                <p className="mt-2 text-sm text-slate-600">
                  {me.typeName} — valide jusqu&apos;au <strong>{me.endDate}</strong>
                  {me.daysLeft !== null && me.daysLeft >= 0 && <> ({me.daysLeft} jour(s) restant(s))</>}
                </p>
              )}
              {me.status === "expire" && (
                <p className="mt-2 text-sm font-semibold text-rose-700">
                  Votre abonnement est expiré. Vous pouvez enregistrer votre visite,
                  puis vous rapprocher de l&apos;agent d&apos;accueil.
                </p>
              )}
            </div>
            <div>
              <label className="label">Motif de votre visite</label>
              <select className="input h-12 text-base" value={reason} onChange={(e) => setReason(e.target.value)}>
                {reasons.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            {error && (
              <p className="flex items-center justify-center gap-2 rounded-xl border border-rose-500/15 bg-rose-50 px-4 py-3 text-center text-sm text-rose-700">
                <Icon name="alert" className="h-4 w-4 shrink-0" />
                {error}
              </p>
            )}
            <div className="flex gap-3">
              <button onClick={reset} className="btn-ghost flex-1 py-3">Annuler</button>
              <button onClick={() => register("abonne")} className="btn-primary flex-1 py-3 text-base" disabled={busy}>
                {busy ? "Enregistrement…" : "Valider ma visite"}
              </button>
            </div>
          </div>
        )}
      </Frame>
    );
  }

  return (
    <Frame libraryName={libraryName} city={city}>
      <form
        className="space-y-4"
        onSubmit={(e) => { e.preventDefault(); register("visiteur"); }}
      >
        <div className="text-center">
          <p className="eyebrow justify-center">Étape 1 · Vos informations</p>
          <p className="mt-1.5 text-sm text-slate-500">Veuillez renseigner vos informations.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Nom *</label>
            <input className="input h-12" value={lastName} onChange={(e) => setLastName(e.target.value)} autoFocus required />
          </div>
          <div>
            <label className="label">Prénoms *</label>
            <input className="input h-12" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </div>
        </div>
        <div>
          <label className="label">Fonction (facultatif)</label>
          <input
            className="input h-12"
            placeholder="Ex. : Étudiant, enseignant…"
            value={organization}
            onChange={(e) => setOrganization(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Motif de votre visite</label>
          <select className="input h-12 text-base" value={reason} onChange={(e) => setReason(e.target.value)}>
            {reasons.map((r) => <option key={r}>{r}</option>)}
          </select>
        </div>
        {error && (
          <p className="flex items-center justify-center gap-2 rounded-xl border border-rose-500/15 bg-rose-50 px-4 py-3 text-center text-sm text-rose-700">
            <Icon name="alert" className="h-4 w-4 shrink-0" />
            {error}
          </p>
        )}
        <div className="flex gap-3">
          <button type="button" onClick={reset} className="btn-ghost flex-1 py-3">Retour</button>
          <button className="btn-primary flex-1 py-3 text-base" disabled={busy}>
            {busy ? "Enregistrement…" : "Valider ma visite"}
            {!busy && <Icon name="check" className="h-4 w-4" />}
          </button>
        </div>
      </form>
    </Frame>
  );
}
