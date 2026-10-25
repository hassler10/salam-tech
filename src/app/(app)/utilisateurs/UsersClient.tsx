"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type U = { id: number; username: string; fullName: string; role: string; active: boolean; createdAt: string };

const ROLES = [
  { v: "admin", l: "Administrateur" },
  { v: "responsable", l: "Responsable de la bibliothèque" },
  { v: "agent", l: "Agent d'accueil" },
];

export default function UsersClient({ rows }: { rows: U[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", fullName: "", password: "", role: "agent" });
  const [msg, setMsg] = useState("");
  const [pwd, setPwd] = useState<Record<number, string>>({});

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json().catch(() => ({}));
    setMsg(res.ok ? "Utilisateur créé." : (json.error ?? "Erreur."));
    if (res.ok) {
      setForm({ username: "", fullName: "", password: "", role: "agent" });
      router.refresh();
    }
  };

  const patch = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(json.error ?? "Modification impossible.");
    router.refresh();
  };

  return (
    <div className="space-y-5">
      <form onSubmit={create} className="card grid grid-cols-1 gap-3 sm:grid-cols-5">
        <input className="input" required placeholder="Identifiant *" pattern="[a-z0-9][a-z0-9._-]{2,31}" title="3 à 32 caractères : lettres minuscules, chiffres, point, tiret ou underscore" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        <input className="input" required maxLength={160} placeholder="Nom complet *" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        <input className="input" required type="password" minLength={12} maxLength={256} autoComplete="new-password" placeholder="Mot de passe (12 caractères min.) *" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          {ROLES.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
        </select>
        <button className="btn-primary">Créer l&apos;utilisateur</button>
        {msg && <p className="text-sm font-medium text-[#166534] sm:col-span-5">{msg}</p>}
      </form>

      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Identifiant</th><th>Nom complet</th><th>Rôle</th><th>État</th><th>Créé le</th><th>Nouveau mot de passe</th><th></th></tr></thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td className="font-mono text-xs">{u.username}</td>
                <td className="font-semibold">{u.fullName}</td>
                <td>
                  <select className="input py-1 text-xs" value={u.role} onChange={(e) => patch({ id: u.id, role: e.target.value })}>
                    {ROLES.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
                  </select>
                </td>
                <td>
                  <span className={`badge ${u.active ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-700"}`}>
                    {u.active ? "Actif" : "Désactivé"}
                  </span>
                </td>
                <td>{new Date(u.createdAt).toLocaleDateString("fr-FR")}</td>
                <td>
                  <div className="flex gap-1">
                    <input className="input py-1 text-xs" type="password" minLength={12} maxLength={256} autoComplete="new-password" placeholder="12 caractères min." value={pwd[u.id] ?? ""} onChange={(e) => setPwd({ ...pwd, [u.id]: e.target.value })} />
                    <button className="btn-ghost px-2 py-1 text-xs" onClick={() => { patch({ id: u.id, password: pwd[u.id] }); setPwd({ ...pwd, [u.id]: "" }); }}>OK</button>
                  </div>
                </td>
                <td>
                  <button className="btn-ghost px-3 py-1 text-xs" onClick={() => patch({ id: u.id, active: !u.active })}>
                    {u.active ? "Désactiver" : "Activer"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
