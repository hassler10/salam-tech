import { db } from "@/db";
import { visits } from "@/db/schema";
import { desc } from "drizzle-orm";
import { PageHeader } from "@/components/ui";
import VisitsClient from "./VisitsClient";

export const dynamic = "force-dynamic";

export default async function VisitesPage() {
  const rows = await db.select().from(visits).orderBy(desc(visits.occurredAt)).limit(1000);
  return (
    <div>
      <PageHeader title="Historique des visites" subtitle="Journal complet des enregistrements de fréquentation." />
      <VisitsClient
        rows={rows.map((v) => ({
          id: v.id,
          uid: v.uid,
          personType: v.personType,
          displayName: v.displayName,
          reason: v.reason,
          occurredAt: v.occurredAt.toISOString(),
          agentName: v.agentName,
          syncStatus: v.syncStatus,
          subscriberId: v.subscriberId,
          visitorId: v.visitorId,
        }))}
      />
    </div>
  );
}
