"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { enqueueVisit, getCache, listQueue, syncQueue, type QueuedVisit } from "@/lib/offline";
import { Icon } from "@/components/icons";

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

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    listQueue().then(setPending);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
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
          <div className="mb-5 grid grid-cols-2 gap-3">
            <button
              onClick={() => setTab("abonne")}
              className={`rounded-2xl border p-4 text-left transition ${
                tab === "abonne"
                  ? "border-brand-600/30 bg-brand-600/[0.06] shadow-sm dark:border-brand-400/30 dark:bg-brand-400/[0.08]"
                  : "border-slate-200 hover:border-brand-600/25 hover:bg-brand-50/40 dark:border-white/10 dark:hover:border-gold-400/25 dark:hover:bg-white/[0.03]"
              }`}
            >
              <span
                className={`grid h-9 w-9 place-items-center rounded-xl ${
                  tab === "abonne"
                    ? "bg-brand-600/10 text-brand-700 dark:bg-brand-400/15 dark:text-brand-300"
                    : "bg-slate-100 text-slate-400 dark:bg-white/[0.05] dark:text-slate-400"
                }`}
              >
                <Icon name="ticket" className="h-4 w-4" />
              </span>
              <p className="mt-2.5 font-display text-[13.5px] font-semibold text-brand-900 dark:text-white">
                Visite d&apos;un abonné
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                Rechercher par nom, prénoms ou identifiant.
              </p>
            </button>
            <button
              onClick={() => setTab("visiteur")}
              className={`rounded-2xl border p-4 text-left transition ${
                tab === "visiteur"
                  ? "border-gold-500/40 bg-gold-500/[0.08] shadow-sm dark:border-gold-400/35 dark:bg-gold-400/[0.08]"
                  : "border-slate-200 hover:border-gold-500/30 hover:bg-gold-50/40 dark:border-white/10 dark:hover:border-gold-400/25 dark:hover:bg-white/[0.03]"
              }`}
            >
              <span
                className={`grid h-9 w-9 place-items-center rounded-xl ${
                  tab === "visiteur"
                    ? "bg-gold-500/15 text-gold-700 dark:bg-gold-400/15 dark:text-gold-300"
                    : "bg-slate-100 text-slate-400 dark:bg-white/[0.05] dark:text-slate-400"
                }`}
              >
                <Icon name="userPlus" className="h-4 w-4" />
              </span>
              <p className="mt-2.5 font-display text-[13.5px] font-semibold text-brand-900 dark:text-white">
                Visite d&apos;un visiteur
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                Visiteur occasionnel, avec ou sans fiche.
              </p>
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="label">
                {tab === "abonne" ? "Rechercher l'abonné" : "Rechercher un visiteur déjà connu (facultatif)"}
              </label>
              <input
                className="input"
                placeholder="Nom, prénoms ou identifiant…"
                value={query}
                aria-label={tab === "abonne" ? "Rechercher un abonné" : "Rechercher un visiteur"}
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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">Nom *</label>
                  <input className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
                <div>
                  <label className="label">Prénoms *</label>
                  <input className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div>
                  <label className="label">Contact (facultatif)</label>
                  <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div>
                  <label className="label">Fonction (facultatif)</label>
                  <input
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

            <div className="flex flex-wrap gap-3">
              <button onClick={submit} disabled={busy} className="btn-primary px-6 py-2.5">
                {busy ? "Enregistrement…" : "Valider l'enregistrement"}
              </button>
              <button onClick={reset} className="btn-ghost">Réinitialiser</button>
              {selected && tab === "abonne" && (
                <Link href={`/abonnes/${selected.id}`} className="btn-ghost">Voir la fiche</Link>
              )}
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
      </div>

      <div className={embedded ? "card h-fit max-h-80 overflow-y-auto" : "card h-fit"}>
        <h3 className="mb-3 text-sm font-bold">
          {embedded ? "Dernières visites" : "10 dernières visites enregistrées"}
        </h3>
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
