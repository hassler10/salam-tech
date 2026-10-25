import { NextResponse } from "next/server";
import { db } from "@/db";
import { visitors } from "@/db/schema";
import { or, ilike, sql } from "drizzle-orm";
import { getCurrentUser, can, logAudit } from "@/lib/auth";
import { createVisitorRecord } from "@/lib/visitors";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!can(user?.role, "visitors.read")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
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
  const lastName = String(b?.lastName ?? "").trim();
  const firstName = String(b?.firstName ?? "").trim();
  if (!lastName || !firstName) {
    return NextResponse.json({ error: "Nom et prénoms obligatoires." }, { status: 400 });
  }
  const v = await createVisitorRecord({
    lastName,
    firstName,
    phone: b?.phone ?? null,
    organization: b?.organization ?? null,
  });
  await logAudit(user, "création visiteur", "visiteur", v.id, `${lastName} ${firstName}`);
  return NextResponse.json({ data: v });
}
