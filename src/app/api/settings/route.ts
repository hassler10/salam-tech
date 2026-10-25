import { NextResponse } from "next/server";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { getCurrentUser, can, logAudit } from "@/lib/auth";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!can(user?.role, "settings.write")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const b = (await req.json().catch(() => ({}))) as Record<string, string>;
  for (const [key, value] of Object.entries(b)) {
    await db
      .insert(settings)
      .values({ key, value: String(value) })
      .onConflictDoUpdate({ target: settings.key, set: { value: String(value) } });
  }
  await logAudit(user, "modification paramètres", "paramètres", undefined, Object.keys(b).join(", "));
  return NextResponse.json({ ok: true });
}
