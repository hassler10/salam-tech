import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import {
  getCurrentUser,
  getSessionId,
  revokeUserSessions,
  can,
  hashPassword,
  isRole,
  logAudit,
  MIN_PASSWORD_LENGTH,
} from "@/lib/auth";

const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/;
const MAX_NAME_LENGTH = 160;
const MAX_PASSWORD_LENGTH = 256;

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function validatePassword(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (value.length < MIN_PASSWORD_LENGTH) return null;
  if (value.length > MAX_PASSWORD_LENGTH) return null;
  return value;
}

function passwordError() {
  return NextResponse.json(
    {
      error: `Le mot de passe doit contenir entre ${MIN_PASSWORD_LENGTH} et ${MAX_PASSWORD_LENGTH} caractères.`,
    },
    { status: 400 },
  );
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!can(user?.role, "users.manage")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object") {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const username = readString(b.username).toLowerCase();
  const fullName = readString(b.fullName);
  const password = validatePassword(b.password);
  const role = b.role ?? "agent";

  if (!USERNAME_RE.test(username)) {
    return NextResponse.json(
      {
        error:
          "Identifiant invalide : 3 à 32 caractères, lettres minuscules, chiffres, point, tiret ou underscore.",
      },
      { status: 400 },
    );
  }
  if (!fullName || fullName.length > MAX_NAME_LENGTH) {
    return NextResponse.json(
      { error: `Le nom complet est requis (${MAX_NAME_LENGTH} caractères max.).` },
      { status: 400 },
    );
  }
  if (!password) return passwordError();
  if (!isRole(role)) {
    return NextResponse.json({ error: "Rôle invalide." }, { status: 400 });
  }

  const dup = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
  if (dup[0]) return NextResponse.json({ error: "Identifiant déjà utilisé." }, { status: 409 });

  const [u] = await db
    .insert(users)
    .values({ username, fullName, role, passwordHash: hashPassword(password) })
    .returning();
  await logAudit(user, "création utilisateur", "utilisateur", u.id, username);
  return NextResponse.json({ data: { id: u.id, username: u.username } });
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!can(user?.role, "users.manage")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object") {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const id = Number(b.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Identifiant requis." }, { status: 400 });
  }
  const targetRows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  const target = targetRows[0];
  if (!target) return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });

  const patch: Partial<typeof users.$inferInsert> = {};
  const changed: string[] = [];

  if (b.fullName !== undefined) {
    const fullName = readString(b.fullName);
    if (!fullName || fullName.length > MAX_NAME_LENGTH) {
      return NextResponse.json(
        { error: `Le nom complet est requis (${MAX_NAME_LENGTH} caractères max.).` },
        { status: 400 },
      );
    }
    patch.fullName = fullName;
    changed.push("nom");
  }

  let nextRole: string | undefined;
  if (b.role !== undefined) {
    if (!isRole(b.role)) return NextResponse.json({ error: "Rôle invalide." }, { status: 400 });
    nextRole = b.role;
    patch.role = b.role;
    changed.push("rôle");
  }

  let nextActive: boolean | undefined;
  if (b.active !== undefined) {
    if (typeof b.active !== "boolean") {
      return NextResponse.json({ error: "État invalide." }, { status: 400 });
    }
    nextActive = b.active;
    patch.active = b.active;
    changed.push("état");
  }

  let passwordChanged = false;
  if (b.password !== undefined) {
    const password = validatePassword(b.password);
    if (!password) return passwordError();
    patch.passwordHash = hashPassword(password);
    passwordChanged = true;
    changed.push("mot de passe");
  }

  if (changed.length === 0) {
    return NextResponse.json({ error: "Aucune modification." }, { status: 400 });
  }

  const isSelf = target.id === user!.id;
  if (isSelf && nextRole !== undefined && nextRole !== target.role) {
    return NextResponse.json(
      { error: "Vous ne pouvez pas modifier votre propre rôle." },
      { status: 400 },
    );
  }
  if (isSelf && nextActive === false) {
    return NextResponse.json({ error: "Vous ne pouvez pas désactiver votre compte." }, { status: 400 });
  }

  const losesAdmin =
    target.role === "admin" &&
    target.active &&
    ((nextRole !== undefined && nextRole !== "admin") || nextActive === false);
  if (losesAdmin) {
    const admins = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, "admin"), eq(users.active, true)));
    if (!admins.some((a) => a.id !== target.id)) {
      return NextResponse.json(
        { error: "Impossible de retirer le dernier administrateur actif." },
        { status: 400 },
      );
    }
  }

  await db.update(users).set(patch).where(eq(users.id, target.id));

  if (passwordChanged || nextActive === false || (nextRole !== undefined && nextRole !== target.role)) {
    const keep = isSelf && passwordChanged ? await getSessionId() : null;
    await revokeUserSessions(target.id, keep);
  }

  await logAudit(user, "modification utilisateur", "utilisateur", target.id, changed.join(", "));
  return NextResponse.json({ ok: true });
}
