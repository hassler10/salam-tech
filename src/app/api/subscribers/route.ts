import { after, NextResponse } from "next/server";
import { db } from "@/db";
import { subscribers } from "@/db/schema";
import { and, ilike, or, eq } from "drizzle-orm";
import { getCurrentUser, can, logAudit } from "@/lib/auth";
import { findMediaSalamSubscriberByIdentity } from "@/lib/identity";
import { getSettingsMap } from "@/lib/seed";
import { isMediaSalamSyncFresh, refreshMediaSalamIfDue } from "@/lib/media-salam";

export const maxDuration = 60;

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!can(user?.role, "subscribers.read")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  after(() => refreshMediaSalamIfDue());
  let settings = await getSettingsMap();
  if (!isMediaSalamSyncFresh(settings)) {
    await refreshMediaSalamIfDue();
    settings = await getSettingsMap();
  }
  if (!isMediaSalamSyncFresh(settings)) {
    return NextResponse.json({ error: "Registre officiel indisponible. Réessayez plus tard." }, { status: 503 });
  }
  const q = new URL(req.url).searchParams.get("q")?.trim().slice(0, 100) ?? "";
  const clauses = [eq(subscribers.source, "media_salam"), eq(subscribers.status, "actif")];
  if (q) {
    clauses.push(or(
      ilike(subscribers.lastName, `%${q}%`),
      ilike(subscribers.firstName, `%${q}%`),
      ilike(subscribers.cardNumber, `%${q}%`),
    )!);
  }
  const rows = await db.select().from(subscribers).where(and(...clauses)).limit(50);
  return NextResponse.json({ data: rows });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!can(user?.role, "subscribers.write")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const cardNumber = typeof body.cardNumber === "string" ? body.cardNumber.trim() : "";
  const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  if (!cardNumber || !lastName || !firstName || cardNumber.length > 48 || lastName.length > 120 || firstName.length > 180) {
    return NextResponse.json({ error: "Numéro de carte, nom et prénoms valides obligatoires." }, { status: 400 });
  }

  await refreshMediaSalamIfDue();
  const settings = await getSettingsMap();
  if (!isMediaSalamSyncFresh(settings)) {
    return NextResponse.json({ error: "Le registre Media Salam n'a pas pu être actualisé. Aucun abonné n'a été créé." }, { status: 503 });
  }
  const subscriber = await findMediaSalamSubscriberByIdentity(cardNumber, lastName, firstName);
  if (!subscriber) {
    return NextResponse.json({ error: "Carte et identité absentes du registre officiel. Enregistrez d'abord cette personne dans Media Salam." }, { status: 404 });
  }
  if (subscriber.status !== "actif") {
    return NextResponse.json({ error: "Cette carte est inactive dans Media Salam." }, { status: 403 });
  }
  await logAudit(user, "vérification abonné Media Salam", "abonné", subscriber.id, `${subscriber.lastName} ${subscriber.firstName}`);
  return NextResponse.json({ data: subscriber });
}
