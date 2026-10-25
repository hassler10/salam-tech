import { createHash } from "crypto";
import { db } from "@/db";
import { sql } from "drizzle-orm";

let storageReady: Promise<void> | null = null;
let lastCleanup = 0;

async function ensureStorage() {
  if (!storageReady) {
    storageReady = db.execute(sql`
      CREATE TABLE IF NOT EXISTS rate_limit_buckets (
        bucket_hash varchar(64) PRIMARY KEY,
        hit_count integer NOT NULL,
        reset_at bigint NOT NULL
      )
    `).then(() => undefined).catch((error) => {
      storageReady = null;
      throw error;
    });
  }
  await storageReady;
}

/**
 * Compteur partagé entre les instances grâce à PostgreSQL.
 * En cas d'indisponibilité du stockage, l'appel échoue fermé (pas de contournement).
 */
export async function rateLimit(key: string, max: number, windowMs: number): Promise<boolean> {
  const now = Date.now();
  await ensureStorage();

  const hash = createHash("sha256").update(key).digest("hex");
  const resetAt = now + windowMs;
  const result = await db.execute(sql`
    INSERT INTO rate_limit_buckets (bucket_hash, hit_count, reset_at)
    VALUES (${hash}, 1, ${resetAt})
    ON CONFLICT (bucket_hash) DO UPDATE SET
      hit_count = CASE
        WHEN rate_limit_buckets.reset_at <= ${now} THEN 1
        ELSE LEAST(rate_limit_buckets.hit_count + 1, ${max + 1})
      END,
      reset_at = CASE
        WHEN rate_limit_buckets.reset_at <= ${now} THEN ${resetAt}
        ELSE rate_limit_buckets.reset_at
      END
    RETURNING hit_count
  `);

  if (now - lastCleanup > 10 * 60 * 1000) {
    lastCleanup = now;
    await db.execute(sql`DELETE FROM rate_limit_buckets WHERE reset_at < ${now - 60 * 60 * 1000}`);
  }

  return Number(result.rows[0]?.hit_count ?? max + 1) <= max;
}

function sanitizeIp(value: string | null): string | null {
  if (!value) return null;
  const ip = value.trim();
  if (!ip || ip.length > 64) return null;
  return /^[0-9a-fA-F:.]+$/.test(ip) ? ip : null;
}

export function clientIp(req: Request): string {
  const h = req.headers;
  // x-real-ip est posé par la plateforme d'hébergement ; à défaut, on prend
  // l'adresse la plus à droite de x-forwarded-for (celle ajoutée par le proxy).
  const realIp = sanitizeIp(h.get("x-real-ip"));
  if (realIp) return realIp;
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const last = forwarded.split(",").at(-1) ?? "";
    const ip = sanitizeIp(last);
    if (ip) return ip;
  }
  return "inconnu";
}

/** Masque un nom : "KOUASSI" -> "K******" */
export function maskName(name: string): string {
  if (name.length <= 1) return name;
  return name[0].toUpperCase() + "•".repeat(Math.min(name.length - 1, 6));
}
