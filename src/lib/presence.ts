import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { visitPresence } from "@/db/schema";
import {
  getLibraryClock,
  getLibraryDayBounds,
  isLibraryOpen,
  LIBRARY_CLOSE_MINUTES,
  LIBRARY_OPEN_MINUTES,
} from "@/lib/library-hours";

export { getLibraryClock, getLibraryDayBounds, isLibraryOpen } from "@/lib/library-hours";

let schemaReady: Promise<void> | null = null;

/** Création additive et idempotente de la table des heures de présence. */
export async function ensurePresenceSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await db.execute(sql`
        create table if not exists visit_presence (
          visit_id integer primary key references visits(id) on delete cascade,
          arrived_at timestamptz not null,
          departed_at timestamptz,
          created_at timestamptz not null default now()
        )
      `);
      await db.execute(sql`
        create index if not exists visit_presence_departed_idx
        on visit_presence (departed_at)
      `);
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

export function resolveArrivalTime(
  requestedAt: unknown,
  offline: boolean,
  now = new Date(),
): { arrivedAt: Date | null; error: string | null } {
  if (!offline) {
    return isLibraryOpen(now)
      ? { arrivedAt: now, error: null }
      : { arrivedAt: null, error: "Les enregistrements sont ouverts de 08:00 à 16:00 (heure d'Abidjan)." };
  }

  const arrivedAt = typeof requestedAt === "string" ? new Date(requestedAt) : new Date(NaN);
  const clock = arrivedAt.getTime();
  const nowMs = now.getTime();
  const localMinute = Number.isFinite(clock) ? getLibraryClock(arrivedAt).minuteOfDay : -1;
  if (
    !Number.isFinite(clock) ||
    clock > nowMs + 60_000 ||
    nowMs - clock > 24 * 60 * 60_000 ||
    localMinute < LIBRARY_OPEN_MINUTES ||
    localMinute >= LIBRARY_CLOSE_MINUTES
  ) {
    return {
      arrivedAt: null,
      error: "Cette visite hors connexion n'a pas été enregistrée entre 08:00 et 16:00 dans les dernières 24 heures.",
    };
  }
  return { arrivedAt, error: null };
}

/** Termine à l'heure réelle de sortie ou, en l'absence de sortie, à 16:00. */
export async function closeExpiredPresences(now = new Date()) {
  await ensurePresenceSchema();
  const currentDay = getLibraryClock(now).day;
  const openRows = await db
    .select({ visitId: visitPresence.visitId, arrivedAt: visitPresence.arrivedAt })
    .from(visitPresence)
    .where(isNull(visitPresence.departedAt));

  let closed = 0;
  for (const row of openRows) {
    if (row.arrivedAt > now) continue;
    const arrival = getLibraryClock(row.arrivedAt);
    const isPastDay = arrival.day < currentDay;
    const isTodayAfterClose = arrival.day === currentDay && getLibraryClock(now).minuteOfDay >= LIBRARY_CLOSE_MINUTES;
    if (!isPastDay && !isTodayAfterClose) continue;
    if (arrival.minuteOfDay < LIBRARY_OPEN_MINUTES || arrival.minuteOfDay >= LIBRARY_CLOSE_MINUTES) continue;
    const { closeAt } = getLibraryDayBounds(arrival.day);
    const result = await db
      .update(visitPresence)
      .set({ departedAt: closeAt })
      .where(and(eq(visitPresence.visitId, row.visitId), isNull(visitPresence.departedAt)))
      .returning({ visitId: visitPresence.visitId });
    closed += result.length;
  }
  return closed;
}

export function presenceMinutes(arrivedAt: Date, departedAt: Date | null, now = new Date()) {
  const effectiveEnd = departedAt ?? (isLibraryOpen(now) ? now : getLibraryDayBounds(getLibraryClock(arrivedAt).day).closeAt);
  return Math.max(0, Math.floor((effectiveEnd.getTime() - arrivedAt.getTime()) / 60_000));
}
