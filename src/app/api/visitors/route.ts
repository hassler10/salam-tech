import { after, NextResponse } from "next/server";
import { db } from "@/db";
import { visitors } from "@/db/schema";
import { or, ilike } from "drizzle-orm";
import { getCurrentUser, can, logAudit } from "@/lib/auth";
import { createVisitorRecord } from "@/lib/visitors";
import { refreshMediaSalamIfDue } from "@/lib/media-salam";

export const maxDuration = 60;

function optionalString(value: unknown, max: number): string | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const s = value.trim();
  if (s.length > max) return undefined;
  return s || null;
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!can(user?.role, "visitors.read")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const q = new URL(req.url).searchParams.get("q")?.trim().slice(0, 100) ?? "";
  const base = db.select().from(visitors);
  const rows = q
    ? await base
        .where(
          or(
            ilike(visitors.lastName, `%${q}%`),
            ilike(visitors.firstName, `%${q}%`),
            ilike(visitors.code, `%${q}%`),
          ),
        )
        .limit(50)
    : await base.limit(50);
  return NextResponse.json({ data: rows });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!can(user?.role, "visitors.write")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object" || Array.isArray(b)) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const lastName = typeof b.lastName === "string" ? b.lastName.trim() : "";
  const firstName = typeof b.firstName === "string" ? b.firstName.trim() : "";
  if (!lastName || !firstName) {
    return NextResponse.json({ error: "Nom et prénoms obligatoires." }, { status: 400 });
  }
  if (lastName.length > 100 || firstName.length > 120) {
    return NextResponse.json({ error: "Nom ou prénoms trop longs." }, { status: 400 });
  }
  const phone = optionalString(b.phone, 40);
  const organization = optionalString(b.organization, 140);
  if (phone === undefined || organization === undefined) {
    return NextResponse.json({ error: "Contact ou fonction invalide." }, { status: 400 });
  }
  const v = await createVisitorRecord({ lastName, firstName, phone, organization });
  // Synchronise le registre des abonnés en arrière-plan. Les coordonnées des
  // visiteurs restent exclusivement dans Salam Library.
  after(() => refreshMediaSalamIfDue());
  await logAudit(user, "création visiteur", "visiteur", v.id, `${lastName} ${firstName}`);
  return NextResponse.json({ data: v });
}
