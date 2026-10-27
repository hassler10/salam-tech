"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { enqueueVisit, getCache, listQueue, syncQueue, type QueuedVisit } from "@/lib/offline";
import { Icon } from "@/components/icons";
import { getLibraryClock, getLibraryDayBounds, isLibraryOpen } from "@/lib/library-hours";

type Person = { id: number; code: string; lastName: string; firstName: string };
type RecentVisit = {
  id: number;
  displayName: string;
  personType: string;
  reason: string | null;
  occurredAt: string;
  agentName: string | null;
  syncStatus: string;
};
type OfflineCache = { subscribers: Person[]; visitors: Person[] };
type ActivePresence = { visitId: number; displayName: string; personType: string; arrivedAt: string };

function formatElapsed(arrivedAt: string, now: Date) {
  const arrival = new Date(arrivedAt);
  const end = isLibraryOpen(now) ? now : getLibraryDayBounds(getLibraryClock(arrival).day).closeAt;
  const minutes = Math.max(0, Math.floor((end.getTime() - arrival.getTime()) / 60_000));
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
}

export default function ReceptionClient({
  reasons,
  recent,
  embedded = false,
}: {
  reasons: string[];
  recent: RecentVisit[];
  embedded?: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"abonne" | "visiteur">("abonne");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Person[]>([]);
  const [selected, setSelected] = useState<Person | null>(null);
  const [reason, setReason] = useState(reasons[0] ?? "Consultation d'ouvrages");
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [organization, setOrganization] = useState("");
  const [createProfile, setCreateProfile] = useState(true);
  const [message, setMessage] = useState<{ type: "ok" | "err" | "warn"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState<QueuedVisit[]>([]);
  const [present, setPresent] = useState<ActivePresence[]>([]);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [clockNow, setClockNow] = useState<Date | null>(null);

  const refreshPresence = async () => {
    if (!navigator.onLine) return;
    try {
      const res = await fetch("/api/visits/presence", { cache: "no-store" });
      if (res.ok) setPresent((await res.json()).data as ActivePresence[]);
    } catch {
      // L'accueil reste utilisable si la liste des sorties n'est pas joignable.
    }
  };

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    listQueue().then(setPending);
    const updateClock = () => {
      const now = new Date();
      setClockNow(now);
      setLibraryOpen(isLibraryOpen(now));
    };
    updateClock();
    const clockTimer = window.setInterval(updateClock, 15_000);
    void refreshPresence();
    const presenceTimer = window.setInterval(() => void refreshPresence(), 30_000);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      window.clearInterval(clockTimer);
      window.clearInterval(presenceTimer);
    };
  }, []);

  useEffect(() => {
    setSelected(null);
    setResults([]);
    setQuery("");
  }, [tab]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const endpoint = tab === "abonne" ? "/api/subscribers" : "/api/visitors";
      try {
        if (!navigator.onLine) throw new Error("offline");
        const res = await fetch(`${endpoint}?q=${encodeURIComponent(q)}`);
        if (!res.ok) throw new Error("err");
        const json = await res.json();
        setResults(json.data as Person[]);
      } catch {
        const cache = await getCache<OfflineCache>("offline-data");
        const pool = (tab === "abonne" ? cache?.subscribers : cache?.visitors) ?? [];
        const lq = q.toLowerCase();
        setResults(
          pool
            .filter(
              (p) =>
                p.lastName.toLowerCase().includes(lq) ||
                p.firstName.toLowerCase().includes(lq) ||
                p.code.toLowerCase().includes(lq),
            )
            .slice(0, 20),
        );
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, tab]);

  const reset = () => {
    setSelected(null);
    setQuery("");
    setResults([]);
    setLastName("");
    setFirstName("");
    setPhone("");
    setOrganization("");
  };

  const submit = async () => {
    if (!isLibraryOpen()) {
      setMessage({ type: "err", text: "Les enregistrements sont ouverts de 08:00 à 16:00, heure d'Abidjan." });
      return;
    }
    setBusy(true);
    setMessage(null);
    const uid =
      typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `uid-${Date.now()}-${Math.random()}`;
    const occurredAt = new Date().toISOString();
    const displayName = selected
      ? `${selected.lastName} ${selected.firstName}`
      : `${lastName} ${firstName}`.trim();

    if (tab === "abonne" && !selected) {
      setBusy(false);
      setMessage({ type: "err", text: "Veuillez sélectionner un abonné." });
      return;
    }
    if (tab === "visiteur" && !selected && (!lastName.trim() || !firstName.trim())) {
      setBusy(false);
      setMessage({ type: "err", text: "Nom et prénoms du visiteur obligatoires." });
      return;
    }

    const payload: QueuedVisit = {
      uid,
      personType: tab,
      subscriberId: tab === "abonne" ? selected?.id : null,
      visitorId: tab === "visiteur" ? selected?.id ?? null : null,
      lastName: lastName.trim() || undefined,
      firstName: firstName.trim() || undefined,
      phone: phone || null,
      organization: organization || null,
      reason,
      occurredAt,
      createProfile: tab === "visiteur" && !selected ? createProfile : false,
      displayName,
      state: "en_attente",
    };

    if (!navigator.onLine) {
      await enqueueVisit(payload);
      setPending(await listQueue());
      setBusy(false);
      reset();
      setMessage({
        type: "warn",
        text: `Hors connexion : visite de ${displayName} enregistrée localement, elle sera synchronisée automatiquement.`,
      });
      return;
    }

    try {
      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 409) {
        setMessage({ type: "warn", text: json.message ?? "Visite déjà enregistrée récemment." });
      } else if (!res.ok) {
        setMessage({ type: "err", text: json.error ?? "Enregistrement impossible." });
      } else {
        setMessage({ type: "ok", text: `Visite de ${displayName} enregistrée avec succès.` });
        reset();
        void refreshPresence();
        router.refresh();
      }
    } catch {
      await enqueueVisit(payload);
      setPending(await listQueue());
      setMessage({ type: "warn", text: "Serveur injoignable : visite mise en file d'attente locale." });
      reset();
    }
    setBusy(false);
  };

  const checkout = async (visitId: number) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/visits/${visitId}/checkout`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: "err", text: json.error ?? "Sortie impossible." });
      } else {
        setMessage({ type: "ok", text: json.closedAtLibrary ? "Présence clôturée automatiquement à 16:00." : "Heure de sortie enregistrée." });
        await refreshPresence();
        router.refresh();
      }
    } catch {
      setMessage({ type: "err", text: "Serveur injoignable : l'heure de sortie n'a pas été enregistrée." });
    } finally {
      setBusy(false);
    }
  };

  const doSync = async () => {
    const r = await syncQueue();
    setPending(await listQueue());
    setMessage({
      type: r.failed ? "err" : "ok",
      text: `Synchronisation : ${r.synced} enregistrée(s), ${r.duplicates} doublon(s) ignoré(s), ${r.failed} échec(s).`,
    });
    router.refresh();
  };

  return (
    <div className={embedded ? "grid grid-cols-1 gap-5" : "grid grid-cols-1 gap-5 xl:grid-cols-3"}>
      <div className={embedded ? "" : "xl:col-span-2"}>
        <div className="card">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Nouvelle visite</p>
              <h2 className="mt-2 font-display text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
                Qui se présente aujourd&apos;hui ?
              </h2>
              <p className="mt-1.5 text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
                Ouvert de 08:00 à 16:00, heure d&apos;Abidjan. La sortie est enregistrée ici ou clôturée à 16:00.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-600/15 bg-brand-50/80 px-3 py-1.5 text-[10.5px] font-semibold text-brand-700 dark:border-brand-400/20 dark:bg-brand-400/10 dark:text-brand-200">
              <Icon name="check" className="h-3.5 w-3.5" />
              Saisie rapide
            </span>
          </div>

          <div role="group" aria-label="Type de personne" className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100/80 p-1.5 dark:bg-white/[0.04]">
            <button
              type="button"
              aria-pressed={tab === "abonne"}
              onClick={() => setTab("abonne")}
              className={`rounded-xl border px-3.5 py-3 text-left transition sm:px-4 ${
                tab === "abonne"
                  ? "border-brand-600/20 bg-white shadow-sm dark:border-brand-400/25 dark:bg-white/[0.08]"
                  : "border-transparent text-slate-600 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-white/[0.04]"
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Icon name="ticket" className={`h-4 w-4 ${tab === "abonne" ? "text-brand-700 dark:text-brand-300" : "text-slate-400"}`} />
                <span>
                  <span className="block text-[12.5px] font-semibold text-slate-900 dark:text-white">Membre / abonné</span>
                  <span className="mt-0.5 hidden text-[10.5px] text-slate-500 sm:block dark:text-slate-400">Rechercher dans le registre</span>
                </span>
              </span>
            </button>
            <button
              type="button"
              aria-pressed={tab === "visiteur"}
              onClick={() => setTab("visiteur")}
              className={`rounded-xl border px-3.5 py-3 text-left transition sm:px-4 ${
                tab === "visiteur"
                  ? "border-gold-500/30 bg-white shadow-sm dark:border-gold-400/25 dark:bg-white/[0.08]"
                  : "border-transparent text-slate-600 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-white/[0.04]"
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Icon name="userPlus" className={`h-4 w-4 ${tab === "visiteur" ? "text-gold-700 dark:text-gold-300" : "text-slate-400"}`} />
                <span>
                  <span className="block text-[12.5px] font-semibold text-slate-900 dark:text-white">Visiteur</span>
                  <span className="mt-0.5 hidden text-[10.5px] text-slate-500 sm:block dark:text-slate-400">Nouveau ou déjà connu</span>
                </span>
              </span>
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="person-search">
                {tab === "abonne" ? "Rechercher un membre" : "Retrouver un visiteur déjà enregistré"}
              </label>
              {tab === "visiteur" && (
                <p className="mb-2 text-[11px] text-slate-500 dark:text-slate-400">
                  S&apos;il s&apos;agit d&apos;une première visite, laissez la recherche vide et renseignez ses informations ci-dessous.
                </p>
              )}
              <div className="relative">
                <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="person-search"
                  className="input h-12 pl-10 text-[14px]"
                  placeholder={tab === "abonne" ? "Nom, prénoms ou numéro de carte…" : "Nom, prénoms ou code visiteur…"}
                  value={query}
                  aria-label={tab === "abonne" ? "Rechercher un membre" : "Rechercher un visiteur"}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    if (!selected && results.length > 0) {
                      const first = results[0];
                      setSelected(first);
                      setQuery(`${first.lastName} ${first.firstName}`);
                      setResults([]);
                    } else {
                      void submit();
                    }
                  }}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelected(null);
                  }}
                />
              </div>
              {results.length > 0 && !selected && (
                <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-slate-200/80 bg-white/95 shadow-lg backdrop-blur dark:border-white/10 dark:bg-[#0c1a13]/95">
                  {results.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelected(p);
                        setQuery(`${p.lastName} ${p.firstName}`);
                        setResults([]);
                      }}
                      className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-sm transition hover:bg-brand-50/60 dark:hover:bg-white/[0.05]"
                    >
                      <span className="font-medium">{p.lastName} {p.firstName}</span>
                      <span className="font-mono text-[11px] text-slate-400">{p.code}</span>
                    </button>
                  ))}
                </div>
              )}
              {selected && (
                <p className="mt-2 flex items-center gap-2 rounded-xl border border-brand-600/15 bg-brand-50/70 px-3.5 py-2.5 text-sm text-brand-800 dark:border-brand-400/20 dark:bg-brand-400/10 dark:text-brand-200">
                  <Icon name="check" className="h-4 w-4 shrink-0" />
                  <span>
                    Sélectionné : <strong>{selected.lastName} {selected.firstName}</strong> ({selected.code})
                  </span>
                </p>
              )}
            </div>

            {tab === "visiteur" && !selected && (
              <div className="grid grid-cols-1 gap-3 rounded-2xl border border-gold-500/15 bg-gold-500/[0.035] p-4 sm:grid-cols-2 dark:border-gold-400/15 dark:bg-gold-400/[0.035]">
                <div className="sm:col-span-2">
                  <p className="text-[12.5px] font-semibold text-slate-800 dark:text-slate-100">Nouveau visiteur</p>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Nom et prénoms suffisent pour enregistrer son passage.</p>
                </div>
                <div>
                  <label className="label" htmlFor="visitor-last-name">Nom *</label>
                  <input id="visitor-last-name" className="input" autoComplete="family-name" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
                <div>
                  <label className="label" htmlFor="visitor-first-name">Prénoms *</label>
                  <input id="visitor-first-name" className="input" autoComplete="given-name" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div>
                  <label className="label" htmlFor="visitor-phone">Contact (facultatif)</label>
                  <input id="visitor-phone" className="input" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div>
                  <label className="label" htmlFor="visitor-organization">Fonction (facultatif)</label>
                  <input
                    id="visitor-organization"
                    className="input"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    placeholder="Ex. : Enseignant"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-600 sm:col-span-2 dark:text-slate-300">
                  <input type="checkbox" checked={createProfile} onChange={(e) => setCreateProfile(e.target.checked)} />
                  Créer une fiche permanente pour ce visiteur (sinon enregistrement ponctuel)
                </label>
              </div>
            )}

            <div>
              <label className="label">Motif de la visite</label>
              <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
                {reasons.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>

            {message && (
              <p
                aria-live="polite"
                className={`rounded-xl border px-3.5 py-2.5 text-sm font-medium ${
                  message.type === "ok"
                    ? "border-brand-600/15 bg-brand-50/80 text-brand-800 dark:border-brand-400/20 dark:bg-brand-400/10 dark:text-brand-200"
                    : message.type === "warn"
                      ? "border-amber-500/20 bg-amber-50/80 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200"
                      : "border-rose-500/20 bg-rose-50/80 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300"
                }`}
              >
                {message.text}
              </p>
            )}

            <div className="flex flex-col gap-3 border-t border-slate-200/70 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
              <button type="button" onClick={submit} disabled={busy || !libraryOpen} className="btn-primary justify-center px-6 py-3 text-[13px] disabled:cursor-not-allowed disabled:opacity-50">
                {busy ? "Enregistrement…" : libraryOpen ? "Valider l'enregistrement" : "Enregistrement fermé (08:00–16:00)"}
              </button>
              <span className="text-xs text-slate-500" aria-live="polite">
                {clockNow ? `Heure d'Abidjan : ${new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Abidjan", hour: "2-digit", minute: "2-digit" }).format(clockNow)}` : "Vérification de l'horaire…"}
              </span>
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
                <button type="button" onClick={reset} className="btn-ghost justify-center px-5 py-2.5">
                  Réinitialiser
                </button>
                {selected && tab === "abonne" && (
                  <Link href={`/abonnes/${selected.id}`} className="btn-ghost">Voir la fiche</Link>
                )}
              </div>
            </div>

            {!online && (
              <p className="rounded-xl border border-rose-500/20 bg-rose-50/80 px-3.5 py-2.5 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300">
                Mode hors connexion actif. Les visites sont stockées localement (IndexedDB) et synchronisées au retour d&apos;Internet.
              </p>
            )}
          </div>
        </div>

        {pending.length > 0 && (
          <div className="card mt-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold">Opérations en attente ({pending.length})</h3>
              <button onClick={doSync} className="btn-gold px-3 py-1.5 text-xs">Synchroniser</button>
            </div>
            <ul className="space-y-1.5 text-sm">
              {pending.map((p) => (
                <li key={p.uid} className="flex justify-between gap-3 rounded-xl border border-slate-200/60 bg-white/50 px-3 py-2 dark:border-white/[0.06] dark:bg-white/[0.03]">
                  <span>{p.displayName} — {p.personType}</span>
                  <span className="text-xs text-slate-500">{new Date(p.occurredAt).toLocaleString("fr-FR")}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="card mt-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Présence</p>
              <h3 className="mt-1 text-sm font-bold">Personnes actuellement dans la bibliothèque</h3>
            </div>
            <span className="badge bg-brand-600/10 text-brand-800 dark:bg-brand-400/10 dark:text-brand-300">{present.length}</span>
          </div>
          {present.length === 0 ? (
            <p className="text-sm text-slate-500">Aucune présence en cours.</p>
          ) : (
            <ul className="divide-y divide-slate-200/70 dark:divide-white/10">
              {present.map((p) => (
                <li key={p.visitId} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-sm font-semibold">{p.displayName}</p>
                    <p className="text-xs text-slate-500">
                      {p.personType === "abonne" ? "Abonné" : "Visiteur"} · Arrivée {new Date(p.arrivedAt).toLocaleTimeString("fr-FR", { timeZone: "Africa/Abidjan", hour: "2-digit", minute: "2-digit" })}
                      {clockNow ? ` · ${formatElapsed(p.arrivedAt, clockNow)}` : ""}
                    </p>
                  </div>
                  <button type="button" className="btn-ghost px-3 py-1.5 text-xs" disabled={busy || !online} onClick={() => void checkout(p.visitId)}>
                    Enregistrer la sortie
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-slate-500">Toute présence encore ouverte est clôturée automatiquement à 16:00.</p>
        </div>
      </div>

      <div className={embedded ? "card h-fit max-h-80 overflow-y-auto" : "card h-fit"}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Registre</p>
            <h3 className="mt-1 text-sm font-bold">Derniers passages</h3>
          </div>
          <Link href="/visites" className="text-[11px] font-semibold text-brand-700 hover:underline dark:text-gold-300">
            Tout l&apos;historique
          </Link>
        </div>
        <ul className="space-y-2">
          {recent.length === 0 && <li className="text-sm text-slate-500">Aucune visite enregistrée.</li>}
          {recent.map((v) => (
            <li key={v.id} className="rounded-xl border border-slate-200/60 bg-white/50 px-3 py-2.5 text-sm dark:border-white/[0.06] dark:bg-white/[0.03]">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{v.displayName}</span>
                <span className={`badge ${v.personType === "abonne" ? "bg-brand-600/10 text-brand-800 dark:bg-brand-400/10 dark:text-brand-300" : "bg-gold-500/15 text-gold-800 dark:bg-gold-400/10 dark:text-gold-300"}`}>
                  {v.personType === "abonne" ? "Abonné" : "Visiteur"}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {new Date(v.occurredAt).toLocaleString("fr-FR")} — {v.reason ?? "motif non précisé"}
              </p>
              <p className="text-[11px] text-slate-400">Agent : {v.agentName ?? "—"}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
