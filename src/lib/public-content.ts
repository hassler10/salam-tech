import { getSettingsMap } from "./seed";
import { PUBLIC_DEFAULTS } from "./public-defaults";

export type PublicContent = {
  name: string;
  city: string;
  tagline: string;
  about: string;
  address: string;
  hours: string;
  phone: string;
  email: string;
  mapUrl: string;
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

export async function getPublicContent(): Promise<PublicContent> {
  const settings = await getSettingsMap();
  const read = (key: keyof typeof PUBLIC_DEFAULTS) =>
    settings[key]?.trim() || PUBLIC_DEFAULTS[key];

  const phone = read("library_phone");
  const email = read("library_email");
  const mapUrl = read("library_map_url");

  return {
    name: read("library_name"),
    city: read("library_city"),
    tagline: read("library_tagline"),
    about: read("library_about"),
    address: read("library_address"),
    hours: read("opening_hours"),
    phone: PHONE_RE.test(phone) ? phone : "",
    email: EMAIL_RE.test(email) ? email : "",
    mapUrl: isHttpUrl(mapUrl) ? mapUrl : "",
    selfServiceEnabled: (settings.self_service_enabled ?? "1") === "1",
  };
}
