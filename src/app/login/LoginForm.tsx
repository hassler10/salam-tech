"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#14532d] via-[#166534] to-[#0f3d22] p-4">
      <div className="animate-fade-up w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl dark:bg-slate-900">
        <div className="flex flex-col items-center text-center">
          <Image src="/logo.png" alt="Logo de la Mosquée Salam du Plateau" width={96} height={96} className="rounded-2xl" />
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-[#14532d] dark:text-[#c5a253]">
            SALAM LIBRARY PRO
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Bibliothèque de la Mosquée Salam du Plateau
          </p>
          <p className="text-xs text-slate-400">Abidjan, Côte d&apos;Ivoire</p>
        </div>

        <form onSubmit={submit} className="mt-8 space-y-4">
          <div>
            <label className="label" htmlFor="u">Identifiant</label>
            <input id="u" className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
          </div>
          <div>
            <label className="label" htmlFor="p">Mot de passe</label>
            <input id="p" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </div>
          {error && (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
              {error}
            </p>
          )}
          <button className="btn-primary w-full py-2.5" disabled={loading}>
            {loading ? "Connexion…" : "Se connecter"}
          </button>
        </form>

        <a
          href="/borne"
          className="mt-5 flex items-center justify-center gap-2 rounded-xl border-2 border-[#c5a253] px-4 py-3 text-sm font-bold text-[#14532d] transition hover:bg-[#c5a253]/10 dark:text-[#c5a253]"
        >
          🎫 Borne d&apos;auto-enregistrement des visites
        </a>

        <div className="mt-6 rounded-xl bg-[#f5f7f3] p-3 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <p className="font-semibold text-[#14532d] dark:text-[#c5a253]">Comptes de démarrage</p>
          <p>admin / admin123 — responsable / respo123 — agent / agent123</p>
          <p className="mt-1 text-slate-400">Modifiez ces mots de passe dès la première connexion.</p>
        </div>
      </div>
    </div>
  );
}
