import { after, NextResponse } from "next/server";
import { db } from "@/db";
import { subscriptionPeriods } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { getSettingsMap, getThresholds } from "@/lib/seed";
import { computeStatus, STATUS_LABEL } from "@/lib/subscriptions";
import { findMediaSalamSubscriberByIdentity } from "@/lib/identity";
import { isMediaSalamSyncFresh, refreshMediaSalamIfDue } from "@/lib/media-salam";
import { isLibraryOpen } from "@/lib/library-hours";
import { hasSelfServiceGateSession } from "@/lib/self-service-gate";

export const maxDuration = 60;

/**
 * Borne d'auto-identification : la carte, le nom et les prénoms doivent correspondre
 * à une fiche active récemment synchronisée depuis Media Salam.
 */
export async function POST(req: Request) {
  if (!(await hasSelfServiceGateSession())) {
    return NextResponse.json({ error: "Saisissez le code d'accès de la borne." }, { status: 401 });
  }
  let settings = await getSettingsMap();
  if (!isLibraryOpen()) {
    return NextResponse.json({ error: "La borne enregistre les arrivées de 08:00 à 16:00, heure d'Abidjan." }, { status: 403 });
  }
  if (!(await rateLimit(`lookup:${clientIp(req)}`, 12, 10 * 60 * 1000))) {
    return NextResponse.json(
      { error: "Trop de tentatives. Veuillez vous adresser à l'agent d'accueil." },
      { status: 429 },
    );
  }

  const b = await req.json().catch(() => null);
  const code = String(b?.code ?? "").trim();
  const lastName = String(b?.lastName ?? "").trim();
  const firstName = String(b?.firstName ?? "").trim();
  if (!code || !lastName || !firstName) {
    return NextResponse.json(
      { error: "Numéro de carte, nom et prénoms obligatoires." },
      { status: 400 },
    );
  }
  if (code.length > 48 || lastName.length > 120 || firstName.length > 180) {
    return NextResponse.json(
      { error: "Identifiant ou nom incorrect. Adressez-vous à l'agent d'accueil." },
      { status: 400 },
    );
  }

  // Toute identification déclenche une actualisation en arrière-plan. Une fiche
  // inconnue ou un registre périmé est actualisé avant la décision de la borne.
  after(() => refreshMediaSalamIfDue());
  let s = await findMediaSalamSubscriberByIdentity(code, lastName, firstName);
  if (!s || s.status !== "actif" || !isMediaSalamSyncFresh(settings)) {
    await refreshMediaSalamIfDue();
    settings = await getSettingsMap();
    s = await findMediaSalamSubscriberByIdentity(code, lastName, firstName);
  }

  if (!isMediaSalamSyncFresh(settings)) {
    return NextResponse.json(
      { error: "Le registre officiel est indisponible ou trop ancien. Adressez-vous à l'agent d'accueil." },
      { status: 503 },
    );
  }
  if (!s) {
    return NextResponse.json(
      { error: "Identifiant ou nom incorrect. Adressez-vous à l'agent d'accueil." },
      { status: 404 },
    );
  }

  if (s.status !== "actif") {
    return NextResponse.json(
      { error: "Cette carte n'est plus active dans le registre officiel. Adressez-vous à l'agent d'accueil." },
      { status: 403 },
    );
  }

  const periods = await db
    .select()
    .from(subscriptionPeriods)
    .where(eq(subscriptionPeriods.subscriberId, s.id))
    .orderBy(desc(subscriptionPeriods.endDate))
    .limit(1);

  const th = await getThresholds();
  const current = periods[0] ?? null;
  const status = computeStatus(current?.endDate ?? null, th, s.status);

  return NextResponse.json({
    data: {
      firstName: s.firstName,
      status,
      statusLabel: STATUS_LABEL[status],
    },
  });
}
