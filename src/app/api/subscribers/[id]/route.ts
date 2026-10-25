import { NextResponse } from "next/server";
import { db } from "@/db";
import { subscribers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser, can, logAudit } from "@/lib/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ALLOWED_FIELDS = new Set(["lastName", "firstName", "phone", "email", "note", "status"]);
const STATUSES = new Set(["actif", "suspendu"]);

function optionalString(value: unknown, max: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const s = value.trim();
  if (s.length > max) return undefined;
  return s || null;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!can(user?.role, "subscribers.write")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const { id: idParam } = await ctx.params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  }
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object" || Array.isArray(b)) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  for (const key of Object.keys(b)) {
    if (!ALLOWED_FIELDS.has(key)) {
      return NextResponse.json({ error: `Champ inconnu : « ${key.slice(0, 50)} ».` }, { status: 400 });
    }
  }

  const patch: Record<string, unknown> = {};
  const changed: string[] = [];

  if (b.lastName !== undefined) {
    if (typeof b.lastName !== "string") {
      return NextResponse.json({ error: "Nom invalide." }, { status: 400 });
    }
    const lastName = b.lastName.trim();
    if (!lastName || lastName.length > 100) {
      return NextResponse.json({ error: "Nom invalide (100 caractères max.)." }, { status: 400 });
    }
    patch.lastName = lastName;
    changed.push("nom");
  }
  if (b.firstName !== undefined) {
    if (typeof b.firstName !== "string") {
      return NextResponse.json({ error: "Prénoms invalides." }, { status: 400 });
    }
    const firstName = b.firstName.trim();
    if (!firstName || firstName.length > 120) {
      return NextResponse.json({ error: "Prénoms invalides (120 caractères max.)." }, { status: 400 });
    }
    patch.firstName = firstName;
    changed.push("prénoms");
  }
  if (b.phone !== undefined) {
    const phone = optionalString(b.phone, 40);
    if (phone === undefined) {
      return NextResponse.json({ error: "Téléphone invalide (40 caractères max.)." }, { status: 400 });
    }
    patch.phone = phone;
    changed.push("téléphone");
  }
  if (b.email !== undefined) {
    const email = optionalString(b.email, 120);
    if (email === undefined || (email && !EMAIL_RE.test(email))) {
      return NextResponse.json({ error: "Adresse e-mail invalide." }, { status: 400 });
    }
    patch.email = email;
    changed.push("e-mail");
  }
  if (b.note !== undefined) {
    const note = optionalString(b.note, 2000);
    if (note === undefined) {
      return NextResponse.json({ error: "Note trop longue (2000 caractères max.)." }, { status: 400 });
    }
    patch.note = note;
    changed.push("note");
  }
  if (b.status !== undefined) {
    if (typeof b.status !== "string" || !STATUSES.has(b.status)) {
      return NextResponse.json({ error: "Statut invalide." }, { status: 400 });
    }
    patch.status = b.status;
    changed.push("statut");
  }

  if (changed.length === 0) {
    return NextResponse.json({ error: "Aucune modification." }, { status: 400 });
  }
  patch.updatedAt = new Date();

  const [updated] = await db
    .update(subscribers)
    .set(patch)
    .where(eq(subscribers.id, id))
    .returning();
  if (!updated) {
    return NextResponse.json({ error: "Abonné introuvable." }, { status: 404 });
  }
  await logAudit(user, "modification abonné", "abonné", id, changed.join(", "));
  return NextResponse.json({ data: updated });
}
