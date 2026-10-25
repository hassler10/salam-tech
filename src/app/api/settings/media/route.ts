import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { can, getCurrentUser, logAudit } from "@/lib/auth";
import { COVER_FALLBACK, LOGO_FALLBACK } from "@/lib/branding";
import {
  isMediaKind,
  MEDIA_MAX_ENCODED_LENGTH,
  MEDIA_SETTING_BY_KIND,
  mediaVersion,
  parseImageDataUrl,
  type MediaKind,
} from "@/lib/media";

const MAX_BODY_BYTES = 6_000_000;

function invalid(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

async function transform(kind: MediaKind, buffer: Buffer): Promise<{ dataUrl: string }> {
  const image = sharp(buffer, { limitInputPixels: 40_000_000, animated: false });
  const output =
    kind === "logo"
      ? await image
          .rotate()
          .resize(512, 512, {
            fit: "contain",
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          })
          .png({ compressionLevel: 9, adaptiveFiltering: true })
          .toBuffer()
      : await image
          .rotate()
          .resize(1920, 1400, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: 84, effort: 4 })
          .toBuffer();

  const mime = kind === "logo" ? "image/png" : "image/webp";
  const dataUrl = `data:${mime};base64,${output.toString("base64")}`;
  if (dataUrl.length > MEDIA_MAX_ENCODED_LENGTH[kind]) {
    throw new Error("MEDIA_TOO_LARGE");
  }
  return { dataUrl };
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!can(user?.role, "settings.write")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Image trop volumineuse." }, { status: 413 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return invalid("Requête invalide.");
  }
  const { kind, dataUrl } = body as { kind?: unknown; dataUrl?: unknown };
  if (!isMediaKind(kind)) return invalid("Type de média invalide.");
  if (typeof dataUrl !== "string" || dataUrl.length > MAX_BODY_BYTES) {
    return invalid("Image invalide ou trop volumineuse.");
  }

  const parsed = parseImageDataUrl(dataUrl);
  if (!parsed) return invalid("Format accepté : PNG, JPG ou WebP.");

  let stored: { dataUrl: string };
  try {
    stored = await transform(kind, parsed.buffer);
  } catch (error) {
    if (error instanceof Error && error.message === "MEDIA_TOO_LARGE") {
      return invalid("Image trop lourde après traitement. Choisissez un fichier plus léger.");
    }
    return invalid("Image illisible ou corrompue.");
  }

  const key = MEDIA_SETTING_BY_KIND[kind];
  await db
    .insert(settings)
    .values({ key, value: stored.dataUrl })
    .onConflictDoUpdate({ target: settings.key, set: { value: stored.dataUrl } });
  await logAudit(user, `modification ${kind === "logo" ? "du logo" : "de la couverture"}`, "paramètres", undefined, key);

  return NextResponse.json({
    ok: true,
    url: `/api/branding/${kind}?v=${mediaVersion(stored.dataUrl)}`,
  });
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!can(user?.role, "settings.write")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const kind = new URL(req.url).searchParams.get("kind");
  if (!isMediaKind(kind)) return invalid("Type de média invalide.");

  const key = MEDIA_SETTING_BY_KIND[kind];
  await db.delete(settings).where(eq(settings.key, key));
  await logAudit(user, `réinitialisation ${kind === "logo" ? "du logo" : "de la couverture"}`, "paramètres", undefined, key);

  return NextResponse.json({
    ok: true,
    url: kind === "logo" ? LOGO_FALLBACK : COVER_FALLBACK,
  });
}
