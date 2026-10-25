import { NextResponse } from "next/server";
import { db } from "@/db";
import { visitReasons } from "@/db/schema";
import { eq, ne, and } from "drizzle-orm";
import { getCurrentUser, can, logAudit } from "@/lib/auth";

const MAX_LABEL = 120;

export async function GET() {
  const rows = await db.select().from(visitReasons).orderBy(visitReasons.id);
  return NextResponse.json({ data: rows });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!can(user?.role, "settings.write")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object") {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const label = typeof b.label === "string" ? b.label.trim() : "";
  if (!label) return NextResponse.json({ error: "Libellé obligatoire." }, { status: 400 });
  if (label.length > MAX_LABEL) {
    return NextResponse.json({ error: `Libellé trop long (${MAX_LABEL} caractères max.).` }, { status: 400 });
  }
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
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object") {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const id = Number(b.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Identifiant requis." }, { status: 400 });
  }
  const patch: Record<string, unknown> = {};
  const changed: string[] = [];
  if (b.label !== undefined) {
    if (typeof b.label !== "string") {
      return NextResponse.json({ error: "Libellé invalide." }, { status: 400 });
    }
    const label = b.label.trim();
    if (!label || label.length > MAX_LABEL) {
      return NextResponse.json(
        { error: `Libellé obligatoire (${MAX_LABEL} caractères max.).` },
        { status: 400 },
      );
    }
    const dup = await db
      .select({ id: visitReasons.id })
      .from(visitReasons)
      .where(and(eq(visitReasons.label, label), ne(visitReasons.id, id)))
      .limit(1);
    if (dup[0]) return NextResponse.json({ error: "Ce motif existe déjà." }, { status: 409 });
    patch.label = label;
    changed.push("libellé");
  }
  if (b.active !== undefined) {
    if (typeof b.active !== "boolean") {
      return NextResponse.json({ error: "État invalide." }, { status: 400 });
    }
    patch.active = b.active;
    changed.push("état");
  }
  if (changed.length === 0) {
    return NextResponse.json({ error: "Aucune modification." }, { status: 400 });
  }
  const [r] = await db.update(visitReasons).set(patch).where(eq(visitReasons.id, id)).returning();
  if (!r) return NextResponse.json({ error: "Motif introuvable." }, { status: 404 });
  await logAudit(user, "modification motif de visite", "motif", id, changed.join(", "));
  return NextResponse.json({ data: r });
}
