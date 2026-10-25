import { db } from "@/db";
import { subscriptionTypes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { listSubscribers } from "@/lib/queries";
import { PageHeader } from "@/components/ui";
import SubscribersClient from "./SubscribersClient";

export const dynamic = "force-dynamic";

export default async function AbonnesPage() {
  const subs = await listSubscribers();
  const types = await db.select().from(subscriptionTypes).where(eq(subscriptionTypes.active, true));
  return (
    <div>
      <PageHeader
        title="Gestion des abonnés"
        subtitle="Fiches individuelles, recherche, filtres et renouvellements. Aucune donnée financière n'est collectée."
      />
      <SubscribersClient
        subs={subs.map((s) => ({ ...s, lastVisit: s.lastVisit ? s.lastVisit.toISOString() : null }))}
        types={types}
      />
    </div>
  );
}
