import { NextResponse } from "next/server";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { getCurrentUser, can, logAudit } from "@/lib/auth";

const TEXT_LIMITS: Record<string, number> = {
  library_name: 120,
  library_short_name: 40,
  library_subtitle: 80,
  library_city: 80,
  library_tagline: 160,
  library_hero_intro: 300,
  library_about: 2000,
  library_address: 200,
  opening_hours: 200,
  library_phone: 40,
  library_email: 120,
  library_map_url: 500,
};

const NUMBER_LIMITS: Record<string, [number, number]> = {
  alert_soon_days: [1, 3650],
  alert_imminent_days: [0, 3650],
  duplicate_window_minutes: [0, 1440],
  session_timeout_minutes: [5, 10080],
};

const FLAGS = new Set(["self_service_enabled", "require_registered_card"]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[0-9+().\s-]{0,40}$/;

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function invalid(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!can(user?.role, "settings.write")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object" || Array.isArray(b)) {
    return invalid("Requête invalide.");
  }
  const entries = Object.entries(b);
  if (entries.length === 0) return invalid("Aucun paramètre.");

  const clean: Record<string, string> = {};

  for (const [key, raw] of entries) {
    if (Object.hasOwn(TEXT_LIMITS, key)) {
      if (typeof raw !== "string") return invalid(`Valeur invalide pour « ${key} ».`);
      const value = raw.trim();
      if (value.length > TEXT_LIMITS[key]) {
        return invalid(`La valeur de « ${key} » est trop longue (${TEXT_LIMITS[key]} caractères max.).`);
      }
      if (key === "library_email" && value && !EMAIL_RE.test(value)) {
        return invalid("Adresse e-mail invalide.");
      }
      if (key === "library_map_url" && value && !isHttpUrl(value)) {
        return invalid("Le lien de localisation doit commencer par http:// ou https://.");
      }
      if (key === "library_phone" && !PHONE_RE.test(value)) {
        return invalid("Numéro de téléphone invalide.");
      }
      clean[key] = value;
    } else if (Object.hasOwn(NUMBER_LIMITS, key)) {
      const value =
        typeof raw === "number"
          ? raw
          : typeof raw === "string" && raw.trim() !== ""
            ? Number(raw)
            : NaN;
      const [min, max] = NUMBER_LIMITS[key];
      if (!Number.isInteger(value) || value < min || value > max) {
        return invalid(`« ${key} » doit être un nombre entier entre ${min} et ${max}.`);
      }
      clean[key] = String(value);
    } else if (FLAGS.has(key)) {
      if (raw === true || raw === "1") clean[key] = "1";
      else if (raw === false || raw === "0") clean[key] = "0";
      else return invalid(`Valeur invalide pour « ${key} » (0 ou 1 attendu).`);
    } else {
      return invalid(`Paramètre inconnu : « ${String(key).slice(0, 50)} ».`);
    }
  }

  for (const [key, value] of Object.entries(clean)) {
    await db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } });
  }
  await logAudit(user, "modification paramètres", "paramètres", undefined, Object.keys(clean).join(", "));
  return NextResponse.json({ ok: true });
}
