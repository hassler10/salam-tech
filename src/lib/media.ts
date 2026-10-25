import { createHash } from "crypto";

export const MEDIA_KINDS = ["logo", "cover"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export const MEDIA_SETTING_BY_KIND: Record<MediaKind, string> = {
  logo: "library_logo",
  cover: "library_cover",
};

export const MEDIA_MAX_ENCODED_LENGTH: Record<MediaKind, number> = {
  logo: 2_500_000,
  cover: 5_500_000,
};

export function isMediaKind(value: unknown): value is MediaKind {
  return typeof value === "string" && (MEDIA_KINDS as readonly string[]).includes(value);
}

export function parseImageDataUrl(value: unknown): { mime: string; buffer: Buffer } | null {
  if (typeof value !== "string") return null;
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match) return null;
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length === 0) return null;
  return { mime: match[1], buffer };
}

export function mediaVersion(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}
