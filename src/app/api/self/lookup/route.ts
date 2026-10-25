import { NextResponse } from "next/server";
import { db } from "@/db";
import { subscribers, subscriptionPeriods } from "@/db/schema";
import { sql, eq, desc } from "drizzle-orm";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { getSettingsMap, getThresholds } from "@/lib/seed";
import { computeStatus, STATUS_LABEL } from "@/lib/subscriptions";

/**
 * Borne d'auto-identification d'un abonné.
 * Confidentialité : exige l'identifiant ET le nom exact et ne renvoie que le prénom
 * et l'état nécessaires à la confirmation de la visite.
 */
export async function POST(req: Request) {
  const settings = await getSettingsMap();
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
  if (!code || !lastName) {
    return NextResponse.json({ error: "Identifiant et nom obligatoires." }, { status: 400 });
  }
  if (code.length > 48 || lastName.length > 120) {
    return NextResponse.json(
      { error: "Identifiant ou nom incorrect. Adressez-vous à l'agent d'accueil." },
      { status: 400 },
    );
  }

  // Accepte le numéro de carte de la plateforme existante OU l'identifiant interne.
  const rows = await db
    .select({
      id: subscribers.id,
      firstName: subscribers.firstName,
      status: subscribers.status,
      source: subscribers.source,
    })
    .from(subscribers)
    .where(
      sql`(lower(${subscribers.cardNumber}) = lower(${code}) or lower(${subscribers.code}) = lower(${code}))
          and lower(${subscribers.lastName}) = lower(${lastName})`,
    )
    .limit(1);

  const s = rows[0];
  // Message volontairement générique : empêche de deviner les identifiants existants.
  if (!s) {
    return NextResponse.json(
      { error: "Identifiant ou nom incorrect. Adressez-vous à l'agent d'accueil." },
      { status: 404 },
    );
  }

  // Mode strict : seules les cartes issues du registre officiel importé sont acceptées.
  if ((settings.require_registered_card ?? "0") === "1" && s.source !== "import") {
    return NextResponse.json(
      { error: "Cette carte n'est pas reconnue par le registre officiel. Adressez-vous à l'agent d'accueil." },
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
