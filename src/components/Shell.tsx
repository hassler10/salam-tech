"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { listQueue, syncQueue, putCache } from "@/lib/offline";

export type NavUser = { fullName: string; role: string; username: string };

const NAV: { href: string; label: string; icon: string; roles: string[]; group: string }[] = [
  { href: "/dashboard", label: "Tableau de bord + Accueil", icon: "📊", roles: ["admin", "responsable"], group: "Pilotage" },
  { href: "/accueil", label: "Accueil (plein écran)", icon: "🛎️", roles: ["admin", "responsable", "agent"], group: "Pilotage" },
  { href: "/abonnes", label: "Gestion des abonnés", icon: "👥", roles: ["admin", "responsable", "agent"], group: "Personnes" },
  { href: "/visiteurs", label: "Gestion des visiteurs", icon: "🚶", roles: ["admin", "responsable", "agent"], group: "Personnes" },
  { href: "/visites", label: "Historique des visites", icon: "🗂️", roles: ["admin", "responsable", "agent"], group: "Personnes" },
  { href: "/abonnements", label: "Suivi des abonnements", icon: "⏳", roles: ["admin", "responsable", "agent"], group: "Abonnements" },
  { href: "/types-abonnement", label: "Types et durées", icon: "🏷️", roles: ["admin"], group: "Abonnements" },
  { href: "/import", label: "Import du registre", icon: "⬆️", roles: ["admin"], group: "Abonnements" },
  { href: "/statistiques", label: "Statistiques générales", icon: "📈", roles: ["admin", "responsable"], group: "Analyse" },
  { href: "/statistiques-individuelles", label: "Statistiques individuelles", icon: "🔎", roles: ["admin", "responsable"], group: "Analyse" },
  { href: "/rapports", label: "Rapports & exportations", icon: "🧾", roles: ["admin", "responsable"], group: "Analyse" },
  { href: "/synchronisation", label: "Centre de synchronisation", icon: "🔄", roles: ["admin", "responsable", "agent"], group: "Système" },
  { href: "/utilisateurs", label: "Gestion des utilisateurs", icon: "🔐", roles: ["admin"], group: "Système" },
  { href: "/audit", label: "Journal d'audit", icon: "📝", roles: ["admin"], group: "Système" },
  { href: "/parametres", label: "Paramètres", icon: "⚙️", roles: ["admin"], group: "Système" },
];

export default function Shell({ user, children }: { user: NavUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    setOnline(navigator.onLine);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  const refresh = useCallback(async () => {
    setPending((await listQueue()).length);
  }, []);

  useEffect(() => {
    refresh();
    const i = setInterval(refresh, 4000);
    const on = async () => {
      setOnline(true);
      const r = await syncQueue();
      if (r.synced > 0) router.refresh();
      refresh();
    };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      clearInterval(i);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [refresh, router]);

  useEffect(() => {
    // cache des données nécessaires au mode hors connexion
    fetch("/api/offline-data")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && putCache("offline-data", d))
      .catch(() => undefined);
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("slp-theme", next ? "dark" : "light");
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const items = NAV.filter((n) => n.roles.includes(user.role));
  const groups = [...new Set(items.map((i) => i.group))];

  return (
    <div className="min-h-screen lg:flex">
      {/* Sidebar */}
      <aside
        className={`no-print fixed inset-y-0 left-0 z-40 w-72 transform overflow-y-auto bg-[#14532d] text-white transition-transform lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
          <Image src="/logo.png" alt="Logo CMP" width={44} height={44} className="rounded-lg bg-white p-0.5" />
          <div>
            <p className="text-sm font-extrabold leading-tight tracking-wide">SALAM LIBRARY PRO</p>
            <p className="text-[11px] text-[#c5a253]">Mosquée Salam du Plateau</p>
          </div>
        </div>
        <nav className="space-y-5 px-3 py-4">
          {groups.map((g) => (
            <div key={g}>
              <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-white/40">{g}</p>
              <div className="space-y-1">
                {items
                  .filter((i) => i.group === g)
                  .map((i) => {
                    const active = pathname === i.href || pathname.startsWith(i.href + "/");
                    return (
                      <Link
                        key={i.href}
                        href={i.href}
                        onClick={() => setOpen(false)}
                        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                          active
                            ? "bg-[#c5a253] font-semibold text-[#14532d] shadow"
                            : "text-white/85 hover:bg-white/10"
                        }`}
                      >
                        <span>{i.icon}</span>
                        <span>{i.label}</span>
                      </Link>
                    );
                  })}
              </div>
            </div>
          ))}
        </nav>
        <div className="px-3 pb-6">
          <a
            href="/borne"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-xl border border-[#c5a253]/50 px-3 py-2.5 text-sm text-[#c5a253] transition hover:bg-[#c5a253]/10"
          >
            <span>🎫</span>
            <span>Ouvrir la borne publique</span>
          </a>
          <p className="mt-4 px-2 text-[11px] text-white/40">Aucun module financier — version 1.0</p>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-700 dark:bg-slate-900/90">
          <button className="btn-ghost px-3 py-1.5 lg:hidden" onClick={() => setOpen(true)} aria-label="Menu">
            ☰
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-[#14532d] dark:text-[#c5a253]">
              Bibliothèque de la Mosquée Salam du Plateau
            </p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">Abidjan, Côte d&apos;Ivoire</p>
          </div>
          <span
            className={`badge ${
              online
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                : "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
            }`}
            title="État de la connexion"
          >
            {online ? "● En ligne" : "● Hors connexion"}
          </span>
          {pending > 0 && (
            <Link href="/synchronisation" className="badge bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
              {pending} en attente
            </Link>
          )}
          <button onClick={toggleTheme} className="btn-ghost px-3 py-1.5" title="Mode clair / sombre">
            {dark ? "☀️" : "🌙"}
          </button>
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold leading-tight">{user.fullName}</p>
            <p className="text-[11px] uppercase tracking-wide text-[#c5a253]">{user.role}</p>
          </div>
          <button onClick={logout} className="btn-ghost px-3 py-1.5" title="Se déconnecter">
            ⎋
          </button>
        </header>
        <main className="animate-fade-up flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
