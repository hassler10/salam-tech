import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createSession, verifyPassword, hashPassword, isRole, logAudit } from "@/lib/auth";
import { ensureSeed } from "@/lib/seed";
import { clientIp, rateLimit } from "@/lib/ratelimit";

const MAX_USERNAME_LENGTH = 64;
const MAX_PASSWORD_LENGTH = 256;
// Hachage factice : le coût du scrypt est identique même si l'identifiant n'existe pas.
const DUMMY_PASSWORD_HASH = hashPassword("timing-equalization-dummy-password");

export async function POST(req: Request) {
  if (!(await rateLimit(`login:${clientIp(req)}`, 10, 15 * 60 * 1000))) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessayez dans 15 minutes." },
      { status: 429, headers: { "Retry-After": "900" } },
    );
  }
  await ensureSeed();
  const body = await req.json().catch(() => null);
  const username = String(body?.username ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  if (!username || !password) {
    return NextResponse.json({ error: "Identifiant et mot de passe requis." }, { status: 400 });
  }
  if (username.length > MAX_USERNAME_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return NextResponse.json({ error: "Identifiants invalides." }, { status: 401 });
  }
  const rows = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (rows.length === 0) {
    const count = await db.select({ id: users.id }).from(users).limit(1);
    if (count.length === 0) {
      return NextResponse.json(
        { error: "La configuration initiale des comptes est incomplète. Contactez l'administrateur." },
        { status: 503 },
      );
    }
  }
  const user = rows[0];
  const valid = verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!user || !user.active || !valid) {
    return NextResponse.json({ error: "Identifiants invalides." }, { status: 401 });
  }
  await createSession(user.id);
  await logAudit(
    {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: isRole(user.role) ? user.role : "agent",
    },
    "connexion",
    "utilisateur",
    user.id,
  );
  return NextResponse.json({ ok: true, role: user.role });
}
