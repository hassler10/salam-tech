import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { visitPresence, visits } from "@/db/schema";
import { can, getCurrentUser, logAudit } from "@/lib/auth";
import { closeExpiredPresences, ensurePresenceSchema } from "@/lib/presence";
import { getLibraryClock, getLibraryDayBounds, isLibraryOpen } from "@/lib/library-hours";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!can(user?.role, "visits.create")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Identifiant de visite invalide." }, { status: 400 });
  }
  await ensurePresenceSchema();
  await closeExpiredPresences();
  const [row] = await db
    .select({
      visitId: visits.id,
      displayName: visits.displayName,
      arrivedAt: visitPresence.arrivedAt,
      departedAt: visitPresence.departedAt,
    })
    .from(visitPresence)
    .innerJoin(visits, eq(visits.id, visitPresence.visitId))
    .where(eq(visitPresence.visitId, id))
    .limit(1);
  if (!row) return NextResponse.json({ error: "Présence introuvable." }, { status: 404 });
  if (row.departedAt) return NextResponse.json({ error: "Cette présence est déjà terminée." }, { status: 409 });

  const now = new Date();
  if (getLibraryClock(row.arrivedAt).day !== getLibraryClock(now).day) {
    return NextResponse.json({ error: "Cette présence ne correspond pas à la journée en cours." }, { status: 409 });
  }
  const departedAt = isLibraryOpen(now) ? now : getLibraryDayBounds(getLibraryClock(row.arrivedAt).day).closeAt;
  if (departedAt < row.arrivedAt) {
    return NextResponse.json({ error: "L'heure de sortie précède l'arrivée." }, { status: 400 });
  }
  const [updated] = await db
    .update(visitPresence)
    .set({ departedAt })
    .where(and(eq(visitPresence.visitId, id), isNull(visitPresence.departedAt)))
    .returning({ visitId: visitPresence.visitId });
  if (!updated) return NextResponse.json({ error: "Cette présence est déjà terminée." }, { status: 409 });
  await logAudit(user, "enregistrement sortie", "visite", id, row.displayName);
  return NextResponse.json({ ok: true, departedAt, closedAtLibrary: !isLibraryOpen(now) });
}
