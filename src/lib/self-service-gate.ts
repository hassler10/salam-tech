import { createHmac, randomBytes, createHash, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "slp_self_service_gate";
const COOKIE_TTL_SECONDS = 20 * 60;
const PURPOSE = "salam-library-self-service-v1";

function configuredPassword(): string | null {
  const password = process.env.SELF_SERVICE_GATE_PASSWORD;
  return password && password.length >= 32 ? password : null;
}

export function isSelfServiceGateConfigured(): boolean {
  return configuredPassword() !== null;
}

export function verifySelfServicePassword(candidate: unknown): boolean {
  const configured = configuredPassword();
  if (!configured || typeof candidate !== "string" || candidate.length > 256) return false;
  const expected = createHash("sha256").update(configured).digest();
  const received = createHash("sha256").update(candidate).digest();
  return timingSafeEqual(expected, received);
}

function signature(payload: string, password: string): string {
  return createHmac("sha256", password).update(`${PURPOSE}:${payload}`).digest("hex");
}

export async function createSelfServiceGateSession(): Promise<void> {
  const password = configuredPassword();
  if (!password) throw new Error("SELF_SERVICE_GATE_PASSWORD is not configured.");

  const expiresAt = Math.floor(Date.now() / 1000) + COOKIE_TTL_SECONDS;
  const nonce = randomBytes(16).toString("hex");
  const payload = `${expiresAt}.${nonce}`;
  const value = `${payload}.${signature(payload, password)}`;
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
  const password = configuredPassword();
  if (!password) return false;

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

  const payload = `${expiresAtText}.${nonce}`;
  const expected = Buffer.from(signature(payload, password), "hex");
  const received = Buffer.from(receivedSignature, "hex");
  return timingSafeEqual(expected, received);
}
