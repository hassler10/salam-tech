import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser, can, hashPassword, logAudit } from "@/lib/auth";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!can(user?.role, "users.manage")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const b = await req.json().catch(() => ({}));
  const username = String(b?.username ?? "").trim().toLowerCase();
  const fullName = String(b?.fullName ?? "").trim();
  const password = String(b?.password ?? "");
  const role = String(b?.role ?? "agent");
  if (!username || !fullName || password.length < 6) {
    return NextResponse.json(
      { error: "Identifiant, nom complet et mot de passe (6 caractères min.) requis." },
      { status: 400 },
    );
  }
  const dup = await db.select().from(users).where(eq(users.username, username)).limit(1);
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
  const b = await req.json().catch(() => ({}));
  const id = Number(b?.id);
  if (!id) return NextResponse.json({ error: "Identifiant requis." }, { status: 400 });
  const patch: Record<string, unknown> = {};
  if (b.fullName !== undefined) patch.fullName = String(b.fullName);
  if (b.role !== undefined) patch.role = String(b.role);
  if (b.active !== undefined) patch.active = Boolean(b.active);
  if (b.password) patch.passwordHash = hashPassword(String(b.password));
  await db.update(users).set(patch).where(eq(users.id, id));
  await logAudit(user, "modification utilisateur", "utilisateur", id);
  return NextResponse.json({ ok: true });
}
