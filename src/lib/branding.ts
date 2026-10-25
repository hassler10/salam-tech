import { cache } from "react";
import { PUBLIC_DEFAULTS } from "./public-defaults";
import { getMediaSettings, getSettingsMap } from "./seed";
import { mediaVersion } from "./media";

export const LOGO_FALLBACK = "/logo.png";
export const COVER_FALLBACK = "/bibliotheque-salam.jpg";

export type Branding = {
  name: string;
  shortName: string;
  org: string;
  city: string;
  tagline: string;
  heroIntro: string;
  about: string;
  address: string;
  hours: string;
  phone: string;
  email: string;
  mapUrl: string;
  logoUrl: string;
  coverUrl: string;
  selfServiceEnabled: boolean;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[0-9+().\s-]{0,40}$/;

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function assetUrl(base: string, value: string | undefined, fallback: string): string {
  if (!value?.startsWith("data:image/")) return fallback;
  return `${base}?v=${mediaVersion(value)}`;
}

export async function loadBranding(): Promise<Branding> {
  const [text, media] = await Promise.all([getSettingsMap(), getMediaSettings()]);
  const read = (key: keyof typeof PUBLIC_DEFAULTS) =>
    text[key]?.trim() || PUBLIC_DEFAULTS[key];

  const phone = read("library_phone");
  const email = read("library_email");
  const mapUrl = read("library_map_url");

  return {
    name: read("library_name"),
    shortName: read("library_short_name"),
    org: read("library_subtitle"),
    city: read("library_city"),
    tagline: read("library_tagline"),
    heroIntro: read("library_hero_intro"),
    about: read("library_about"),
    address: read("library_address"),
    hours: read("opening_hours"),
    phone: PHONE_RE.test(phone) ? phone : "",
    email: EMAIL_RE.test(email) ? email : "",
    mapUrl: isHttpUrl(mapUrl) ? mapUrl : "",
    logoUrl: assetUrl("/api/branding/logo", media.library_logo, LOGO_FALLBACK),
    coverUrl: assetUrl("/api/branding/cover", media.library_cover, COVER_FALLBACK),
    selfServiceEnabled: (text.self_service_enabled ?? "1") === "1",
  };
}

export const getBranding = cache(loadBranding);
