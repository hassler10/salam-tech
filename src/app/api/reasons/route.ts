import { NextResponse } from "next/server";
import { db } from "@/db";
import { visitReasons } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser, can, logAudit } from "@/lib/auth";

export async function GET() {
  const rows = await db.select().from(visitReasons).orderBy(visitReasons.id);
  return NextResponse.json({ data: rows });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!can(user?.role, "settings.write")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const b = await req.json().catch(() => ({}));
  const label = String(b?.label ?? "").trim();
  if (!label) return NextResponse.json({ error: "Libellé obligatoire." }, { status: 400 });
  const dup = await db.select().from(visitReasons).where(eq(visitReasons.label, label)).limit(1);
  if (dup[0]) return NextResponse.json({ error: "Ce motif existe déjà." }, { status: 409 });
  const [r] = await db.insert(visitReasons).values({ label }).returning();
  await logAudit(user, "création motif de visite", "motif", r.id, label);
  return NextResponse.json({ data: r });
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!can(user?.role, "settings.write")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const b = await req.json().catch(() => ({}));
  const id = Number(b?.id);
  if (!id) return NextResponse.json({ error: "Identifiant requis." }, { status: 400 });
  const patch: Record<string, unknown> = {};
  if (b.label !== undefined) patch.label = String(b.label).trim();
  if (b.active !== undefined) patch.active = Boolean(b.active);
  const [r] = await db.update(visitReasons).set(patch).where(eq(visitReasons.id, id)).returning();
  await logAudit(user, "modification motif de visite", "motif", id, JSON.stringify(patch));
  return NextResponse.json({ data: r });
}
