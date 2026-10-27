import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import {
  createSelfServiceGateSession,
  isSelfServiceGateConfigured,
  verifySelfServicePassword,
} from "@/lib/self-service-gate";

export async function POST(req: Request) {
  if (!isSelfServiceGateConfigured()) {
    return NextResponse.json(
      { error: "L'accès à la borne n'est pas encore configuré. Adressez-vous à l'administrateur." },
      { status: 503 },
    );
  }

  if (!(await rateLimit(`self-service-gate:${clientIp(req)}`, 5, 15 * 60 * 1000))) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessayez dans 15 minutes ou adressez-vous à l'accueil." },
      { status: 429, headers: { "Cache-Control": "no-store" } },
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.password !== "string" || body.password.length > 256) {
    return NextResponse.json({ error: "Mot de passe invalide." }, { status: 400 });
  }
  if (!verifySelfServicePassword(body.password)) {
    return NextResponse.json(
      { error: "Mot de passe incorrect. Demandez-le à l'agent d'accueil." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  await createSelfServiceGateSession();
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
