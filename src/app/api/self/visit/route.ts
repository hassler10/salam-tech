import { NextResponse } from "next/server";
import { db } from "@/db";
import { visits, visitReasons } from "@/db/schema";
import { eq, and, gte } from "drizzle-orm";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { getSettingsMap } from "@/lib/seed";
import { createVisitorRecord } from "@/lib/visitors";
import { findSubscriberByIdentity } from "@/lib/identity";
import { logAudit } from "@/lib/auth";
import { refreshMediaSalamIfDue } from "@/lib/media-salam";

export const maxDuration = 60;

const AGENT_LABEL = "Borne d'auto-enregistrement";

export async function POST(req: Request) {
  let settings = await getSettingsMap();
  if ((settings.self_service_enabled ?? "1") !== "1") {
    return NextResponse.json({ error: "La borne est désactivée." }, { status: 403 });
  }
  if (!(await rateLimit(`visit:${clientIp(req)}`, 30, 10 * 60 * 1000))) {
    return NextResponse.json(
      { error: "Trop d'enregistrements successifs. Adressez-vous à l'agent d'accueil." },
      { status: 429 },
    );
  }

  const b = await req.json().catch(() => null);
  if (!b) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });

  const personType = b.personType === "abonne" ? "abonne" : "visiteur";
  const uid =
    typeof b.uid === "string" && /^[A-Za-z0-9-]{8,64}$/.test(b.uid)
      ? b.uid
      : crypto.randomUUID();

  const already = await db.select({ id: visits.id }).from(visits).where(eq(visits.uid, uid)).limit(1);
  if (already[0]) return NextResponse.json({ ok: true, duplicate: true });

  // Le motif doit appartenir à la liste configurée (pas de texte libre non contrôlé).
  const allowed = await db.select().from(visitReasons).where(eq(visitReasons.active, true));
  const reasonInput = typeof b.reason === "string" ? b.reason.slice(0, 120) : "";
  const reason = allowed.find((r) => r.label === reasonInput)?.label ?? allowed[0]?.label ?? null;

  let subscriberId: number | null = null;
  let visitorId: number | null = null;
  let displayName = "";
  let firstNameForResponse = "";
  let organization: string | null = null;

  if (personType === "abonne") {
    // Re-vérification serveur : l'identité ne peut pas être falsifiée côté navigateur.
    const code = String(b.code ?? "").trim();
    const lastName = String(b.lastName ?? "").trim();
    const firstName = String(b.firstName ?? "").trim();
    if (
      !code ||
      code.length > 48 ||
      !lastName ||
      lastName.length > 120 ||
      !firstName ||
      firstName.length > 180
    ) {
      return NextResponse.json({ error: "Identification impossible." }, { status: 400 });
    }
    let s = await findSubscriberByIdentity(code, lastName, firstName);
    const strict = (settings.require_registered_card ?? "0") === "1";
    if (
      !s ||
      (strict &&
        (!settings.media_salam_last_sync_at || s.source !== "media_salam" || s.status !== "actif"))
    ) {
      await refreshMediaSalamIfDue();
      settings = await getSettingsMap();
      s = (await findSubscriberByIdentity(code, lastName, firstName)) ?? s;
    }
    if (!s) return NextResponse.json({ error: "Identification impossible." }, { status: 404 });
    const strictNow = (settings.require_registered_card ?? "0") === "1";
    if (strictNow) {
      if (!settings.media_salam_last_sync_at) {
        return NextResponse.json(
          { error: "Le registre officiel n'est pas encore synchronisé." },
          { status: 503 },
        );
      }
      if (s.source !== "media_salam") {
        return NextResponse.json(
          { error: "Carte non reconnue par le registre officiel." },
          { status: 403 },
        );
      }
      if (s.status !== "actif") {
        return NextResponse.json(
          { error: "Carte inactive dans le registre officiel." },
          { status: 403 },
        );
      }
    }
    subscriberId = s.id;
    displayName = `${s.lastName} ${s.firstName}`;
    firstNameForResponse = s.firstName;
  } else {
    const lastName = String(b.lastName ?? "").trim();
    const firstName = String(b.firstName ?? "").trim();
    if (lastName.length < 2 || firstName.length < 2) {
      return NextResponse.json({ error: "Nom et prénoms obligatoires." }, { status: 400 });
    }
    if (lastName.length > 120 || firstName.length > 120) {
      return NextResponse.json({ error: "Nom ou prénoms trop longs." }, { status: 400 });
    }
    organization = b.organization ? String(b.organization).slice(0, 140) : null;
    const v = await createVisitorRecord({
      lastName,
      firstName,
      phone: b.phone ? String(b.phone).slice(0, 40) : null,
      organization,
    });
    visitorId = v.id;
    displayName = `${v.lastName} ${v.firstName}`;
    firstNameForResponse = v.firstName;
  }

  // Anti-doublon : même personne enregistrée deux fois de suite.
  const rawWindow = Number(settings.duplicate_window_minutes ?? 30);
  const windowMin = Number.isFinite(rawWindow) ? Math.min(Math.max(rawWindow, 0), 1440) : 30;
  const since = new Date(Date.now() - windowMin * 60000);
  const conds = [gte(visits.occurredAt, since)];
  conds.push(subscriberId ? eq(visits.subscriberId, subscriberId) : eq(visits.visitorId, visitorId!));
  const recent = await db.select({ id: visits.id }).from(visits).where(and(...conds)).limit(1);
  if (recent[0]) {
    return NextResponse.json(
      { duplicate: true, message: "Votre visite a déjà été enregistrée il y a quelques instants." },
      { status: 409 },
    );
  }

  const [created] = await db
    .insert(visits)
    .values({
      uid,
      personType,
      subscriberId,
      visitorId,
      displayName,
      reason,
      organization,
      occurredAt: new Date(),
      agentId: null,
      agentName: AGENT_LABEL,
      syncStatus: "synchronise",
    })
    .returning();

  await logAudit(null, "auto-enregistrement visite", "visite", created.id, displayName);

  // Réponse minimale : aucune donnée d'une autre personne.
  return NextResponse.json({
    ok: true,
    data: { firstName: firstNameForResponse, at: created.occurredAt },
  });
}

export async function GET(req: Request) {
  if (!(await rateLimit(`self-config:${clientIp(req)}`, 120, 10 * 60 * 1000))) {
    return NextResponse.json({ error: "Trop de requêtes." }, { status: 429 });
  }
  const rows = await db.select().from(visitReasons).where(eq(visitReasons.active, true));
  const settings = await getSettingsMap();
  return NextResponse.json({
    reasons: rows.map((r) => r.label),
    enabled: (settings.self_service_enabled ?? "1") === "1",
    libraryName: settings.library_name ?? "Bibliothèque de la Mosquée Salam du Plateau",
  });
}
