import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import {
  MediaSalamError,
  fetchMediaSalamBackup,
  getMediaSalamConfig,
  recordMediaSalamFailure,
  syncMediaSalam,
} from "@/lib/media-salam";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const provided = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  if (!getMediaSalamConfig().configured) {
    return NextResponse.json(
      { error: "Synchronisation automatique non configurée." },
      { status: 503 },
    );
  }

  try {
    const payload = await fetchMediaSalamBackup();
    const result = await syncMediaSalam(payload, { mode: "auto" });
    return NextResponse.json({
      ok: true,
      lastSync: result.lastSync,
      counts: result.counts,
    });
  } catch (error) {
    const message =
      error instanceof MediaSalamError
        ? error.message
        : "Synchronisation media-salam impossible.";
    await recordMediaSalamFailure(message);
    return NextResponse.json(
      { error: message },
      { status: error instanceof MediaSalamError ? error.status : 502 },
    );
  }
}
