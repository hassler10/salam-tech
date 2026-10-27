import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { closeExpiredPresences } from "@/lib/presence";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(secret ? `Bearer ${secret}` : "");
  if (!secret || provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const closed = await closeExpiredPresences();
  return NextResponse.json({ ok: true, closed });
}
