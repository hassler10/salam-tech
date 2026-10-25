import { NextResponse } from "next/server";
import { destroySession, getCurrentUser, logAudit } from "@/lib/auth";

export async function POST() {
  const u = await getCurrentUser();
  if (u) await logAudit(u, "déconnexion", "utilisateur", u.id);
  await destroySession();
  return NextResponse.json({ ok: true });
}
