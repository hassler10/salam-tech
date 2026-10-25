import { NextResponse } from "next/server";
import { db } from "@/db";
import { subscribers, subscriptionPeriods, subscriptionTypes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser, can, logAudit } from "@/lib/auth";
import { addMonths, isIsoDay, todayIso } from "@/lib/subscriptions";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!can(user?.role, "subscribers.write")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const { id: idParam } = await ctx.params;
  const subscriberId = Number(idParam);
  if (!Number.isInteger(subscriberId) || subscriberId <= 0) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  }
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object" || Array.isArray(b)) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const existing = await db
    .select({ id: subscribers.id })
    .from(subscribers)
    .where(eq(subscribers.id, subscriberId))
    .limit(1);
  if (!existing[0]) {
    return NextResponse.json({ error: "Abonné introuvable." }, { status: 404 });
  }

  const typeId = Number(b.typeId);
  if (!Number.isInteger(typeId) || typeId <= 0) {
    return NextResponse.json({ error: "Type d'abonnement invalide." }, { status: 400 });
  }
  const t = await db
    .select()
    .from(subscriptionTypes)
    .where(eq(subscriptionTypes.id, typeId))
    .limit(1);
  if (!t[0]) return NextResponse.json({ error: "Type d'abonnement invalide." }, { status: 400 });

  let start = todayIso();
  if (b.startDate !== undefined) {
    if (typeof b.startDate !== "string" || !isIsoDay(b.startDate)) {
      return NextResponse.json({ error: "Date de début invalide." }, { status: 400 });
    }
    start = b.startDate;
  }

  const [p] = await db
    .insert(subscriptionPeriods)
    .values({
      subscriberId,
      typeId: t[0].id,
      typeName: t[0].name,
      startDate: start,
      endDate: addMonths(start, t[0].durationMonths),
      durationMonths: t[0].durationMonths,
      createdBy: user?.id ?? null,
    })
    .returning();
  await logAudit(user, "renouvellement abonnement", "abonné", subscriberId, `${t[0].name} du ${start}`);
  return NextResponse.json({ data: p });
}
