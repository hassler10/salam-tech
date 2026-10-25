import { NextResponse } from "next/server";
import { db } from "@/db";
import { subscriptionTypes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser, can, logAudit } from "@/lib/auth";

const MAX_NAME = 80;
const MAX_DESCRIPTION = 2000;

function readDescription(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const s = value.trim();
  if (s.length > MAX_DESCRIPTION) return undefined;
  return s || null;
}

function readDuration(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 120 ? n : null;
}

export async function GET() {
  const rows = await db.select().from(subscriptionTypes);
  return NextResponse.json({ data: rows });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!can(user?.role, "types.write")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object") {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const durationMonths = readDuration(b.durationMonths);
  const description = readDescription(b.description);
  if (!name || name.length > MAX_NAME) {
    return NextResponse.json({ error: `Nom obligatoire (${MAX_NAME} caractères max.).` }, { status: 400 });
  }
  if (durationMonths === null) {
    return NextResponse.json({ error: "La durée doit être un nombre entier entre 1 et 120 mois." }, { status: 400 });
  }
  if (description === undefined) {
    return NextResponse.json({ error: "Description invalide (2000 caractères max.)." }, { status: 400 });
  }
  const [t] = await db
    .insert(subscriptionTypes)
    .values({ name, durationMonths, description })
    .returning();
  await logAudit(user, "création type d'abonnement", "type", t.id, name);
  return NextResponse.json({ data: t });
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!can(user?.role, "types.write")) {
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
  if (b.name !== undefined) {
    const name = typeof b.name === "string" ? b.name.trim() : "";
    if (!name || name.length > MAX_NAME) {
      return NextResponse.json({ error: `Nom obligatoire (${MAX_NAME} caractères max.).` }, { status: 400 });
    }
    patch.name = name;
    changed.push("nom");
  }
  if (b.durationMonths !== undefined) {
    const duration = readDuration(b.durationMonths);
    if (duration === null) {
      return NextResponse.json({ error: "La durée doit être un nombre entier entre 1 et 120 mois." }, { status: 400 });
    }
    patch.durationMonths = duration;
    changed.push("durée");
  }
  if (b.description !== undefined) {
    const description = readDescription(b.description);
    if (description === undefined) {
      return NextResponse.json({ error: "Description invalide (2000 caractères max.)." }, { status: 400 });
    }
    patch.description = description;
    changed.push("description");
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
  const [t] = await db
    .update(subscriptionTypes)
    .set(patch)
    .where(eq(subscriptionTypes.id, id))
    .returning();
  if (!t) return NextResponse.json({ error: "Type introuvable." }, { status: 404 });
  await logAudit(user, "modification type d'abonnement", "type", id, changed.join(", "));
  return NextResponse.json({ data: t });
}
