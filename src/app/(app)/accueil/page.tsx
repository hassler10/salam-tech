import { db } from "@/db";
import { visitReasons, visits } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import ReceptionClient from "./ReceptionClient";

export const dynamic = "force-dynamic";

export default async function AccueilPage() {
  const user = await getCurrentUser();
  const reasons = await db.select().from(visitReasons).where(eq(visitReasons.active, true));
  const recent = await db.select().from(visits).orderBy(desc(visits.occurredAt)).limit(10);
  return (
    <div>
      <PageHeader
        title="Accueil et fréquentation"
        subtitle={`Agent connecté : ${user?.fullName ?? "—"} — enregistrement en quelques secondes.`}
      />
      <ReceptionClient
        reasons={reasons.map((r) => r.label)}
        recent={recent.map((v) => ({
          id: v.id,
          displayName: v.displayName,
          personType: v.personType,
          reason: v.reason,
          occurredAt: v.occurredAt.toISOString(),
          agentName: v.agentName,
          syncStatus: v.syncStatus,
        }))}
      />
    </div>
  );
}
