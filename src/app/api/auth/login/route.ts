import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createSession, verifyPassword, logAudit } from "@/lib/auth";
import { ensureSeed } from "@/lib/seed";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export async function POST(req: Request) {
  if (!rateLimit(`login:${clientIp(req)}`, 10, 15 * 60 * 1000)) {
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
  if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: "Identifiants invalides." }, { status: 401 });
  }
  await createSession(user.id);
  await logAudit(
    { id: user.id, username: user.username, fullName: user.fullName, role: user.role as "admin" },
    "connexion",
    "utilisateur",
    user.id,
  );
  return NextResponse.json({ ok: true, role: user.role });
}
