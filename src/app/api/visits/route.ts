import { NextResponse } from "next/server";
import { db } from "@/db";
import { visits, subscribers, visitors } from "@/db/schema";
import { eq, and, gte, desc } from "drizzle-orm";
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

const MAX_BATCH = 200;
const MAX_NAME_LENGTH = 120;
const MAX_ORGANIZATION_LENGTH = 140;
const MAX_PHONE_LENGTH = 40;
const MAX_REASON_LENGTH = 120;

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function optionalText(value: unknown, max: number): string | null {
  const v = text(value, max);
  return v || null;
}

function clampWindow(raw: unknown): number {
  const n = Number(raw ?? 30);
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), 1440) : 30;
}

function isPositiveId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

async function register(p: Payload, user: { id: number; fullName: string } | null) {
  const uid =
    typeof p.uid === "string" && /^[A-Za-z0-9-]{8,64}$/.test(p.uid)
      ? p.uid
      : crypto.randomUUID();
  const existing = await db.select({ id: visits.id }).from(visits).where(eq(visits.uid, uid)).limit(1);
  if (existing[0]) return { status: "duplicate" as const, uid, id: existing[0].id };

  if (p.personType !== "abonne" && p.personType !== "visiteur") {
    return { status: "error" as const, uid, message: "Type de personne invalide." };
  }

  const occurredAt = p.occurredAt ? new Date(p.occurredAt) : new Date();
  if (Number.isNaN(occurredAt.getTime())) {
    return { status: "error" as const, uid, message: "Date de visite invalide." };
  }

  const settings = await getSettingsMap();
  const windowMin = clampWindow(settings.duplicate_window_minutes);

  let subscriberId: number | null = null;
  let visitorId: number | null = null;
  let displayName = `${text(p.lastName, MAX_NAME_LENGTH)} ${text(p.firstName, MAX_NAME_LENGTH)}`.trim();
  let organization = optionalText(p.organization, MAX_ORGANIZATION_LENGTH);

  if (p.personType === "abonne") {
    if (!isPositiveId(p.subscriberId)) {
      return { status: "error" as const, uid, message: "Abonné introuvable." };
    }
    const s = await db.select().from(subscribers).where(eq(subscribers.id, p.subscriberId)).limit(1);
    if (!s[0]) return { status: "error" as const, uid, message: "Abonné introuvable." };
    subscriberId = s[0].id;
    displayName = `${s[0].lastName} ${s[0].firstName}`;
    organization = null;
  } else {
    if (p.visitorId !== undefined && p.visitorId !== null) {
      if (!isPositiveId(p.visitorId)) {
        return { status: "error" as const, uid, message: "Visiteur introuvable." };
      }
      const v = await db.select().from(visitors).where(eq(visitors.id, p.visitorId)).limit(1);
      if (!v[0]) return { status: "error" as const, uid, message: "Visiteur introuvable." };
      visitorId = v[0].id;
      displayName = `${v[0].lastName} ${v[0].firstName}`;
      organization = organization ?? v[0].organization;
    } else if (p.createProfile) {
      const lastName = text(p.lastName, MAX_NAME_LENGTH);
      const firstName = text(p.firstName, MAX_NAME_LENGTH);
      if (lastName.length < 2 || firstName.length < 2) {
        return { status: "error" as const, uid, message: "Nom et prénoms requis." };
      }
      const v = await createVisitorRecord({
        lastName,
        firstName,
        phone: optionalText(p.phone, MAX_PHONE_LENGTH),
        organization,
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
      reason: optionalText(p.reason, MAX_REASON_LENGTH),
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
  const rawLimit = Number(url.searchParams.get("limit") ?? 50);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 500) : 50;
  const rows = await db.select().from(visits).orderBy(desc(visits.occurredAt)).limit(limit);
  return NextResponse.json({ data: rows });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!can(user?.role, "visits.create")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  if (Array.isArray(body.batch)) {
    if (body.batch.length > MAX_BATCH) {
      return NextResponse.json(
        { error: `Trop d'opérations dans la file (${MAX_BATCH} maximum).` },
        { status: 413 },
      );
    }
    const results = [];
    for (const item of body.batch) {
      if (!item || typeof item !== "object") {
        results.push({ status: "error" as const, message: "Opération invalide." });
        continue;
      }
      try {
        results.push(await register(item as Payload, user));
      } catch {
        results.push({ status: "error" as const, message: "Erreur interne." });
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
