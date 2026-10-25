import { db } from "@/db";
import { visitReasons, visits } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import Link from "next/link";
import { Icon } from "@/components/icons";
import ReceptionClient from "./ReceptionClient";

export const dynamic = "force-dynamic";

export default async function AccueilPage() {
  const user = await getCurrentUser();
  const reasons = await db.select().from(visitReasons).where(eq(visitReasons.active, true));
  const recent = await db.select().from(visits).orderBy(desc(visits.occurredAt)).limit(10);
  return (
    <div>
      <PageHeader
        eyebrow="Poste de réception"
        title="Enregistrer une visite"
        subtitle={`Bonjour ${user?.fullName ?? ""}. Choisissez un membre ou un visiteur, puis validez son passage.`}
      >
        <Link href="/abonnes" className="btn-ghost h-10 text-[12px]">
          <Icon name="users" className="h-4 w-4" />
          Répertoire des membres
        </Link>
        <Link href="/visiteurs" className="btn-ghost h-10 text-[12px]">
          <Icon name="userPlus" className="h-4 w-4" />
          Répertoire des visiteurs
        </Link>
      </PageHeader>
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
