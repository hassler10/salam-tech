import { NextResponse } from "next/server";
import { db } from "@/db";
import { subscriptionTypes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser, can, logAudit } from "@/lib/auth";

export async function GET() {
  const rows = await db.select().from(subscriptionTypes);
  return NextResponse.json({ data: rows });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!can(user?.role, "types.write")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const b = await req.json().catch(() => ({}));
  const name = String(b?.name ?? "").trim();
  const durationMonths = Number(b?.durationMonths ?? 0);
  if (!name || durationMonths < 1) {
    return NextResponse.json({ error: "Nom et durée (mois) obligatoires." }, { status: 400 });
  }
  const [t] = await db
    .insert(subscriptionTypes)
    .values({ name, durationMonths, description: b?.description ?? null })
    .returning();
  await logAudit(user, "création type d'abonnement", "type", t.id, name);
  return NextResponse.json({ data: t });
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!can(user?.role, "types.write")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const b = await req.json().catch(() => ({}));
  const id = Number(b?.id);
  if (!id) return NextResponse.json({ error: "Identifiant requis." }, { status: 400 });
  const patch: Record<string, unknown> = {};
  if (b.name !== undefined) patch.name = String(b.name);
  if (b.durationMonths !== undefined) patch.durationMonths = Number(b.durationMonths);
  if (b.description !== undefined) patch.description = b.description;
  if (b.active !== undefined) patch.active = Boolean(b.active);
  const [t] = await db
    .update(subscriptionTypes)
    .set(patch)
    .where(eq(subscriptionTypes.id, id))
    .returning();
  await logAudit(user, "modification type d'abonnement", "type", id);
  return NextResponse.json({ data: t });
}
