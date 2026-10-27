import { redirect } from "next/navigation";
import { db } from "@/db";
import { visitReasons } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { ensureSeed } from "@/lib/seed";
import { getBranding } from "@/lib/branding";
import { getLibraryClock, isLibraryOpen } from "@/lib/library-hours";
import { hasSelfServiceGateSession, isSelfServiceGateConfigured } from "@/lib/self-service-gate";
import GateClient from "./GateClient";
import KioskClient from "./KioskClient";

export const dynamic = "force-dynamic";

export default async function BornePage() {
  await ensureSeed();
  const user = await getCurrentUser();
  if (user) redirect("/accueil");

  const branding = await getBranding();
  const gateOpen = await hasSelfServiceGateSession();
  if (!gateOpen) {
    return (
      <GateClient
        configured={isSelfServiceGateConfigured()}
        libraryName={branding.name}
        city={branding.city}
        logoUrl={branding.logoUrl}
      />
    );
  }

  const reasons = await db.select().from(visitReasons).where(eq(visitReasons.active, true));
  const clock = getLibraryClock();

  return (
    <KioskClient
      enabled
      openNow={isLibraryOpen()}
      initialTime={`${String(clock.hour).padStart(2, "0")}:${String(clock.minute).padStart(2, "0")}`}
      reasons={reasons.map((reason) => reason.label)}
      libraryName={branding.name}
      city={branding.city}
      logoUrl={branding.logoUrl}
      coverUrl={branding.coverUrl}
    />
  );
}
