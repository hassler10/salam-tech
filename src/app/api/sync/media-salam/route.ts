import { NextResponse } from "next/server";
import { can, getCurrentUser, logAudit } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import {
  MediaSalamError,
  fetchMediaSalamBackup,
  previewMediaSalam,
  recordMediaSalamFailure,
  syncMediaSalam,
} from "@/lib/media-salam";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!can(user?.role, "settings.write")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }
  if (!(await rateLimit(`media-salam-sync:${user!.id}`, 6, 10 * 60 * 1000))) {
    return NextResponse.json(
      { error: "Trop de synchronisations successives. Réessayez dans quelques minutes." },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => null);
  if (body !== null && (typeof body !== "object" || Array.isArray(body))) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const input = (body ?? {}) as { mode?: unknown; backup?: unknown };
  const mode = input.mode === "preview" ? "preview" : "apply";

  try {
    const payload =
      input.backup !== undefined ? input.backup : await fetchMediaSalamBackup();

    if (mode === "preview") {
      const preview = await previewMediaSalam(payload);
      return NextResponse.json({ ok: true, preview });
    }

    const result = await syncMediaSalam(payload, { mode: "manuel" });
    const c = result.counts;
    await logAudit(
      user,
      "synchronisation media-salam",
      "abonnés",
      undefined,
      `${c.total} fiches : ${c.crees} créées, ${c.majs} mises à jour, ${c.suspendus} suspendues, ${c.erreurs} erreurs.`,
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message =
      error instanceof MediaSalamError
        ? error.message
        : "Synchronisation media-salam impossible.";
    if (mode === "apply") await recordMediaSalamFailure(message);
    return NextResponse.json(
      { error: message },
      { status: error instanceof MediaSalamError ? error.status : 502 },
    );
  }
}
