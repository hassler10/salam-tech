import { db } from "@/db";
import { visits } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { PageHeader } from "@/components/ui";
import SyncClient from "./SyncClient";

export const dynamic = "force-dynamic";

export default async function SyncPage() {
  const differed = await db
    .select()
    .from(visits)
    .where(eq(visits.syncStatus, "synchronise_differe"))
    .orderBy(desc(visits.occurredAt))
    .limit(50);
  return (
    <div>
      <PageHeader
        title="Centre de synchronisation"
        subtitle="File d'attente locale (IndexedDB), état de la connexion et visites synchronisées en différé."
      />
      <SyncClient
        differed={differed.map((v) => ({
          id: v.id,
          displayName: v.displayName,
          occurredAt: v.occurredAt.toISOString(),
          createdAt: v.createdAt.toISOString(),
          agentName: v.agentName,
        }))}
      />
    </div>
  );
}
