"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { enqueueVisit, getCache, listQueue, syncQueue, type QueuedVisit } from "@/lib/offline";

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
        setMessage({ type: "ok", text: `✅ Visite de ${displayName} enregistrée avec succès.` });
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
              className={`rounded-2xl border-2 p-4 text-left transition ${
                tab === "abonne"
                  ? "border-[#166534] bg-[#166534]/5"
                  : "border-slate-200 hover:border-slate-300 dark:border-slate-700"
              }`}
            >
              <p className="text-2xl">🎫</p>
              <p className="mt-1 font-bold text-[#14532d] dark:text-[#c5a253]">Visite d&apos;un abonné</p>
              <p className="text-xs text-slate-500">Rechercher par nom, prénoms ou identifiant.</p>
            </button>
            <button
              onClick={() => setTab("visiteur")}
              className={`rounded-2xl border-2 p-4 text-left transition ${
                tab === "visiteur"
                  ? "border-[#c5a253] bg-[#c5a253]/10"
                  : "border-slate-200 hover:border-slate-300 dark:border-slate-700"
              }`}
            >
              <p className="text-2xl">🚶</p>
              <p className="mt-1 font-bold text-[#14532d] dark:text-[#c5a253]">Visite d&apos;un visiteur</p>
              <p className="text-xs text-slate-500">Visiteur occasionnel, avec ou sans fiche.</p>
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
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelected(null);
                }}
              />
              {results.length > 0 && !selected && (
                <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
                  {results.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelected(p);
                        setQuery(`${p.lastName} ${p.firstName}`);
                        setResults([]);
                      }}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <span>{p.lastName} {p.firstName}</span>
                      <span className="font-mono text-xs text-slate-400">{p.code}</span>
                    </button>
                  ))}
                </div>
              )}
              {selected && (
                <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                  Sélectionné : <strong>{selected.lastName} {selected.firstName}</strong> ({selected.code})
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
                  <label className="label">Organisme (facultatif)</label>
                  <input className="input" value={organization} onChange={(e) => setOrganization(e.target.value)} />
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
                className={`rounded-xl px-3 py-2 text-sm font-medium ${
                  message.type === "ok"
                    ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                    : message.type === "warn"
                      ? "bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
                      : "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
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
              <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
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
            <ul className="space-y-1 text-sm">
              {pending.map((p) => (
                <li key={p.uid} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
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
            <li key={v.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{v.displayName}</span>
                <span className={`badge ${v.personType === "abonne" ? "bg-emerald-100 text-emerald-800" : "bg-[#c5a253]/20 text-[#8a6d26]"}`}>
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
