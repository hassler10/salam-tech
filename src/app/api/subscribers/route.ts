import { NextResponse } from "next/server";
import { db } from "@/db";
import { subscribers, subscriptionPeriods, subscriptionTypes } from "@/db/schema";
import { eq, or, ilike, sql } from "drizzle-orm";
import { getCurrentUser, can, logAudit } from "@/lib/auth";
import { addMonths, todayIso } from "@/lib/subscriptions";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!can(user?.role, "subscribers.read")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
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
  const lastName = String(b?.lastName ?? "").trim();
  const firstName = String(b?.firstName ?? "").trim();
  if (!lastName || !firstName) {
    return NextResponse.json({ error: "Nom et prénoms obligatoires." }, { status: 400 });
  }
  const dup = await db
    .select({ id: subscribers.id })
    .from(subscribers)
    .where(
      sql`lower(${subscribers.lastName}) = lower(${lastName}) and lower(${subscribers.firstName}) = lower(${firstName})`,
    )
    .limit(1);
  if (dup[0] && !b?.force) {
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
      phone: b?.phone ? String(b.phone) : null,
      email: b?.email ? String(b.email) : null,
      note: b?.note ? String(b.note) : null,
      registeredAt: b?.registeredAt ? String(b.registeredAt) : todayIso(),
      status: "actif",
    })
    .returning();

  if (b?.typeId) {
    const t = await db
      .select()
      .from(subscriptionTypes)
      .where(eq(subscriptionTypes.id, Number(b.typeId)))
      .limit(1);
    if (t[0]) {
      const start = String(b?.startDate || todayIso());
      await db.insert(subscriptionPeriods).values({
        subscriberId: created.id,
        typeId: t[0].id,
        typeName: t[0].name,
        startDate: start,
        endDate: addMonths(start, t[0].durationMonths),
        durationMonths: t[0].durationMonths,
        createdBy: user?.id ?? null,
      });
    }
  }
  await logAudit(user, "création abonné", "abonné", created.id, `${lastName} ${firstName}`);
  return NextResponse.json({ data: created });
}
