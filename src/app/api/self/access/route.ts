import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { consumeSelfServiceGateCode, createSelfServiceGateSession } from "@/lib/self-service-gate";

export async function POST(req: Request) {
  if (!(await rateLimit(`self-service-gate:${clientIp(req)}`, 5, 15 * 60 * 1000))) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessayez dans 15 minutes ou adressez-vous à l'accueil." },
      { status: 429, headers: { "Cache-Control": "no-store" } },
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.code !== "string" || body.code.length > 64) {
    return NextResponse.json({ error: "Code invalide." }, { status: 400 });
  }
  if (!(await consumeSelfServiceGateCode(body.code))) {
    return NextResponse.json(
      { error: "Code incorrect, expiré ou déjà utilisé. Demandez à l'agent d'en générer un nouveau." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  await createSelfServiceGateSession();
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
