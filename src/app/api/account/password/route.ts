import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  getCurrentUser,
  getSessionId,
  revokeUserSessions,
  hashPassword,
  verifyPassword,
  logAudit,
  MIN_PASSWORD_LENGTH,
} from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/ratelimit";

const MAX_PASSWORD_LENGTH = 256;

function passwordError() {
  return NextResponse.json(
    {
      error: `Le nouveau mot de passe doit contenir entre ${MIN_PASSWORD_LENGTH} et ${MAX_PASSWORD_LENGTH} caractères.`,
    },
    { status: 400 },
  );
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  if (!(await rateLimit(`password:${user.id}:${clientIp(req)}`, 5, 15 * 60 * 1000))) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessayez dans quelques minutes." },
      { status: 429 },
    );
  }

  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object" || Array.isArray(b)) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const currentPassword = typeof b.currentPassword === "string" ? b.currentPassword : "";
  const newPassword = typeof b.newPassword === "string" ? b.newPassword : "";
  if (!currentPassword || currentPassword.length > MAX_PASSWORD_LENGTH) {
    return NextResponse.json({ error: "Mot de passe actuel requis." }, { status: 400 });
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH || newPassword.length > MAX_PASSWORD_LENGTH) {
    return passwordError();
  }

  const rows = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  if (!rows[0] || !verifyPassword(currentPassword, rows[0].passwordHash)) {
    await logAudit(user, "échec changement mot de passe", "utilisateur", user.id);
    return NextResponse.json({ error: "Mot de passe actuel incorrect." }, { status: 400 });
  }
  if (verifyPassword(newPassword, rows[0].passwordHash)) {
    return NextResponse.json(
      { error: "Le nouveau mot de passe doit être différent de l'actuel." },
      { status: 400 },
    );
  }

  await db
    .update(users)
    .set({ passwordHash: hashPassword(newPassword) })
    .where(eq(users.id, user.id));
  await revokeUserSessions(user.id, await getSessionId());
  await logAudit(user, "changement mot de passe", "utilisateur", user.id);

  return NextResponse.json({ ok: true });
}
