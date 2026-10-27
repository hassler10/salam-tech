"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { listQueue, syncQueue, putCache, clearCache } from "@/lib/offline";
import { Icon, type IconName } from "./icons";

export type NavUser = { fullName: string; role: string; username: string };

export type ShellBranding = { name: string; shortName: string; org: string; logoUrl: string };

const NAV: { href: string; label: string; icon: IconName; roles: string[]; group: string }[] = [
  { href: "/dashboard", label: "Tableau de bord", icon: "grid", roles: ["admin", "responsable"], group: "Pilotage" },
  { href: "/accueil", label: "Enregistrer une visite", icon: "bell", roles: ["admin", "responsable", "agent"], group: "Pilotage" },
  { href: "/code-borne", label: "Code de la borne", icon: "shield", roles: ["admin", "responsable", "agent"], group: "Pilotage" },
  { href: "/abonnes", label: "Gestion des abonnés", icon: "users", roles: ["admin", "responsable", "agent"], group: "Personnes" },
  { href: "/visiteurs", label: "Gestion des visiteurs", icon: "userPlus", roles: ["admin", "responsable", "agent"], group: "Personnes" },
  { href: "/visites", label: "Historique des visites", icon: "history", roles: ["admin", "responsable", "agent"], group: "Personnes" },
  { href: "/abonnements", label: "Suivi des abonnements", icon: "clock", roles: ["admin", "responsable", "agent"], group: "Abonnements" },
  { href: "/types-abonnement", label: "Types et durées", icon: "tag", roles: ["admin"], group: "Abonnements" },
  { href: "/import", label: "Import du registre", icon: "upload", roles: ["admin"], group: "Abonnements" },
  { href: "/statistiques", label: "Statistiques générales", icon: "chart", roles: ["admin", "responsable"], group: "Analyse" },
  { href: "/statistiques-individuelles", label: "Statistiques individuelles", icon: "search", roles: ["admin", "responsable"], group: "Analyse" },
  { href: "/rapports", label: "Rapports & exportations", icon: "file", roles: ["admin", "responsable"], group: "Analyse" },
  { href: "/synchronisation", label: "Centre de synchronisation", icon: "refresh", roles: ["admin", "responsable", "agent"], group: "Système" },
  { href: "/utilisateurs", label: "Gestion des utilisateurs", icon: "shield", roles: ["admin"], group: "Système" },
  { href: "/audit", label: "Journal d'audit", icon: "list", roles: ["admin"], group: "Système" },
  { href: "/parametres", label: "Paramètres", icon: "settings", roles: ["admin"], group: "Système" },
];

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrateur",
  responsable: "Responsable",
  agent: "Agent d'accueil",
};

export default function Shell({
  user,
  branding,
  children,
}: {
  user: NavUser;
  branding: ShellBranding;
  children: React.ReactNode;
}) {
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

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

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
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      await clearCache("offline-data").catch(() => undefined);
      router.push("/login");
      router.refresh();
    }
  };

  const items = NAV.filter((n) => n.roles.includes(user.role));
  const groups = [...new Set(items.map((i) => i.group))];
  const section = items.find((i) => pathname === i.href || pathname.startsWith(i.href + "/"))?.label;
  const initials = user.fullName
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen">
      <aside
        className={`no-print fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[calc(100vw-1rem)] flex-col overflow-hidden bg-gradient-to-b from-brand-800 via-brand-900 to-brand-950 text-white shadow-2xl transition-transform duration-300 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="pointer-events-none absolute inset-0 pattern-dots opacity-25" />
        <div className="pointer-events-none absolute -left-16 top-24 h-56 w-56 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-10 h-56 w-56 rounded-full bg-gold-500/10 blur-3xl" />

        <div className="relative flex items-center gap-3 px-6 pb-5 pt-6">
          <Image
            src={branding.logoUrl}
            alt={`Logo de ${branding.name}`}
            width={46}
            height={46}
            unoptimized
            className="rounded-2xl object-contain shadow-lg ring-1 ring-white/15"
          />
          <div className="min-w-0">
            <p className="font-display text-[14px] font-semibold leading-tight tracking-[0.08em]">
              {branding.shortName}
            </p>
            <p className="mt-0.5 truncate text-[10.5px] uppercase tracking-[0.2em] text-gold-300">
              {branding.org}
            </p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="ml-auto grid h-11 w-11 place-items-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Fermer le menu"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        <div className="mx-6 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

        <nav className="relative flex-1 overflow-y-auto px-3 py-5">
          <div className="space-y-6">
            {groups.map((g) => (
              <div key={g}>
                <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/35">
                  {g}
                </p>
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
                          aria-current={active ? "page" : undefined}
                          className={`group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] transition ${
                            active
                              ? "bg-white/[0.09] font-semibold text-white ring-1 ring-inset ring-white/10"
                              : "text-white/65 hover:bg-white/[0.05] hover:text-white"
                          }`}
                        >
                          <span
                            className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition ${
                              active
                                ? "bg-gold-400/15 text-gold-300"
                                : "bg-white/[0.04] text-white/45 group-hover:text-white/80"
                            }`}
                          >
                            <Icon name={i.icon} className="h-[17px] w-[17px]" />
                          </span>
                          <span className="truncate">{i.label}</span>
                          {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-gold-400" />}
                        </Link>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </nav>

        <div className="relative px-4 pb-5">
          <p className="mt-4 px-1 text-[10px] tracking-wide text-white/30">
            Version 1.0 · Aucun module financier
          </p>
        </div>
      </aside>

      {open && (
        <button
          className="no-print fixed inset-0 z-40 bg-brand-950/60 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
          aria-label="Fermer le menu"
          tabIndex={-1}
        />
      )}

      <div className="flex min-h-screen min-w-0 flex-col lg:pl-[280px]">
        <header className="no-print sticky top-0 z-30 flex items-center gap-3 border-b border-brand-900/[0.06] bg-[var(--app-bg)]/75 px-4 py-3 backdrop-blur-xl dark:border-white/[0.06] sm:px-6">
          <button
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-200/80 bg-white/70 text-slate-600 transition hover:bg-white lg:hidden dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
            onClick={() => setOpen(true)}
            aria-label="Ouvrir le menu"
          >
            <Icon name="menu" className="h-5 w-5" />
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[13.5px] font-semibold text-brand-900 dark:text-white">
              {section ?? branding.name}
            </p>
            <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
              Abidjan, Côte d&apos;Ivoire
            </p>
          </div>

          <span
            className={`hidden items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold sm:inline-flex ${
              online
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-300"
            }`}
            title="État de la connexion"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span
                className={`absolute inline-flex h-full w-full rounded-full opacity-70 animate-pulse-soft ${
                  online ? "bg-emerald-400" : "bg-rose-400"
                }`}
              />
              <span
                className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
                  online ? "bg-emerald-500" : "bg-rose-500"
                }`}
              />
            </span>
            {online ? "En ligne" : "Hors connexion"}
          </span>

          {pending > 0 && (
            <Link
              href="/synchronisation"
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300"
            >
              <Icon name="refresh" className="h-3.5 w-3.5" />
              {pending} en attente
            </Link>
          )}

          <button
            onClick={toggleTheme}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-200/80 bg-white/70 text-slate-500 transition hover:bg-white hover:text-brand-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:text-gold-300"
            title="Mode clair / sombre"
            aria-label="Changer de thème"
          >
            <Icon name={dark ? "sun" : "moon"} className="h-[18px] w-[18px]" />
          </button>

          <div className="mx-1 hidden h-8 w-px bg-slate-200/80 sm:block dark:bg-white/10" />

          <div className="hidden items-center gap-2.5 sm:flex">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-brand-600 to-brand-900 text-[11px] font-bold text-gold-200 ring-1 ring-white/20">
              {initials}
            </span>
            <div className="hidden text-right md:block">
              <p className="max-w-[160px] truncate text-[12.5px] font-semibold leading-tight text-slate-800 dark:text-slate-100">
                {user.fullName}
              </p>
              <p className="text-[10px] uppercase tracking-[0.12em] text-gold-700 dark:text-gold-300">
                {ROLE_LABEL[user.role] ?? user.role}
              </p>
            </div>
          </div>

          <button
            onClick={logout}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-200/80 bg-white/70 text-slate-500 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-rose-500/40 dark:hover:bg-rose-500/10 dark:hover:text-rose-300"
            title="Se déconnecter"
            aria-label="Se déconnecter"
          >
            <Icon name="logout" className="h-[18px] w-[18px]" />
          </button>
        </header>

        <main className="animate-fade-up mx-auto w-full max-w-[1600px] flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
