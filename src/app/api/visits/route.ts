import { NextResponse } from "next/server";
import { db } from "@/db";
import { visits, subscribers, visitors } from "@/db/schema";
import { eq, and, gte, desc, sql } from "drizzle-orm";
import { getCurrentUser, can, logAudit } from "@/lib/auth";
import { createVisitorRecord } from "@/lib/visitors";
import { getSettingsMap } from "@/lib/seed";

type Payload = {
  uid?: string;
  personType: "abonne" | "visiteur";
  subscriberId?: number | null;
  visitorId?: number | null;
  lastName?: string;
  firstName?: string;
  phone?: string | null;
  organization?: string | null;
  reason?: string | null;
  occurredAt?: string;
  createProfile?: boolean;
  offline?: boolean;
};

async function register(p: Payload, user: { id: number; fullName: string } | null) {
  const uid = p.uid && p.uid.length > 6 ? p.uid : crypto.randomUUID();
  const existing = await db.select({ id: visits.id }).from(visits).where(eq(visits.uid, uid)).limit(1);
  if (existing[0]) return { status: "duplicate" as const, uid, id: existing[0].id };

  const occurredAt = p.occurredAt ? new Date(p.occurredAt) : new Date();
  const settings = await getSettingsMap();
  const windowMin = Number(settings.duplicate_window_minutes ?? 30);

  let subscriberId: number | null = null;
  let visitorId: number | null = null;
  let displayName = `${p.lastName ?? ""} ${p.firstName ?? ""}`.trim();
  let organization = p.organization ?? null;

  if (p.personType === "abonne") {
    if (!p.subscriberId) return { status: "error" as const, uid, message: "Abonné introuvable." };
    const s = await db.select().from(subscribers).where(eq(subscribers.id, p.subscriberId)).limit(1);
    if (!s[0]) return { status: "error" as const, uid, message: "Abonné introuvable." };
    subscriberId = s[0].id;
    displayName = `${s[0].lastName} ${s[0].firstName}`;
  } else {
    if (p.visitorId) {
      const v = await db.select().from(visitors).where(eq(visitors.id, p.visitorId)).limit(1);
      if (!v[0]) return { status: "error" as const, uid, message: "Visiteur introuvable." };
      visitorId = v[0].id;
      displayName = `${v[0].lastName} ${v[0].firstName}`;
      organization = organization ?? v[0].organization;
    } else if (p.createProfile && p.lastName && p.firstName) {
      const v = await createVisitorRecord({
        lastName: p.lastName.trim(),
        firstName: p.firstName.trim(),
        phone: p.phone ?? null,
        organization: p.organization ?? null,
      });
      visitorId = v.id;
      displayName = `${v.lastName} ${v.firstName}`;
    }
    if (!displayName) return { status: "error" as const, uid, message: "Nom du visiteur requis." };
  }

  // anti double-enregistrement accidentel
  const since = new Date(occurredAt.getTime() - windowMin * 60000);
  const conds = [gte(visits.occurredAt, since)];
  if (subscriberId) conds.push(eq(visits.subscriberId, subscriberId));
  else if (visitorId) conds.push(eq(visits.visitorId, visitorId));
  else conds.push(eq(visits.displayName, displayName));
  const recent = await db.select({ id: visits.id }).from(visits).where(and(...conds)).limit(1);
  if (recent[0]) {
    return {
      status: "duplicate" as const,
      uid,
      id: recent[0].id,
      message: `Une visite a déjà été enregistrée pour cette personne il y a moins de ${windowMin} minutes.`,
    };
  }

  const [created] = await db
    .insert(visits)
    .values({
      uid,
      personType: p.personType,
      subscriberId,
      visitorId,
      displayName,
      reason: p.reason ?? null,
      organization,
      occurredAt,
      agentId: user?.id ?? null,
      agentName: user?.fullName ?? "inconnu",
      syncStatus: p.offline ? "synchronise_differe" : "synchronise",
    })
    .returning();
  return { status: "created" as const, uid, id: created.id, visit: created };
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!can(user?.role, "visits.read")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 500);
  const rows = await db.select().from(visits).orderBy(desc(visits.occurredAt)).limit(limit);
  return NextResponse.json({ data: rows });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!can(user?.role, "visits.create")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });

  if (Array.isArray(body.batch)) {
    const results = [];
    for (const item of body.batch as Payload[]) {
      try {
        results.push(await register({ ...item, offline: true }, user));
      } catch (e) {
        results.push({ status: "error" as const, uid: item.uid, message: String(e) });
      }
    }
    await logAudit(user, "synchronisation visites", "visite", undefined, `${results.length} opération(s)`);
    return NextResponse.json({ results });
  }

  const r = await register(body as Payload, user);
  if (r.status === "error") return NextResponse.json({ error: r.message }, { status: 400 });
  if (r.status === "duplicate") {
    return NextResponse.json(
      { duplicate: true, message: r.message ?? "Visite déjà enregistrée." },
      { status: 409 },
    );
  }
  await logAudit(user, "enregistrement visite", "visite", r.id, r.visit?.displayName);
  return NextResponse.json({ data: r.visit });
}

export async function HEAD() {
  const c = await db.select({ c: sql<number>`count(*)::int` }).from(visits);
  return new Response(null, { status: 200, headers: { "x-count": String(c[0]?.c ?? 0) } });
}
