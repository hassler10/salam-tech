import { NextResponse } from "next/server";
import { can, getCurrentUser, logAudit } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { generateSelfServiceGateCode } from "@/lib/self-service-gate";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "visits.create")) {
    return NextResponse.json({ error: "Accès réservé au personnel autorisé." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  if (!(await rateLimit(`gate-code:${user.id}:${clientIp(req)}`, 10, 60 * 60 * 1000))) {
    return NextResponse.json({ error: "Limite de génération atteinte. Réessayez plus tard." }, { status: 429, headers: { "Cache-Control": "no-store" } });
  }
  const result = await generateSelfServiceGateCode(user.id);
  await logAudit(user, "génération code borne", "borne", undefined, `Expire à ${result.expiresAt.toISOString()}`);
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
