"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { listQueue, syncQueue, removeFromQueue, putCache, getCache, type QueuedVisit } from "@/lib/offline";

type Differed = { id: number; displayName: string; occurredAt: string; createdAt: string; agentName: string | null };

export default function SyncClient({ differed }: { differed: Differed[] }) {
  const router = useRouter();
  const [queue, setQueue] = useState<QueuedVisit[]>([]);
  const [online, setOnline] = useState(true);
  const [msg, setMsg] = useState("");
  const [cacheInfo, setCacheInfo] = useState("");

  const refresh = useCallback(async () => {
    setQueue(await listQueue());
    const c = await getCache<{ subscribers: unknown[]; visitors: unknown[] }>("offline-data");
    setCacheInfo(c ? `${c.subscribers.length} abonné(s) et ${c.visitors.length} visiteur(s) disponibles hors connexion.` : "Aucune donnée locale enregistrée.");
  }, []);

  useEffect(() => {
    setOnline(navigator.onLine);
    refresh();
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [refresh]);

  const sync = async () => {
    setMsg("Synchronisation en cours…");
    const r = await syncQueue();
    await refresh();
    setMsg(`Résultat : ${r.synced} visite(s) synchronisée(s), ${r.duplicates} doublon(s) ignoré(s), ${r.failed} échec(s).`);
    router.refresh();
  };

  const reloadCache = async () => {
    const res = await fetch("/api/offline-data");
    if (res.ok) {
      await putCache("offline-data", await res.json());
      setMsg("Données locales mises à jour.");
      refresh();
    } else setMsg("Impossible de recharger les données locales.");
  };

  return (
    <div className="space-y-5">
      <div className="card flex flex-wrap items-center gap-3">
        <span className={`badge ${online ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-700"}`}>
          {online ? "● Connexion disponible" : "● Hors connexion"}
        </span>
        <span className="text-sm text-slate-600 dark:text-slate-300">{queue.length} opération(s) en attente</span>
        <button className="btn-primary" onClick={sync} disabled={!online || queue.length === 0}>🔄 Synchroniser maintenant</button>
        <button className="btn-ghost" onClick={reloadCache} disabled={!online}>⬇️ Recharger les données hors connexion</button>
        {msg && <p className="w-full text-sm font-medium text-[#166534] dark:text-[#c5a253]">{msg}</p>}
        <p className="w-full text-xs text-slate-500">{cacheInfo}</p>
      </div>

      <div className="card">
        <h3 className="mb-3 text-sm font-bold">File d&apos;attente locale</h3>
        {queue.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune opération en attente.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Identifiant unique</th><th>Personne</th><th>Type</th><th>Date d&apos;origine</th><th>État</th><th></th></tr></thead>
              <tbody>
                {queue.map((q) => (
                  <tr key={q.uid}>
                    <td className="font-mono text-[10px]">{q.uid.slice(0, 13)}</td>
                    <td className="font-semibold">{q.displayName}</td>
                    <td>{q.personType === "abonne" ? "Abonné" : "Visiteur"}</td>
                    <td>{new Date(q.occurredAt).toLocaleString("fr-FR")}</td>
                    <td>
                      <span className={`badge ${q.state === "erreur" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800"}`}>
                        {q.state === "erreur" ? `Échec : ${q.error ?? "inconnu"}` : "En attente"}
                      </span>
                    </td>
                    <td>
                      <button className="btn-ghost px-3 py-1 text-xs" onClick={async () => { await removeFromQueue(q.uid); refresh(); }}>
                        Retirer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="mb-3 text-sm font-bold">Visites synchronisées en différé (serveur)</h3>
        {differed.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune visite synchronisée en différé.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Personne</th><th>Date d&apos;origine</th><th>Reçue par le serveur</th><th>Agent</th></tr></thead>
              <tbody>
                {differed.map((d) => (
                  <tr key={d.id}>
                    <td className="font-semibold">{d.displayName}</td>
                    <td>{new Date(d.occurredAt).toLocaleString("fr-FR")}</td>
                    <td>{new Date(d.createdAt).toLocaleString("fr-FR")}</td>
                    <td>{d.agentName ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
