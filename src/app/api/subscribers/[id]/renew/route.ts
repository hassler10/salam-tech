import { NextResponse } from "next/server";
import { db } from "@/db";
import { subscriptionPeriods, subscriptionTypes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser, can, logAudit } from "@/lib/auth";
import { addMonths, todayIso } from "@/lib/subscriptions";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!can(user?.role, "subscribers.write")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const b = await req.json().catch(() => ({}));
  const t = await db
    .select()
    .from(subscriptionTypes)
    .where(eq(subscriptionTypes.id, Number(b?.typeId)))
    .limit(1);
  if (!t[0]) return NextResponse.json({ error: "Type d'abonnement invalide." }, { status: 400 });
  const start = String(b?.startDate || todayIso());
  const [p] = await db
    .insert(subscriptionPeriods)
    .values({
      subscriberId: Number(id),
      typeId: t[0].id,
      typeName: t[0].name,
      startDate: start,
      endDate: addMonths(start, t[0].durationMonths),
      durationMonths: t[0].durationMonths,
      createdBy: user?.id ?? null,
    })
    .returning();
  await logAudit(user, "renouvellement abonnement", "abonné", id, `${t[0].name} du ${start}`);
  return NextResponse.json({ data: p });
}
