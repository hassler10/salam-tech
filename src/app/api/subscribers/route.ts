import { NextResponse } from "next/server";
import { db } from "@/db";
import { subscribers, subscriptionPeriods, subscriptionTypes } from "@/db/schema";
import { eq, or, ilike, sql } from "drizzle-orm";
import { getCurrentUser, can, logAudit } from "@/lib/auth";
import { addMonths, isIsoDay, todayIso } from "@/lib/subscriptions";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_LAST_NAME = 100;
const MAX_FIRST_NAME = 120;

function optionalString(value: unknown, max: number): string | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const s = value.trim();
  if (s.length > max) return undefined;
  return s || null;
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!can(user?.role, "subscribers.read")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const q = new URL(req.url).searchParams.get("q")?.trim().slice(0, 100) ?? "";
  const base = db.select().from(subscribers);
  const rows = q
    ? await base
        .where(
          or(
            ilike(subscribers.lastName, `%${q}%`),
            ilike(subscribers.firstName, `%${q}%`),
            ilike(subscribers.code, `%${q}%`),
          ),
        )
        .limit(50)
    : await base.limit(50);
  return NextResponse.json({ data: rows });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!can(user?.role, "subscribers.write")) {
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
  if (lastName.length > MAX_LAST_NAME || firstName.length > MAX_FIRST_NAME) {
    return NextResponse.json({ error: "Nom ou prénoms trop longs." }, { status: 400 });
  }

  const phone = optionalString(b.phone, 40);
  const email = optionalString(b.email, 120);
  const note = optionalString(b.note, 2000);
  if (phone === undefined || email === undefined || note === undefined) {
    return NextResponse.json({ error: "Coordonnées ou note invalides." }, { status: 400 });
  }
  if (email && !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Adresse e-mail invalide." }, { status: 400 });
  }

  let registeredAt = todayIso();
  if (b.registeredAt !== undefined) {
    if (typeof b.registeredAt !== "string" || !isIsoDay(b.registeredAt)) {
      return NextResponse.json({ error: "Date d'inscription invalide." }, { status: 400 });
    }
    registeredAt = b.registeredAt;
  }

  let type: typeof subscriptionTypes.$inferSelect | null = null;
  if (b.typeId !== undefined && b.typeId !== null && b.typeId !== "") {
    const typeId = Number(b.typeId);
    if (!Number.isInteger(typeId) || typeId <= 0) {
      return NextResponse.json({ error: "Type d'abonnement invalide." }, { status: 400 });
    }
    const rows = await db
      .select()
      .from(subscriptionTypes)
      .where(eq(subscriptionTypes.id, typeId))
      .limit(1);
    if (!rows[0]) return NextResponse.json({ error: "Type d'abonnement invalide." }, { status: 400 });
    type = rows[0];
  }

  let startDate = todayIso();
  if (type && b.startDate !== undefined) {
    if (typeof b.startDate !== "string" || !isIsoDay(b.startDate)) {
      return NextResponse.json({ error: "Date de début invalide." }, { status: 400 });
    }
    startDate = b.startDate;
  }

  const dup = await db
    .select({ id: subscribers.id })
    .from(subscribers)
    .where(
      sql`lower(${subscribers.lastName}) = lower(${lastName}) and lower(${subscribers.firstName}) = lower(${firstName})`,
    )
    .limit(1);
  if (dup[0] && b.force !== true) {
    return NextResponse.json(
      { error: "Un abonné portant ce nom existe déjà.", duplicateId: dup[0].id },
      { status: 409 },
    );
  }

  const seq = await db.select({ c: sql<number>`count(*)::int` }).from(subscribers);
  const code = `AB-${new Date().getFullYear()}-${String((seq[0]?.c ?? 0) + 1).padStart(4, "0")}`;

  const [created] = await db
    .insert(subscribers)
    .values({
      code,
      lastName,
      firstName,
      phone,
      email,
      note,
      registeredAt,
      status: "actif",
    })
    .returning();

  if (type) {
    await db.insert(subscriptionPeriods).values({
      subscriberId: created.id,
      typeId: type.id,
      typeName: type.name,
      startDate,
      endDate: addMonths(startDate, type.durationMonths),
      durationMonths: type.durationMonths,
      createdBy: user?.id ?? null,
    });
  }
  await logAudit(user, "création abonné", "abonné", created.id, `${lastName} ${firstName}`);
  return NextResponse.json({ data: created });
}
