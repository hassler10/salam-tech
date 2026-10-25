import { db } from "@/db";
import { users, subscriptionTypes, visitReasons, settings } from "@/db/schema";
import { hashPassword } from "./auth";
import { sql } from "drizzle-orm";

let done = false;

export async function ensureSeed() {
  if (done) return;
  try {
    const existing = await db.select({ c: sql<number>`count(*)::int` }).from(users);
    if ((existing[0]?.c ?? 0) === 0) {
      await db.insert(users).values([
        {
          username: "admin",
          fullName: "Administrateur Système",
          passwordHash: hashPassword("admin123"),
          role: "admin",
        },
        {
          username: "responsable",
          fullName: "Responsable Bibliothèque",
          passwordHash: hashPassword("respo123"),
          role: "responsable",
        },
        {
          username: "agent",
          fullName: "Agent d'Accueil",
          passwordHash: hashPassword("agent123"),
          role: "agent",
        },
      ]);
    }

    const t = await db.select({ c: sql<number>`count(*)::int` }).from(subscriptionTypes);
    if ((t[0]?.c ?? 0) === 0) {
      await db.insert(subscriptionTypes).values([
        { name: "Abonnement 1 mois", durationMonths: 1, description: "Validité d'un mois" },
        { name: "Abonnement 3 mois", durationMonths: 3, description: "Validité de trois mois" },
        { name: "Abonnement 6 mois", durationMonths: 6, description: "Validité de six mois" },
        { name: "Abonnement 12 mois", durationMonths: 12, description: "Validité de douze mois" },
      ]);
    }

    const r = await db.select({ c: sql<number>`count(*)::int` }).from(visitReasons);
    if ((r[0]?.c ?? 0) === 0) {
      await db.insert(visitReasons).values([
        { label: "Consultation d'ouvrages" },
        { label: "Recherche documentaire" },
        { label: "Utilisation des outils numériques" },
        { label: "Demande d'information" },
        { label: "Visite institutionnelle" },
        { label: "Autre motif" },
      ]);
    }

    const s = await db.select({ c: sql<number>`count(*)::int` }).from(settings);
    if ((s[0]?.c ?? 0) === 0) {
      await db.insert(settings).values([
        { key: "library_name", value: "Bibliothèque de la Mosquée Salam du Plateau" },
        { key: "library_city", value: "Abidjan, Côte d'Ivoire" },
        { key: "alert_soon_days", value: "7" },
        { key: "alert_imminent_days", value: "3" },
        { key: "duplicate_window_minutes", value: "30" },
        { key: "session_timeout_minutes", value: "60" },
        { key: "self_service_enabled", value: "1" },
      ]);
    }
    done = true;
  } catch {
    // la base n'est peut-être pas encore prête
  }
}

export async function getSettingsMap(): Promise<Record<string, string>> {
  try {
    const rows = await db.select().from(settings);
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  } catch {
    return {};
  }
}

export async function getThresholds() {
  const m = await getSettingsMap();
  return {
    soon: Number(m.alert_soon_days ?? 7),
    imminent: Number(m.alert_imminent_days ?? 3),
  };
}
