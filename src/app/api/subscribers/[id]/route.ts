import { NextResponse } from "next/server";
import { db } from "@/db";
import { subscribers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser, can, logAudit } from "@/lib/auth";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!can(user?.role, "subscribers.write")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const b = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  for (const k of ["lastName", "firstName", "phone", "email", "note", "status"] as const) {
    if (b?.[k] !== undefined) patch[k] = b[k] === "" ? null : b[k];
  }
  const [updated] = await db
    .update(subscribers)
    .set(patch)
    .where(eq(subscribers.id, Number(id)))
    .returning();
  await logAudit(user, "modification abonné", "abonné", id, JSON.stringify(b));
  return NextResponse.json({ data: updated });
}
