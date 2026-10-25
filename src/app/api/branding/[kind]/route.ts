import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { COVER_FALLBACK, LOGO_FALLBACK } from "@/lib/branding";
import {
  isMediaKind,
  MEDIA_SETTING_BY_KIND,
  mediaVersion,
  parseImageDataUrl,
} from "@/lib/media";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  if (!isMediaKind(kind)) {
    return NextResponse.json({ error: "Média introuvable." }, { status: 404 });
  }

  const fallback = kind === "logo" ? LOGO_FALLBACK : COVER_FALLBACK;
  let stored: string | undefined;
  try {
    const rows = await db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, MEDIA_SETTING_BY_KIND[kind]))
      .limit(1);
    stored = rows[0]?.value;
  } catch {
    stored = undefined;
  }

  if (!stored) {
    return NextResponse.redirect(new URL(fallback, req.url), 307);
  }

  const parsed = parseImageDataUrl(stored);
  if (!parsed) {
    return NextResponse.redirect(new URL(fallback, req.url), 307);
  }

  const version = mediaVersion(stored);
  const requestedVersion = new URL(req.url).searchParams.get("v");
  const cacheControl =
    requestedVersion === version
      ? "public, max-age=31536000, immutable"
      : "private, no-cache, max-age=0, must-revalidate";
  const etag = `"${version}"`;

  if (req.headers.get("if-none-match") === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: { ETag: etag, "Cache-Control": cacheControl },
    });
  }

  return new NextResponse(new Uint8Array(parsed.buffer), {
    headers: {
      "Content-Type": parsed.mime,
      "Content-Length": String(parsed.buffer.length),
      "Cache-Control": cacheControl,
      ETag: etag,
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
