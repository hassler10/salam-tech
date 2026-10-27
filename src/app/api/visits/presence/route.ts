import { NextResponse } from "next/server";
import { and, eq, gte, isNull, lt } from "drizzle-orm";
import { db } from "@/db";
import { visitPresence, visits } from "@/db/schema";
import { can, getCurrentUser } from "@/lib/auth";
import { closeExpiredPresences, ensurePresenceSchema } from "@/lib/presence";
import { getLibraryClock, getLibraryDayBounds } from "@/lib/library-hours";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!can(user?.role, "visits.read")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  await ensurePresenceSchema();
  await closeExpiredPresences();
  const { openAt, closeAt } = getLibraryDayBounds(getLibraryClock().day);
  const rows = await db
    .select({
      visitId: visits.id,
      displayName: visits.displayName,
      personType: visits.personType,
      arrivedAt: visitPresence.arrivedAt,
    })
    .from(visitPresence)
    .innerJoin(visits, eq(visits.id, visitPresence.visitId))
    .where(and(isNull(visitPresence.departedAt), gte(visitPresence.arrivedAt, openAt), lt(visitPresence.arrivedAt, closeAt)))
    .orderBy(visitPresence.arrivedAt);
  return NextResponse.json({ data: rows });
}
