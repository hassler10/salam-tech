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

export async function getPublicContent(): Promise<PublicContent> {
  const settings = await getSettingsMap();
  const read = (key: keyof typeof PUBLIC_DEFAULTS) =>
    settings[key]?.trim() || PUBLIC_DEFAULTS[key];

  return {
    name: read("library_name"),
    city: read("library_city"),
    tagline: read("library_tagline"),
    about: read("library_about"),
    address: read("library_address"),
    hours: read("opening_hours"),
    phone: read("library_phone"),
    email: read("library_email"),
    mapUrl: read("library_map_url"),
    selfServiceEnabled: (settings.self_service_enabled ?? "1") === "1",
  };
}
