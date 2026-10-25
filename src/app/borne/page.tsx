import { db } from "@/db";
import { visitReasons } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureSeed, getSettingsMap } from "@/lib/seed";
import KioskClient from "./KioskClient";

export const dynamic = "force-dynamic";

export default async function BornePage() {
  await ensureSeed();
  const settings = await getSettingsMap();
  const enabled = (settings.self_service_enabled ?? "1") === "1";
  const reasons = await db.select().from(visitReasons).where(eq(visitReasons.active, true));

  return (
    <KioskClient
      enabled={enabled}
      reasons={reasons.map((r) => r.label)}
      libraryName={settings.library_name ?? "Bibliothèque de la Mosquée Salam du Plateau"}
      city={settings.library_city ?? "Abidjan, Côte d'Ivoire"}
    />
  );
}
