"use client";

export type QueuedVisit = {
  uid: string;
  personType: "abonne" | "visiteur";
  subscriberId?: number | null;
  visitorId?: number | null;
  lastName?: string;
  firstName?: string;
  phone?: string | null;
  organization?: string | null;
  reason?: string | null;
  occurredAt: string;
  createProfile?: boolean;
  displayName: string;
  state: "en_attente" | "erreur";
  error?: string;
};

const DB_NAME = "salam-library";
const STORE = "pending_visits";
const CACHE_STORE = "cache";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "uid" });
      if (!db.objectStoreNames.contains(CACHE_STORE)) db.createObjectStore(CACHE_STORE, { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(store, mode);
    const r = fn(t.objectStore(store));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export async function enqueueVisit(v: QueuedVisit) {
  await tx(STORE, "readwrite", (s) => s.put(v));
}

export async function listQueue(): Promise<QueuedVisit[]> {
  try {
    const all = await tx<QueuedVisit[]>(STORE, "readonly", (s) => s.getAll() as IDBRequest<QueuedVisit[]>);
    return all ?? [];
  } catch {
    return [];
  }
}

export async function removeFromQueue(uid: string) {
  await tx(STORE, "readwrite", (s) => s.delete(uid) as unknown as IDBRequest<undefined>);
}

export async function clearQueue() {
  await tx(STORE, "readwrite", (s) => s.clear() as unknown as IDBRequest<undefined>);
}

export async function putCache(key: string, value: unknown) {
  await tx(CACHE_STORE, "readwrite", (s) => s.put({ key, value, at: Date.now() }));
}

export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const r = await tx<{ key: string; value: T } | undefined>(
      CACHE_STORE,
      "readonly",
      (s) => s.get(key) as IDBRequest<{ key: string; value: T } | undefined>,
    );
    return r?.value ?? null;
  } catch {
    return null;
  }
}

export type SyncReport = { synced: number; duplicates: number; failed: number };

export async function syncQueue(): Promise<SyncReport> {
  const queue = await listQueue();
  if (queue.length === 0) return { synced: 0, duplicates: 0, failed: 0 };
  const report: SyncReport = { synced: 0, duplicates: 0, failed: 0 };
  const CHUNK_SIZE = 100;

  for (let offset = 0; offset < queue.length; offset += CHUNK_SIZE) {
    const chunk = queue.slice(offset, offset + CHUNK_SIZE);
    let json: { results: { uid: string; status: string; message?: string }[] };
    try {
      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch: chunk }),
      });
      if (!res.ok) {
        report.failed += chunk.length;
        continue;
      }
      json = (await res.json()) as typeof json;
    } catch {
      report.failed += queue.length - offset;
      break;
    }

    const byUid = new Map(json.results.map((r) => [r.uid, r]));
    for (const item of chunk) {
      const r = byUid.get(item.uid);
      if (!r) {
        report.failed++;
      } else if (r.status === "created") {
        report.synced++;
        await removeFromQueue(r.uid);
      } else if (r.status === "duplicate") {
        report.duplicates++;
        await removeFromQueue(r.uid);
      } else {
        report.failed++;
        await enqueueVisit({ ...item, state: "erreur", error: r.message });
      }
    }
  }
  return report;
}
