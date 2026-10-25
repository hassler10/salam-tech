import { db } from "@/db";
import { users, subscriptionTypes, visitReasons, settings } from "@/db/schema";
import { hashPassword } from "./auth";
import { PUBLIC_DEFAULTS } from "./public-defaults";
import { inArray, notInArray, sql } from "drizzle-orm";

let done = false;

export const MEDIA_SETTING_KEYS = ["library_logo", "library_cover"] as const;

export async function ensureSeed() {
  if (done) return;
  try {
    const existing = await db.select({ c: sql<number>`count(*)::int` }).from(users);
    if ((existing[0]?.c ?? 0) === 0) {
      const bootstrapPasswords = {
        admin: process.env.SEED_ADMIN_PASSWORD,
        responsable: process.env.SEED_MANAGER_PASSWORD,
        agent: process.env.SEED_AGENT_PASSWORD,
      };
      if (Object.values(bootstrapPasswords).some((password) => !password || password.length < 12)) {
        throw new Error("Configurez SEED_ADMIN_PASSWORD, SEED_MANAGER_PASSWORD et SEED_AGENT_PASSWORD (12 caractères minimum) avant le premier démarrage.");
      }
      await db.insert(users).values([
        {
          username: "admin",
          fullName: "Administrateur Système",
          passwordHash: hashPassword(bootstrapPasswords.admin!),
          role: "admin",
        },
        {
          username: "responsable",
          fullName: "Responsable Bibliothèque",
          passwordHash: hashPassword(bootstrapPasswords.responsable!),
          role: "responsable",
        },
        {
          username: "agent",
          fullName: "Agent d'Accueil",
          passwordHash: hashPassword(bootstrapPasswords.agent!),
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
        { key: "library_name", value: PUBLIC_DEFAULTS.library_name },
        { key: "library_city", value: PUBLIC_DEFAULTS.library_city },
        { key: "library_tagline", value: PUBLIC_DEFAULTS.library_tagline },
        { key: "library_about", value: PUBLIC_DEFAULTS.library_about },
        { key: "library_address", value: PUBLIC_DEFAULTS.library_address },
        { key: "alert_soon_days", value: "7" },
        { key: "alert_imminent_days", value: "3" },
        { key: "duplicate_window_minutes", value: "30" },
        { key: "session_timeout_minutes", value: "60" },
        { key: "self_service_enabled", value: "1" },
      ]);
    }
    await db
      .insert(settings)
      .values(
        Object.entries(PUBLIC_DEFAULTS).map(([key, value]) => ({ key, value })),
      )
      .onConflictDoNothing();
    done = true;
  } catch {
    // la base n'est peut-être pas encore prête
  }
}

export async function getSettingsMap(): Promise<Record<string, string>> {
  try {
    const rows = await db
      .select()
      .from(settings)
      .where(notInArray(settings.key, [...MEDIA_SETTING_KEYS]));
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  } catch {
    return {};
  }
}

export async function getMediaSettings(): Promise<Record<string, string>> {
  try {
    const rows = await db
      .select()
      .from(settings)
      .where(inArray(settings.key, [...MEDIA_SETTING_KEYS]));
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
