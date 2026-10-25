"use client";

import Link from "next/link";
import { useState } from "react";

export default function AccountPassword({ username }: { username: string }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [msg, setMsg] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    if (newPassword !== confirmPassword) {
      setOk(false);
      setMsg("La confirmation ne correspond pas au nouveau mot de passe.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      setOk(res.ok);
      if (res.ok) {
        setMsg("Mot de passe modifié. Les autres sessions ont été déconnectées.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setMsg(json.error ?? "Modification impossible.");
      }
    } catch {
      setOk(false);
      setMsg("Modification impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card">
      <div className="mb-5">
        <h2 className="section-title">Mot de passe du compte</h2>
        <p className="mt-1 text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
          Compte connecté : <span className="font-semibold text-slate-700 dark:text-slate-200">{username}</span>.
          La modification déconnecte les autres sessions ouvertes. Pour réinitialiser le mot de
          passe d&apos;un autre utilisateur, utilisez la{" "}
          <Link className="font-semibold text-brand-700 underline-offset-2 hover:underline dark:text-gold-300" href="/utilisateurs">
            page Utilisateurs
          </Link>.
        </p>
      </div>
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="current-password">Mot de passe actuel</label>
          <input
            id="current-password"
            className="input"
            type="password"
            autoComplete="current-password"
            maxLength={256}
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="new-password">Nouveau mot de passe</label>
          <input
            id="new-password"
            className="input"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={256}
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">12 caractères minimum.</p>
        </div>
        <div>
          <label className="label" htmlFor="confirm-password">Confirmer le nouveau mot de passe</label>
          <input
            id="confirm-password"
            className="input"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={256}
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
          <button className="btn-primary" disabled={busy}>
            {busy ? "Modification…" : "Modifier le mot de passe"}
          </button>
          {msg && (
            <span
              role="status"
              className={`text-sm font-medium ${
                ok ? "text-[#166534] dark:text-[#c5a253]" : "text-rose-600 dark:text-rose-300"
              }`}
            >
              {msg}
            </span>
          )}
        </div>
      </form>
    </section>
  );
}
