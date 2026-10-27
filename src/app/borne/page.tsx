import { db } from "@/db";
import { visitReasons } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureSeed } from "@/lib/seed";
import { getBranding } from "@/lib/branding";
import KioskClient from "./KioskClient";
import { getLibraryClock, isLibraryOpen } from "@/lib/library-hours";

export const dynamic = "force-dynamic";

export default async function BornePage() {
  await ensureSeed();
  const branding = await getBranding();
  const reasons = await db.select().from(visitReasons).where(eq(visitReasons.active, true));
  const clock = getLibraryClock();

  return (
    <KioskClient
      enabled={branding.selfServiceEnabled}
      openNow={isLibraryOpen()}
      initialTime={`${String(clock.hour).padStart(2, "0")}:${String(clock.minute).padStart(2, "0")}`}
      reasons={reasons.map((r) => r.label)}
      libraryName={branding.name}
      city={branding.city}
      logoUrl={branding.logoUrl}
      coverUrl={branding.coverUrl}
    />
  );
}
