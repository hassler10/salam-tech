type Entry = { count: number; resetAt: number };

const buckets = new Map<string, Entry>();

/**
 * Limitation de débit en mémoire (par instance).
 * Limite : protège la borne publique contre l'énumération des identifiants.
 */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const e = buckets.get(key);
  if (!e || now > e.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (e.count >= max) return false;
  e.count++;
  return true;
}

export function clientIp(req: Request): string {
  const h = req.headers;
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "inconnu"
  );
}

/** Masque un nom : "KOUASSI" -> "K******" */
export function maskName(name: string): string {
  if (name.length <= 1) return name;
  return name[0].toUpperCase() + "•".repeat(Math.min(name.length - 1, 6));
}
