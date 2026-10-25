import { NextResponse } from "next/server";
import { db } from "@/db";
import { subscriptionPeriods } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { getSettingsMap, getThresholds } from "@/lib/seed";
import { computeStatus, STATUS_LABEL } from "@/lib/subscriptions";
import { findSubscriberByIdentity } from "@/lib/identity";
import { refreshMediaSalamIfDue } from "@/lib/media-salam";

export const maxDuration = 60;

/**
 * Borne d'auto-identification d'un abonné.
 * Confidentialité : exige le numéro de carte ET les deux noms exacts, puis ne renvoie
 * que le prénom et l'état nécessaires à la confirmation de la visite.
 */
export async function POST(req: Request) {
  let settings = await getSettingsMap();
  if ((settings.self_service_enabled ?? "1") !== "1") {
    return NextResponse.json({ error: "La borne est désactivée." }, { status: 403 });
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

  // Accepte le numéro de carte de la plateforme existante OU l'identifiant interne,
  // mais toujours avec les deux noms de la carte.
  let s = await findSubscriberByIdentity(code, lastName, firstName);
  const strict = (settings.require_registered_card ?? "0") === "1";

  // Carte inconnue ou refusée par le mode strict : on relit le registre officiel
  // avant de répondre. Une fiche saisie dans media-salam est ainsi reconnue sans
  // synchronisation manuelle ; la lecture est limitée à une tentative toutes les 30 s.
  if (
    !s ||
    (strict &&
      (!settings.media_salam_last_sync_at || s.source !== "media_salam" || s.status !== "actif"))
  ) {
    await refreshMediaSalamIfDue();
    settings = await getSettingsMap();
    s = (await findSubscriberByIdentity(code, lastName, firstName)) ?? s;
  }

  // Message volontairement générique : empêche de deviner les identifiants existants.
  if (!s) {
    return NextResponse.json(
      { error: "Identifiant ou nom incorrect. Adressez-vous à l'agent d'accueil." },
      { status: 404 },
    );
  }

  const strictNow = (settings.require_registered_card ?? "0") === "1";
  if (strictNow) {
    if (!settings.media_salam_last_sync_at) {
      return NextResponse.json(
        {
          error:
            "Le registre officiel n'est pas encore synchronisé. Adressez-vous à l'agent d'accueil.",
        },
        { status: 503 },
      );
    }
    if (s.source !== "media_salam") {
      return NextResponse.json(
        {
          error:
            "Cette carte ne figure pas dans le registre officiel. Adressez-vous à l'agent d'accueil.",
        },
        { status: 403 },
      );
    }
    if (s.status !== "actif") {
      return NextResponse.json(
        {
          error:
            "Cette carte n'est plus active dans le registre officiel. Adressez-vous à l'agent d'accueil.",
        },
        { status: 403 },
      );
    }
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
