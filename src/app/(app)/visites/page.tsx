import { db } from "@/db";
import { visitPresence, visits } from "@/db/schema";
import { desc, inArray } from "drizzle-orm";
import { PageHeader } from "@/components/ui";
import VisitsClient from "./VisitsClient";
import { closeExpiredPresences, ensurePresenceSchema } from "@/lib/presence";

export const dynamic = "force-dynamic";

export default async function VisitesPage() {
  await ensurePresenceSchema();
  await closeExpiredPresences();
  const rows = await db.select().from(visits).orderBy(desc(visits.occurredAt)).limit(1000);
  const presenceRows = rows.length
    ? await db.select().from(visitPresence).where(inArray(visitPresence.visitId, rows.map((row) => row.id)))
    : [];
  const departureByVisit = new Map(presenceRows.map((row) => [row.visitId, row.departedAt]));
  const presenceVisitIds = new Set(presenceRows.map((row) => row.visitId));
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
          departedAt: departureByVisit.get(v.id)?.toISOString() ?? null,
          hasPresence: presenceVisitIds.has(v.id),
          agentName: v.agentName,
          syncStatus: v.syncStatus,
          subscriberId: v.subscriberId,
          visitorId: v.visitorId,
        }))}
      />
    </div>
  );
}
