"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/icons";

export default function GateClient({
  configured,
  libraryName,
  city,
  logoUrl,
}: {
  configured: boolean;
  libraryName: string;
  city: string;
  logoUrl: string;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const unlock = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!configured || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/self/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "Accès refusé. Adressez-vous à l'accueil.");
        return;
      }
      setPassword("");
      router.refresh();
    } catch {
      setError("Connexion impossible. Vérifiez le réseau et réessayez.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="relative flex min-h-screen min-h-dvh items-center justify-center overflow-hidden bg-brand-950 px-4 py-10 text-white">
      <div className="pointer-events-none absolute inset-0 pattern-grid opacity-20" />
      <div className="relative w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image
            src={logoUrl}
            alt={`Logo de ${libraryName}`}
            width={64}
            height={64}
            unoptimized
            className="rounded-2xl object-contain shadow-xl ring-1 ring-white/15"
          />
          <p className="mt-4 font-display text-sm font-semibold tracking-[0.12em]">{libraryName}</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-gold-300">{city}</p>
        </div>

        <section className="rounded-3xl border border-white/15 bg-white p-6 text-slate-900 shadow-2xl sm:p-8">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-700">
            <Icon name="shield" className="h-6 w-6" />
          </span>
          <h1 className="mt-4 text-center font-display text-2xl font-semibold text-brand-900">
            Enregistrer une visite
          </h1>

          {configured ? (
            <>
              <p className="mt-2 text-center text-sm leading-6 text-slate-600">
                Demandez le mot de passe de la borne à l&apos;agent d&apos;accueil et ne le partagez pas. La session se ferme automatiquement après 20 minutes.
              </p>
              <form onSubmit={unlock} className="mt-6 space-y-4">
                <div>
                  <label className="label" htmlFor="self-service-password">Mot de passe de la borne</label>
                  <input
                    id="self-service-password"
                    className="input h-12"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="off"
                    autoCapitalize="none"
                    required
                    maxLength={256}
                    autoFocus
                  />
                </div>
                {error && (
                  <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-700">
                    {error}
                  </p>
                )}
                <button className="btn-primary h-12 w-full" disabled={busy}>
                  {busy ? "Vérification…" : "Continuer"}
                  {!busy && <Icon name="arrowRight" className="h-4 w-4" />}
                </button>
              </form>
            </>
          ) : (
            <p role="status" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm leading-6 text-amber-900">
              La borne n&apos;est pas encore activée. Adressez-vous à l&apos;administrateur de la bibliothèque.
            </p>
          )}

          <Link href="/" className="mt-5 flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-brand-700 hover:bg-brand-50">
            <Icon name="arrowRight" className="h-4 w-4 rotate-180" />
            Retour à l&apos;accueil
          </Link>
        </section>

        <p className="mt-5 text-center text-xs text-white/55">
          Le mot de passe est réservé au personnel autorisé de la bibliothèque.
        </p>
      </div>
    </main>
  );
}
