type Entry = { count: number; resetAt: number };

const buckets = new Map<string, Entry>();
const MAX_BUCKETS = 50_000;
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, entry] of buckets) {
    if (now > entry.resetAt) buckets.delete(key);
  }
  if (buckets.size > MAX_BUCKETS) buckets.clear();
}

/**
 * Limitation de débit en mémoire (par instance).
 * Limite : protège la borne publique contre l'énumération des identifiants.
 */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  sweep(now);
  const e = buckets.get(key);
  if (!e || now > e.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (e.count >= max) return false;
  e.count++;
  return true;
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
