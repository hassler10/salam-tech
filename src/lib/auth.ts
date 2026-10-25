import { cookies } from "next/headers";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { db } from "@/db";
import { sessions, users, auditLogs, settings } from "@/db/schema";
import { eq, and, gt, ne } from "drizzle-orm";

export const SESSION_COOKIE = "slp_session";
export const MIN_PASSWORD_LENGTH = 12;

export const ROLES = ["admin", "responsable", "agent"] as const;

export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export type SessionUser = {
  id: number;
  username: string;
  fullName: string;
  role: Role;
};

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

async function sessionTimeoutMinutes(): Promise<number> {
  try {
    const r = await db
      .select()
      .from(settings)
      .where(eq(settings.key, "session_timeout_minutes"))
      .limit(1);
    const n = Number(r[0]?.value);
    return Number.isFinite(n) && n >= 5 ? n : 60;
  } catch {
    return 60;
  }
}

export async function createSession(userId: number) {
  const id = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * (await sessionTimeoutMinutes()));
  await db.insert(sessions).values({ id, userId, expiresAt });
  const store = await cookies();
  store.set(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  return id;
}

export async function getSessionId(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

export async function destroySession() {
  const store = await cookies();
  const id = store.get(SESSION_COOKIE)?.value;
  if (id) await db.delete(sessions).where(eq(sessions.id, id));
  store.delete(SESSION_COOKIE);
}

export async function revokeUserSessions(userId: number, exceptSessionId?: string | null) {
  const where = exceptSessionId
    ? and(eq(sessions.userId, userId), ne(sessions.id, exceptSessionId))
    : eq(sessions.userId, userId);
  await db.delete(sessions).where(where);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  try {
    const store = await cookies();
    const id = store.get(SESSION_COOKIE)?.value;
    if (!id) return null;
    const rows = await db
      .select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        role: users.role,
        active: users.active,
      })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())))
      .limit(1);
    const u = rows[0];
    if (!u || !u.active) return null;
    // Déconnexion automatique par inactivité : la session glisse à chaque activité.
    const renewed = new Date(Date.now() + 1000 * 60 * (await sessionTimeoutMinutes()));
    await db.update(sessions).set({ expiresAt: renewed }).where(eq(sessions.id, id));
    return { id: u.id, username: u.username, fullName: u.fullName, role: u.role as Role };
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const u = await getCurrentUser();
  if (!u) throw new Error("UNAUTHORIZED");
  return u;
}

const PERMS: Record<string, Role[]> = {
  "visits.create": ["admin", "responsable", "agent"],
  "visits.read": ["admin", "responsable", "agent"],
  "subscribers.read": ["admin", "responsable", "agent"],
  "subscribers.write": ["admin", "responsable", "agent"],
  "visitors.read": ["admin", "responsable", "agent"],
  "visitors.write": ["admin", "responsable", "agent"],
  "stats.read": ["admin", "responsable"],
  "reports.read": ["admin", "responsable"],
  "types.write": ["admin"],
  "users.manage": ["admin"],
  "audit.read": ["admin"],
  "settings.write": ["admin"],
};

export function can(role: Role | undefined, perm: keyof typeof PERMS | string): boolean {
  if (!role) return false;
  const allowed = PERMS[perm];
  return allowed ? allowed.includes(role) : false;
}

export async function logAudit(
  user: SessionUser | null,
  action: string,
  entity?: string,
  entityId?: string | number,
  details?: string,
) {
  await db.insert(auditLogs).values({
    userId: user?.id ?? null,
    userName: user?.fullName ?? "système",
    action,
    entity: entity ?? null,
    entityId: entityId != null ? String(entityId) : null,
    details: details ?? null,
  });
}
