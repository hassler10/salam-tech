import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";

const COOKIE_NAME = "slp_self_service_gate";
const CODE_SETTING = "self_service_gate_code";
const SIGNING_KEY_SETTING = "self_service_gate_signing_key";
const CODE_TTL_MS = 10 * 60 * 1000;
const COOKIE_TTL_SECONDS = 20 * 60;
const PURPOSE = "salam-library-self-service-v1";
const CODE_LENGTH = 20;

function normalizeCode(candidate: unknown): string | null {
  if (typeof candidate !== "string" || candidate.length > 64) return null;
  const code = candidate.replace(/[\s-]/g, "").toUpperCase();
  return new RegExp(`^[A-F0-9]{${CODE_LENGTH}}$`).test(code) ? code : null;
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function formatCode(code: string): string {
  return code.match(/.{1,4}/g)?.join("-") ?? code;
}

export async function generateSelfServiceGateCode(createdBy: number) {
  const code = randomBytes(CODE_LENGTH / 2).toString("hex").toUpperCase();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);
  const value = JSON.stringify({
    hash: digest(code).toString("hex"),
    expiresAt: expiresAt.toISOString(),
    createdBy,
  });

  await db
    .insert(settings)
    .values({ key: CODE_SETTING, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });

  return { code: formatCode(code), expiresAt };
}

export async function consumeSelfServiceGateCode(candidate: unknown): Promise<boolean> {
  const code = normalizeCode(candidate);
  if (!code) return false;

  const [record] = await db.select().from(settings).where(eq(settings.key, CODE_SETTING)).limit(1);
  if (!record) return false;

  let parsed: { hash?: unknown; expiresAt?: unknown };
  try {
    parsed = JSON.parse(record.value) as { hash?: unknown; expiresAt?: unknown };
  } catch {
    return false;
  }

  if (
    typeof parsed.hash !== "string" ||
    !/^[a-f0-9]{64}$/.test(parsed.hash) ||
    typeof parsed.expiresAt !== "string" ||
    !Number.isFinite(Date.parse(parsed.expiresAt)) ||
    Date.parse(parsed.expiresAt) <= Date.now()
  ) {
    return false;
  }

  const expectedHash = Buffer.from(parsed.hash, "hex");
  const receivedHash = digest(code);
  if (!timingSafeEqual(expectedHash, receivedHash)) return false;

  // Suppression conditionnelle : un seul navigateur peut consommer le code.
  const removed = await db
    .delete(settings)
    .where(and(eq(settings.key, CODE_SETTING), eq(settings.value, record.value)))
    .returning({ key: settings.key });
  return removed.length === 1;
}

async function getSigningKey(): Promise<Buffer> {
  let [record] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, SIGNING_KEY_SETTING))
    .limit(1);

  if (!record) {
    await db
      .insert(settings)
      .values({ key: SIGNING_KEY_SETTING, value: randomBytes(32).toString("hex") })
      .onConflictDoNothing({ target: settings.key });
    [record] = await db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, SIGNING_KEY_SETTING))
      .limit(1);
  }

  if (!record || !/^[a-f0-9]{64}$/.test(record.value)) {
    throw new Error("La clé de session de la borne est indisponible.");
  }
  return Buffer.from(record.value, "hex");
}

function signature(payload: string, key: Buffer): string {
  return createHmac("sha256", key).update(`${PURPOSE}:${payload}`).digest("hex");
}

export async function createSelfServiceGateSession(): Promise<void> {
  const key = await getSigningKey();
  const expiresAt = Math.floor(Date.now() / 1000) + COOKIE_TTL_SECONDS;
  const nonce = randomBytes(16).toString("hex");
  const payload = `${expiresAt}.${nonce}`;
  const value = `${payload}.${signature(payload, key)}`;
  const store = await cookies();
  store.set(COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_TTL_SECONDS,
  });
}

export async function hasSelfServiceGateSession(): Promise<boolean> {
  const store = await cookies();
  const value = store.get(COOKIE_NAME)?.value;
  if (!value) return false;

  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const [expiresAtText, nonce, receivedSignature] = parts;
  if (!/^\d{10}$/.test(expiresAtText) || !/^[a-f0-9]{32}$/.test(nonce) || !/^[a-f0-9]{64}$/.test(receivedSignature)) {
    return false;
  }

  const expiresAt = Number(expiresAtText);
  const now = Math.floor(Date.now() / 1000);
  if (expiresAt <= now || expiresAt > now + COOKIE_TTL_SECONDS + 30) return false;

  const key = await getSigningKey();
  const payload = `${expiresAtText}.${nonce}`;
  const expected = Buffer.from(signature(payload, key), "hex");
  const received = Buffer.from(receivedSignature, "hex");
  return timingSafeEqual(expected, received);
}
