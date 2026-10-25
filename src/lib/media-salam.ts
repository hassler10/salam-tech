import { db } from "@/db";
import { settings, subscribers, subscriptionPeriods } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { isIsoDay } from "./subscriptions";

export const MEDIA_SALAM_SOURCE = "media_salam";
export const MEDIA_SALAM_PERIOD = "Registre media-salam";
export const MEDIA_SALAM_MAX_BYTES = 5_000_000;

const DEFAULT_URL = "https://media-salam.vercel.app";
const APP_HEADER = "x-app-request";
const APP_VALUE = "media-salam";
const LOGIN_PATH = "/api/auth/login";
const BACKUP_PATH = "/api/backup";
const MAX_SUBSCRIBERS = 50_000;
const SYNC_LOCK_KEY = 812746321;

export class MediaSalamError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = "MediaSalamError";
    this.status = status;
  }
}

export type SyncCounts = {
  total: number;
  crees: number;
  majs: number;
  inchanges: number;
  suspendus: number;
  reactives: number;
  erreurs: number;
};

export type SyncPreview = {
  total: number;
  valides: number;
  nouveaux: number;
  connus: number;
  suspendus: number;
  erreurs: number;
  errorDetails: { line: number; message: string }[];
  generatedAt: string | null;
};

export type MediaSalamState = {
  lastSync: string | null;
  lastAttempt: string | null;
  status: "ok" | "error" | null;
  summary: SyncCounts | null;
  error: string | null;
};

type NormalizedRow = {
  ref: string;
  card: string;
  lastName: string;
  firstName: string;
  phone: string | null;
  profession: string | null;
  registrationDate: string;
  validityDate: string;
  suspended: boolean;
};

type NormalizedBackup = {
  rows: NormalizedRow[];
  errors: { line: number; message: string }[];
  total: number;
  generatedAt: string | null;
};

export function getMediaSalamConfig() {
  const url = (process.env.MEDIA_SALAM_URL?.trim() || DEFAULT_URL).replace(/\/+$/, "");
  const username = process.env.MEDIA_SALAM_USERNAME?.trim() ?? "";
  const password = process.env.MEDIA_SALAM_PASSWORD ?? "";
  return { url, username, configured: Boolean(username && password) };
}

function assertUpstreamUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new MediaSalamError("L'adresse de media-salam est invalide.", 500);
  }
  const loopback = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (parsed.protocol !== "https:" && !(loopback && parsed.protocol === "http:")) {
    throw new MediaSalamError("L'adresse de media-salam doit utiliser HTTPS.", 500);
  }
  return url;
}

async function upstreamFetch(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  label: string,
): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new MediaSalamError(`${label} : media-salam est injoignable.`, 502);
  }
}

/**
 * Connexion en lecture seule : seuls /api/auth/login puis /api/backup sont appelés.
 * Aucune route de modification n'est utilisée.
 */
export async function fetchMediaSalamBackup(): Promise<unknown> {
  const config = getMediaSalamConfig();
  if (!config.configured) {
    throw new MediaSalamError(
      "La synchronisation automatique n'est pas configurée : renseignez MEDIA_SALAM_USERNAME et MEDIA_SALAM_PASSWORD.",
      503,
    );
  }
  const base = assertUpstreamUrl(config.url);
  const password = process.env.MEDIA_SALAM_PASSWORD ?? "";

  const login = await upstreamFetch(
    `${base}${LOGIN_PATH}`,
    {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        [APP_HEADER]: APP_VALUE,
      },
      body: JSON.stringify({ username: config.username, password }),
    },
    15_000,
    "Connexion",
  );

  if (!login.ok) {
    if (login.status === 401 || login.status === 403) {
      throw new MediaSalamError("Connexion à media-salam refusée : identifiants invalides.", 502);
    }
    if (login.status === 429) {
      throw new MediaSalamError("media-salam limite temporairement les connexions. Réessayez plus tard.", 502);
    }
    throw new MediaSalamError("Connexion à media-salam impossible pour le moment.", 502);
  }

  const headers = login.headers as Headers & { getSetCookie?: () => string[] };
  const rawCookies = headers.getSetCookie?.() ?? [];
  if (rawCookies.length === 0) {
    const single = login.headers.get("set-cookie");
    if (single) rawCookies.push(single);
  }
  const cookie = rawCookies
    .map((value) => value.split(";")[0]?.trim())
    .find((value) => value?.startsWith("bms_session="));
  if (!cookie) {
    throw new MediaSalamError("media-salam n'a pas ouvert de session de lecture.", 502);
  }

  const backup = await upstreamFetch(
    `${base}${BACKUP_PATH}`,
    {
      headers: {
        accept: "application/json",
        [APP_HEADER]: APP_VALUE,
        cookie,
      },
    },
    25_000,
    "Sauvegarde",
  );

  if (backup.status === 401 || backup.status === 403) {
    throw new MediaSalamError(
      "Le compte media-salam n'a pas accès à la sauvegarde : un compte super administrateur est requis.",
      502,
    );
  }
  if (backup.status === 429) {
    throw new MediaSalamError("media-salam limite les sauvegardes. Réessayez dans une minute.", 502);
  }
  if (!backup.ok) {
    throw new MediaSalamError("Lecture de la sauvegarde media-salam impossible.", 502);
  }
  const declaredLength = Number(backup.headers.get("content-length") ?? "");
  if (Number.isFinite(declaredLength) && declaredLength > MEDIA_SALAM_MAX_BYTES) {
    throw new MediaSalamError("La sauvegarde media-salam dépasse la taille autorisée.", 413);
  }
  const text = await backup.text();
  if (Buffer.byteLength(text, "utf8") > MEDIA_SALAM_MAX_BYTES) {
    throw new MediaSalamError("La sauvegarde media-salam dépasse la taille autorisée.", 413);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new MediaSalamError("La réponse de media-salam n'est pas un fichier JSON valide.", 502);
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  if (!text || text.length > max) return null;
  return text;
}

function asIsoDay(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const day = value.slice(0, 10);
  return isIsoDay(day) ? day : null;
}

function normalizeBackup(payload: unknown): NormalizedBackup {
  const root = asRecord(payload);
  if (!root || !Array.isArray(root.subscribers)) {
    throw new MediaSalamError("Format de sauvegarde media-salam non reconnu.", 422);
  }
  const raw = root.subscribers;
  if (raw.length === 0) {
    throw new MediaSalamError(
      "La sauvegarde ne contient aucun abonné. Synchronisation refusée pour éviter une suspension massive.",
      422,
    );
  }
  if (raw.length > MAX_SUBSCRIBERS) {
    throw new MediaSalamError("La sauvegarde contient trop d'abonnés.", 413);
  }

  const rows: NormalizedRow[] = [];
  const errors: { line: number; message: string }[] = [];
  const seenRefs = new Set<string>();
  const seenCards = new Set<string>();

  raw.forEach((value, index) => {
    const line = index + 1;
    const item = asRecord(value);
    if (!item) {
      errors.push({ line, message: "Fiche illisible" });
      return;
    }
    const rawId =
      typeof item.id === "number"
        ? item.id
        : typeof item.id === "string" && /^\d+$/.test(item.id)
          ? Number(item.id)
          : NaN;
    if (!Number.isSafeInteger(rawId) || rawId <= 0) {
      errors.push({ line, message: "Identifiant media-salam manquant ou invalide" });
      return;
    }
    const ref = String(rawId);
    const card = asText(item.subscriptionNumber, 32);
    const lastName = asText(item.lastName, 120);
    const firstName = asText(item.firstName, 180);
    const registrationDate = asIsoDay(item.registrationDate);
    const validityDate = asIsoDay(item.validityDate);

    if (!card) {
      errors.push({ line, message: "Numéro d'abonnement manquant ou trop long" });
      return;
    }
    if (!lastName) {
      errors.push({ line, message: "Nom manquant ou trop long" });
      return;
    }
    if (!firstName) {
      errors.push({ line, message: "Prénoms manquants ou trop longs" });
      return;
    }
    if (!registrationDate || !validityDate) {
      errors.push({ line, message: "Dates d'inscription ou de validité invalides" });
      return;
    }
    if (validityDate < registrationDate) {
      errors.push({ line, message: "La date de validité précède la date d'inscription" });
      return;
    }
    if (seenRefs.has(ref)) {
      errors.push({ line, message: "Fiche media-salam en double" });
      return;
    }
    if (seenCards.has(card.toLowerCase())) {
      errors.push({ line, message: "Numéro d'abonnement en double" });
      return;
    }
    seenRefs.add(ref);
    seenCards.add(card.toLowerCase());

    const phone =
      typeof item.phone === "string" ? item.phone.replace(/\s+/g, " ").trim().slice(0, 40) || null : null;
    const profession =
      typeof item.profession === "string"
        ? item.profession.replace(/\s+/g, " ").trim().slice(0, 180) || null
        : null;
    rows.push({
      ref,
      card,
      lastName,
      firstName,
      phone,
      profession,
      registrationDate,
      validityDate,
      suspended: Boolean(item.deletedAt) || item.isDemo === true || item.isDemo === 1,
    });
  });

  const generatedAt =
    typeof root.generatedAt === "string" && !Number.isNaN(Date.parse(root.generatedAt))
      ? root.generatedAt
      : null;

  return { rows, errors, total: raw.length, generatedAt };
}

function mergeNote(current: string | null, profession: string | null): string | null {
  const marker = "Fonction : ";
  if (current && !current.startsWith(marker)) return current;
  return profession ? `${marker}${profession}` : null;
}

function monthsBetween(start: string, end: string): number {
  const [startYear, startMonth, startDay] = start.split("-").map(Number);
  const [endYear, endMonth, endDay] = end.split("-").map(Number);
  let months = (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
  if (endDay < startDay) months -= 1;
  return Math.max(1, months);
}

/** Analyse une sauvegarde sans rien écrire. */
export async function previewMediaSalam(payload: unknown): Promise<SyncPreview> {
  const normalized = normalizeBackup(payload);
  const existing = await db
    .select({
      id: subscribers.id,
      externalRef: subscribers.externalRef,
      cardNumber: subscribers.cardNumber,
      code: subscribers.code,
    })
    .from(subscribers);

  const byRef = new Map<string, number>();
  const byCard = new Map<string, number>();
  const byCode = new Map<string, number>();
  for (const row of existing) {
    if (row.externalRef) byRef.set(row.externalRef, row.id);
    if (row.cardNumber) byCard.set(row.cardNumber.toLowerCase(), row.id);
    byCode.set(row.code.toLowerCase(), row.id);
  }

  let nouveaux = 0;
  let connus = 0;
  for (const row of normalized.rows) {
    const known =
      byRef.has(row.ref) ||
      byCard.has(row.card.toLowerCase()) ||
      byCode.has(row.card.toLowerCase());
    if (known) connus += 1;
    else nouveaux += 1;
  }

  return {
    total: normalized.total,
    valides: normalized.rows.length,
    nouveaux,
    connus,
    suspendus: normalized.rows.filter((row) => row.suspended).length,
    erreurs: normalized.errors.length,
    errorDetails: normalized.errors.slice(0, 20),
    generatedAt: normalized.generatedAt,
  };
}

/**
 * Applique une sauvegarde validée. Les fiches absentes du registre sont suspendues,
 * jamais supprimées, afin de conserver l'historique des visites.
 */
export async function syncMediaSalam(
  payload: unknown,
  options: { mode: "manuel" | "auto" },
): Promise<{ counts: SyncCounts; generatedAt: string | null; lastSync: string }> {
  const normalized = normalizeBackup(payload);
  if (normalized.rows.length === 0) {
    throw new MediaSalamError("Aucune fiche valide dans la sauvegarde : synchronisation annulée.", 422);
  }

  const now = new Date();
  const counts: SyncCounts = {
    total: normalized.total,
    crees: 0,
    majs: 0,
    inchanges: 0,
    suspendus: 0,
    reactives: 0,
    erreurs: normalized.errors.length,
  };

  await db.transaction(async (tx) => {
    const lock = await tx.execute(sql`select pg_try_advisory_xact_lock(${SYNC_LOCK_KEY}::bigint) as ok`);
    if ((lock.rows[0] as { ok?: boolean } | undefined)?.ok !== true) {
      throw new MediaSalamError("Une synchronisation media-salam est déjà en cours.", 409);
    }

    const existing = await tx.select().from(subscribers);
    const localPeriods = await tx
      .select()
      .from(subscriptionPeriods)
      .where(eq(subscriptionPeriods.typeName, MEDIA_SALAM_PERIOD));

    const byRef = new Map<string, (typeof existing)[number]>();
    const byCard = new Map<string, (typeof existing)[number]>();
    const byCode = new Map<string, (typeof existing)[number]>();
    const usedCodes = new Set<string>();
    for (const row of existing) {
      if (row.externalRef) byRef.set(row.externalRef, row);
      if (row.cardNumber) byCard.set(row.cardNumber.toLowerCase(), row);
      byCode.set(row.code.toLowerCase(), row);
      usedCodes.add(row.code.toLowerCase());
    }

    const latestPeriod = new Map<number, (typeof localPeriods)[number]>();
    for (const period of localPeriods) {
      const current = latestPeriod.get(period.subscriberId);
      if (!current || period.endDate > current.endDate) latestPeriod.set(period.subscriberId, period);
    }

    const seenRefs = new Set<string>();

    for (const row of normalized.rows) {
      seenRefs.add(row.ref);
      const cardKey = row.card.toLowerCase();
      const refRow = byRef.get(row.ref);
      const cardRow = byCard.get(cardKey);
      const codeRow = byCode.get(cardKey);
      const target = refRow ?? cardRow ?? codeRow ?? null;

      if (refRow && cardRow && cardRow.id !== refRow.id) {
        counts.erreurs += 1;
        continue;
      }
      if (target && target.externalRef && target.externalRef !== row.ref) {
        counts.erreurs += 1;
        continue;
      }

      const nextStatus = row.suspended ? "suspendu" : "actif";
      const note = mergeNote(target?.note ?? null, row.profession);
      let subscriberId: number;
      let isNew = false;
      let periodChanged = false;
      let recordChanged = false;

      if (target) {
        subscriberId = target.id;
        const wasSuspended = target.status === "suspendu";
        const changed =
          target.cardNumber !== row.card ||
          target.externalRef !== row.ref ||
          target.lastName !== row.lastName ||
          target.firstName !== row.firstName ||
          (target.phone ?? null) !== row.phone ||
          (target.note ?? null) !== note ||
          target.status !== nextStatus ||
          target.source !== MEDIA_SALAM_SOURCE ||
          target.registeredAt !== row.registrationDate;

        if (changed) {
          await tx
            .update(subscribers)
            .set({
              cardNumber: row.card,
              externalRef: row.ref,
              lastName: row.lastName,
              firstName: row.firstName,
              phone: row.phone,
              note,
              status: nextStatus,
              registeredAt: row.registrationDate,
              source: MEDIA_SALAM_SOURCE,
              importedAt: now,
              updatedAt: now,
            })
            .where(eq(subscribers.id, target.id));
          recordChanged = true;
        }
        if (nextStatus === "suspendu" && !wasSuspended) counts.suspendus += 1;
        if (nextStatus === "actif" && wasSuspended) counts.reactives += 1;
      } else {
        let code = row.card.length <= 24 && !usedCodes.has(cardKey) ? row.card : `MS-${row.ref}`;
        let suffix = 1;
        while (usedCodes.has(code.toLowerCase())) {
          code = `MS-${row.ref}-${suffix}`.slice(0, 24);
          suffix += 1;
        }
        const [created] = await tx
          .insert(subscribers)
          .values({
            code,
            cardNumber: row.card,
            externalRef: row.ref,
            lastName: row.lastName,
            firstName: row.firstName,
            phone: row.phone,
            note,
            status: nextStatus,
            registeredAt: row.registrationDate,
            source: MEDIA_SALAM_SOURCE,
            importedAt: now,
          })
          .returning({ id: subscribers.id });
        subscriberId = created.id;
        usedCodes.add(code.toLowerCase());
        isNew = true;
        counts.crees += 1;
      }

      const durationMonths = monthsBetween(row.registrationDate, row.validityDate);
      const currentPeriod = latestPeriod.get(subscriberId);
      if (!currentPeriod) {
        await tx.insert(subscriptionPeriods).values({
          subscriberId,
          typeId: null,
          typeName: MEDIA_SALAM_PERIOD,
          startDate: row.registrationDate,
          endDate: row.validityDate,
          durationMonths,
          createdBy: null,
        });
        periodChanged = true;
      } else if (
        currentPeriod.startDate !== row.registrationDate ||
        currentPeriod.endDate !== row.validityDate ||
        currentPeriod.durationMonths !== durationMonths
      ) {
        await tx
          .update(subscriptionPeriods)
          .set({
            startDate: row.registrationDate,
            endDate: row.validityDate,
            durationMonths,
          })
          .where(eq(subscriptionPeriods.id, currentPeriod.id));
        periodChanged = true;
      }
      if (!isNew) {
        if (recordChanged || periodChanged) counts.majs += 1;
        else counts.inchanges += 1;
      }
    }

    // Une fiche autrefois synchronisée puis disparue du registre est suspendue, jamais effacée.
    for (const row of existing) {
      if (row.source !== MEDIA_SALAM_SOURCE || !row.externalRef) continue;
      if (seenRefs.has(row.externalRef) || row.status === "suspendu") continue;
      await tx
        .update(subscribers)
        .set({ status: "suspendu", updatedAt: now })
        .where(eq(subscribers.id, row.id));
      counts.suspendus += 1;
      counts.majs += 1;
    }

    const state: [string, string][] = [
      ["media_salam_last_attempt_at", now.toISOString()],
      ["media_salam_last_sync_at", now.toISOString()],
      ["media_salam_last_sync_status", "ok"],
      ["media_salam_last_sync_summary", JSON.stringify(counts)],
      ["media_salam_last_sync_error", ""],
      ["media_salam_last_sync_mode", options.mode],
    ];
    for (const [key, value] of state) {
      await tx
        .insert(settings)
        .values({ key, value })
        .onConflictDoUpdate({ target: settings.key, set: { value } });
    }
  });

  return {
    counts,
    generatedAt: normalized.generatedAt,
    lastSync: now.toISOString(),
  };
}

export async function recordMediaSalamFailure(message: string): Promise<void> {
  const now = new Date().toISOString();
  const safe = message.replace(/\s+/g, " ").trim().slice(0, 200);
  const state: [string, string][] = [
    ["media_salam_last_attempt_at", now],
    ["media_salam_last_sync_status", "error"],
    ["media_salam_last_sync_error", safe],
  ];
  try {
    for (const [key, value] of state) {
      await db
        .insert(settings)
        .values({ key, value })
        .onConflictDoUpdate({ target: settings.key, set: { value } });
    }
  } catch {
    // L'état de synchronisation ne doit pas masquer l'erreur d'origine.
  }
}

export function readMediaSalamState(map: Record<string, string>): MediaSalamState {
  let summary: SyncCounts | null = null;
  try {
    const parsed = JSON.parse(map.media_salam_last_sync_summary ?? "") as Partial<SyncCounts>;
    if (parsed && typeof parsed === "object") {
      summary = {
        total: Number(parsed.total) || 0,
        crees: Number(parsed.crees) || 0,
        majs: Number(parsed.majs) || 0,
        inchanges: Number(parsed.inchanges) || 0,
        suspendus: Number(parsed.suspendus) || 0,
        reactives: Number(parsed.reactives) || 0,
        erreurs: Number(parsed.erreurs) || 0,
      };
    }
  } catch {
    summary = null;
  }
  const rawStatus = map.media_salam_last_sync_status;
  return {
    lastSync: map.media_salam_last_sync_at ?? null,
    lastAttempt: map.media_salam_last_attempt_at ?? null,
    status: rawStatus === "ok" || rawStatus === "error" ? rawStatus : null,
    summary,
    error: map.media_salam_last_sync_error ? map.media_salam_last_sync_error : null,
  };
}
