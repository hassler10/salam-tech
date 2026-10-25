"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/icons";

const FEATURES = [
  { icon: "ticket", title: "Borne libre-service", text: "Enregistrement autonome des visiteurs" },
  { icon: "wifi", title: "Mode hors-ligne", text: "File d'attente locale et synchronisation" },
  { icon: "chart", title: "Statistiques en direct", text: "Fréquentation, motifs, abonnements" },
  { icon: "shield", title: "3 rôles sécurisés", text: "Admin, responsable et agent d'accueil" },
] as const;

export default function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(json.error ?? "Connexion impossible.");
      return;
    }
    router.push("/");
    router.refresh();
  };

  return (
    <div className="relative min-h-screen bg-brand-950 lg:grid lg:grid-cols-[1.08fr_1fr]">
      {/* Vitrine */}
      <div className="relative hidden overflow-hidden lg:block">
        <Image
          src="/bibliotheque-salam.jpg"
          alt="Salle de lecture de la Bibliothèque de la Mosquée Salam du Plateau"
          fill
          priority
          sizes="55vw"
          className="object-cover object-[64%_center]"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-brand-950/95 via-brand-950/75 to-brand-800/30" />
        <div className="absolute inset-0 pattern-grid opacity-25" />
        <div className="absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-gold-500/15 blur-3xl" />
        <div className="absolute -top-24 right-0 h-80 w-80 rounded-full bg-brand-400/15 blur-3xl" />

        <div className="relative flex h-full flex-col justify-between p-10 text-white xl:p-14">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Logo"
              width={52}
              height={52}
              className="rounded-2xl shadow-xl ring-1 ring-white/20"
            />
            <div>
              <p className="font-display text-[13px] font-semibold tracking-[0.18em]">SALAM LIBRARY PRO</p>
              <p className="mt-0.5 text-[10.5px] uppercase tracking-[0.22em] text-gold-300">
                Mosquée Salam du Plateau
              </p>
            </div>
          </div>

          <div className="max-w-xl">
            <p className="eyebrow text-gold-300">
              <span className="h-1 w-6 rounded-full bg-gradient-to-r from-gold-300 to-gold-500" />
              La culture, pilotée avec élégance
            </p>
            <h1 className="mt-5 font-display text-[42px] font-semibold leading-[1.06] tracking-tight xl:text-[52px]">
              Une bibliothèque
              <br />
              <span className="text-gradient-gold">connectée</span> à ses lecteurs.
            </h1>
            <p className="mt-5 max-w-lg text-[13.5px] leading-7 text-white/65">
              Abonnés, visiteurs, fréquentation et borne libre-service réunis dans une seule
              plateforme — pensée pour le terrain, disponible même sans connexion.
            </p>

            <div className="mt-8 grid max-w-lg grid-cols-2 gap-3">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="rounded-2xl border border-white/10 bg-white/[0.055] p-3.5 backdrop-blur-sm transition hover:border-gold-400/30 hover:bg-white/[0.08]"
                >
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-gold-400/15 text-gold-300">
                    <Icon name={f.icon} className="h-4 w-4" />
                  </span>
                  <p className="mt-2.5 text-[12px] font-semibold text-white">{f.title}</p>
                  <p className="mt-0.5 text-[10.5px] leading-relaxed text-white/45">{f.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between text-[10.5px] uppercase tracking-[0.18em] text-white/35">
            <span>Abidjan · Côte d&apos;Ivoire</span>
            <span>Édition 2026</span>
          </div>
        </div>
      </div>

      {/* Formulaire */}
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-8">
        <div className="pointer-events-none absolute -top-24 right-0 h-72 w-72 rounded-full bg-gold-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-0 h-80 w-80 rounded-full bg-brand-500/10 blur-3xl" />

        <div className="relative w-full max-w-[420px]">
          <div className="mb-7 flex items-center gap-3 lg:hidden">
            <Image src="/logo.png" alt="Logo" width={46} height={46} className="rounded-2xl shadow-lg" />
            <div>
              <p className="font-display text-[13px] font-semibold tracking-[0.14em] text-white">
                SALAM LIBRARY
              </p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-gold-300">
                Mosquée Salam du Plateau
              </p>
            </div>
          </div>

          <div className="animate-fade-up card p-6 sm:p-8">
            <p className="eyebrow">Espace de gestion</p>
            <h2 className="mt-2 font-display text-[25px] font-semibold tracking-tight text-slate-900 dark:text-white">
              Bon retour parmi nous
            </h2>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-500 dark:text-slate-400">
              Identifiez-vous pour accéder au tableau de bord de la bibliothèque.
            </p>

            <form onSubmit={submit} className="mt-7 space-y-4">
              <div>
                <label className="label" htmlFor="u">Identifiant</label>
                <input
                  id="u"
                  className="input h-11"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  placeholder="Votre identifiant"
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="p">Mot de passe</label>
                <input
                  id="p"
                  type="password"
                  className="input h-11"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                />
              </div>
              {error && (
                <p className="flex items-start gap-2 rounded-xl border border-rose-500/15 bg-rose-500/[0.07] px-3.5 py-2.5 text-[12.5px] font-medium text-rose-700 dark:text-rose-300">
                  <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </p>
              )}
              <button className="btn-primary h-11 w-full text-[13.5px]" disabled={loading}>
                {loading ? "Connexion…" : "Se connecter"}
                {!loading && <Icon name="arrowRight" className="h-4 w-4" />}
              </button>
            </form>

            <div className="my-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-slate-200/80 dark:bg-white/10" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">ou</span>
              <span className="h-px flex-1 bg-slate-200/80 dark:bg-white/10" />
            </div>

            <a
              href="/borne"
              className="group flex items-center gap-3 rounded-2xl border border-gold-500/25 bg-gold-500/[0.06] p-3.5 transition hover:border-gold-500/45 hover:bg-gold-500/10"
            >
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gold-500/15 text-gold-700 dark:text-gold-300">
                <Icon name="ticket" className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-semibold text-slate-800 dark:text-slate-100">
                  Borne d&apos;auto-enregistrement
                </span>
                <span className="block text-[10.5px] text-slate-500 dark:text-slate-400">
                  Enregistrer une visite sans compte
                </span>
              </span>
              <Icon name="arrowRight" className="h-4 w-4 text-gold-600 transition group-hover:translate-x-0.5" />
            </a>
          </div>

          <details className="group mt-5 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[11.5px] text-white/50 backdrop-blur">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-white/80 marker:hidden">
              Comptes de démarrage
              <Icon name="arrowRight" className="h-3.5 w-3.5 text-white/40 transition group-open:rotate-90" />
            </summary>
            <div className="mt-3 space-y-1.5 font-mono text-[11px]">
              <p className="flex justify-between"><span>admin</span><span className="text-gold-300">admin123</span></p>
              <p className="flex justify-between"><span>responsable</span><span className="text-gold-300">respo123</span></p>
              <p className="flex justify-between"><span>agent</span><span className="text-gold-300">agent123</span></p>
            </div>
            <p className="mt-3 text-[10.5px] text-white/35">
              À modifier dès la première connexion.
            </p>
          </details>

          <p className="mt-6 text-center text-[10.5px] text-slate-400 dark:text-slate-500">
            © 2026 Bibliothèque de la Mosquée Salam du Plateau · Abidjan
          </p>
        </div>
      </div>
    </div>
  );
}
