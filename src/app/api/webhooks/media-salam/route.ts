import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import {
  MediaSalamError,
  fetchMediaSalamBackup,
  recordMediaSalamFailure,
  syncMediaSalam,
} from "@/lib/media-salam";
import { rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const EVENT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_CLOCK_SKEW_MS = 5 * 60_000;
let eventSchema: Promise<void> | null = null;

async function ensureEventSchema() {
  if (!eventSchema) {
    eventSchema = db.execute(sql`
      create table if not exists media_salam_webhook_events (
        event_id varchar(64) primary key,
        processed_at timestamptz not null default now()
      )
    `).then(() => undefined).catch((error) => {
      eventSchema = null;
      throw error;
    });
  }
  await eventSchema;
}

function validSignature(secret: string, timestamp: string, body: string, signature: string | null) {
  if (!signature || !/^[0-9a-f]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest();
  const supplied = Buffer.from(signature, "hex");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

async function recordWebhookResult(status: "ok" | "error", message = "") {
  const values: [string, string][] = [
    ["media_salam_last_webhook_status", status],
    ["media_salam_last_webhook_at", new Date().toISOString()],
    ["media_salam_last_webhook_error", message.replace(/\s+/g, " ").slice(0, 180)],
  ];
  for (const [key, value] of values) {
    await db.insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } });
  }
}

export async function POST(request: Request) {
  const secret = process.env.MEDIA_SALAM_WEBHOOK_SECRET ?? "";
  if (secret.length < 32) {
    return NextResponse.json({ error: "Webhook non configuré." }, { status: 503 });
  }

  const timestamp = request.headers.get("x-media-salam-timestamp") ?? "";
  const timestampMs = Number(timestamp);
  const declaredLength = Number(request.headers.get("content-length") ?? "");
  if (
    !/^\d{13}$/.test(timestamp) ||
    !Number.isFinite(timestampMs) ||
    Math.abs(Date.now() - timestampMs) > MAX_CLOCK_SKEW_MS ||
    (Number.isFinite(declaredLength) && declaredLength > 64_000)
  ) {
    return NextResponse.json({ error: "Événement invalide ou expiré." }, { status: 401 });
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > 64_000 || !validSignature(
    secret,
    timestamp,
    rawBody,
    request.headers.get("x-media-salam-signature"),
  )) {
    return NextResponse.json({ error: "Signature invalide." }, { status: 401 });
  }

  let event: {
    eventId?: unknown;
    occurredAt?: unknown;
    type?: unknown;
    subscriber?: unknown;
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Événement invalide." }, { status: 400 });
  }
  if (
    typeof event.eventId !== "string" ||
    !EVENT_ID_PATTERN.test(event.eventId) ||
    typeof event.occurredAt !== "string" ||
    !Number.isFinite(Date.parse(event.occurredAt)) ||
    (event.type !== "subscriber.changed" && event.type !== "registry.refresh") ||
    (event.type === "subscriber.changed" && (!event.subscriber || typeof event.subscriber !== "object" || Array.isArray(event.subscriber)))
  ) {
    return NextResponse.json({ error: "Événement invalide." }, { status: 400 });
  }

  try {
    await ensureEventSchema();
    const seen = await db.execute(sql`
      select event_id from media_salam_webhook_events where event_id = ${event.eventId} limit 1
    `);
    if (seen.rows.length) return NextResponse.json({ ok: true, duplicate: true });

    if (!(await rateLimit("media-salam-webhook", 30, 60_000))) {
      return NextResponse.json({ error: "Trop d’événements. Réessayez plus tard." }, { status: 429 });
    }

    const result = event.type === "registry.refresh"
      ? await syncMediaSalam(await fetchMediaSalamBackup(), { mode: "webhook" })
      : await syncMediaSalam(
          { generatedAt: event.occurredAt, subscribers: [event.subscriber] },
          { mode: "webhook", fullSnapshot: false },
        );

    await db.execute(sql`
      insert into media_salam_webhook_events (event_id) values (${event.eventId})
      on conflict (event_id) do nothing
    `);
    await db.execute(sql`
      delete from media_salam_webhook_events where processed_at < now() - interval '24 hours'
    `);
    await recordWebhookResult("ok");
    return NextResponse.json({ ok: true, counts: result.counts });
  } catch (error) {
    const message = error instanceof MediaSalamError ? error.message : "Synchronisation par webhook impossible.";
    await recordWebhookResult("error", message).catch(() => undefined);
    return NextResponse.json(
      { error: message },
      { status: error instanceof MediaSalamError ? error.status : 502 },
    );
  }
}
