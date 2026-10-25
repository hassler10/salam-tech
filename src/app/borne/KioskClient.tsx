"use client";

import Image from "next/image";
import { useEffect, useState, useCallback } from "react";

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
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[#14532d] via-[#166534] to-[#0f3d22] p-4">
      <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl sm:p-10">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image src="/logo.png" alt="Logo" width={80} height={80} className="rounded-2xl" />
          <h1 className="mt-3 text-xl font-extrabold tracking-tight text-[#14532d] sm:text-2xl">
            {libraryName}
          </h1>
          <p className="text-xs text-slate-500">{city}</p>
          <p className="mt-1 text-sm font-semibold text-[#c5a253]">Borne d&apos;enregistrement des visites</p>
        </div>
        {children}
      </div>
      <p className="mt-4 text-center text-xs text-white/60">
        Vos informations sont confidentielles : vous ne voyez que votre propre fiche.
      </p>
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
        <p className="rounded-2xl bg-slate-100 p-6 text-center text-slate-700">
          La borne d&apos;auto-enregistrement est actuellement désactivée.
          Veuillez vous adresser à l&apos;agent d&apos;accueil.
        </p>
      </Frame>
    );
  }

  if (done) {
    return (
      <Frame libraryName={libraryName} city={city}>
        <div className="animate-fade-up rounded-2xl bg-emerald-50 p-8 text-center">
          <p className="text-6xl">✅</p>
          <p className="mt-4 text-xl font-bold text-emerald-900">{done}</p>
          <p className="mt-2 text-sm text-emerald-700">
            Retour automatique à l&apos;écran d&apos;accueil…
          </p>
          <button onClick={() => { setDone(null); reset(); }} className="btn-primary mt-6 px-8 py-3 text-base">
            Terminer maintenant
          </button>
        </div>
      </Frame>
    );
  }

  if (mode === "choix") {
    return (
      <Frame libraryName={libraryName} city={city}>
        <p className="mb-5 text-center text-base text-slate-600">
          Bienvenue. Veuillez indiquer votre situation :
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <button
            onClick={() => setMode("abonne")}
            className="rounded-2xl border-2 border-[#166534] bg-[#166534]/5 p-8 text-center transition hover:bg-[#166534]/10 active:scale-[0.98]"
          >
            <p className="text-5xl">🎫</p>
            <p className="mt-3 text-lg font-bold text-[#14532d]">Je suis abonné</p>
            <p className="mt-1 text-xs text-slate-500">Avec ma carte ou mon identifiant</p>
          </button>
          <button
            onClick={() => setMode("visiteur")}
            className="rounded-2xl border-2 border-[#c5a253] bg-[#c5a253]/10 p-8 text-center transition hover:bg-[#c5a253]/20 active:scale-[0.98]"
          >
            <p className="text-5xl">🚶</p>
            <p className="mt-3 text-lg font-bold text-[#14532d]">Je suis visiteur</p>
            <p className="mt-1 text-xs text-slate-500">Visite occasionnelle</p>
          </button>
        </div>
      </Frame>
    );
  }

  if (mode === "abonne") {
    return (
      <Frame libraryName={libraryName} city={city}>
        {!me ? (
          <form onSubmit={identify} className="space-y-4">
            <p className="text-center text-sm text-slate-600">
              Saisissez votre identifiant d&apos;abonné et votre nom de famille.
            </p>
            <div>
              <label className="label">Identifiant d&apos;abonné</label>
              <input
                className="input py-3 text-center text-lg tracking-wider"
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
                className="input py-3 text-center text-lg"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
            {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-center text-sm font-medium text-rose-700">{error}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={reset} className="btn-ghost flex-1 py-3">Retour</button>
              <button className="btn-primary flex-1 py-3 text-base" disabled={busy}>
                {busy ? "Vérification…" : "Continuer"}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl bg-[#f5f7f3] p-5 text-center">
              <p className="text-sm text-slate-500">Bienvenue</p>
              <p className="text-2xl font-extrabold text-[#14532d]">{me.firstName} {me.lastName}</p>
              <p className="font-mono text-xs text-slate-400">{me.code}</p>
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
              <select className="input py-3 text-base" value={reason} onChange={(e) => setReason(e.target.value)}>
                {reasons.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-center text-sm text-rose-700">{error}</p>}
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
        <p className="text-center text-sm text-slate-600">Veuillez renseigner vos informations.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Nom *</label>
            <input className="input py-3" value={lastName} onChange={(e) => setLastName(e.target.value)} autoFocus required />
          </div>
          <div>
            <label className="label">Prénoms *</label>
            <input className="input py-3" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </div>
        </div>
        <div>
          <label className="label">Organisme (facultatif)</label>
          <input className="input py-3" value={organization} onChange={(e) => setOrganization(e.target.value)} />
        </div>
        <div>
          <label className="label">Motif de votre visite</label>
          <select className="input py-3 text-base" value={reason} onChange={(e) => setReason(e.target.value)}>
            {reasons.map((r) => <option key={r}>{r}</option>)}
          </select>
        </div>
        {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-center text-sm text-rose-700">{error}</p>}
        <div className="flex gap-3">
          <button type="button" onClick={reset} className="btn-ghost flex-1 py-3">Retour</button>
          <button className="btn-primary flex-1 py-3 text-base" disabled={busy}>
            {busy ? "Enregistrement…" : "Valider ma visite"}
          </button>
        </div>
      </form>
    </Frame>
  );
}
