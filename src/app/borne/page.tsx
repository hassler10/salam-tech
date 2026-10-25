import { db } from "@/db";
import { visitReasons } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureSeed } from "@/lib/seed";
import { getBranding } from "@/lib/branding";
import KioskClient from "./KioskClient";

export const dynamic = "force-dynamic";

export default async function BornePage() {
  await ensureSeed();
  const branding = await getBranding();
  const reasons = await db.select().from(visitReasons).where(eq(visitReasons.active, true));

  return (
    <KioskClient
      enabled={branding.selfServiceEnabled}
      reasons={reasons.map((r) => r.label)}
      libraryName={branding.name}
      city={branding.city}
      logoUrl={branding.logoUrl}
      coverUrl={branding.coverUrl}
    />
  );
}
