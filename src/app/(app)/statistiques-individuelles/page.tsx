import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { visitors, visits } from "@/db/schema";
import { sql } from "drizzle-orm";
import { getCurrentUser, can } from "@/lib/auth";
import { listSubscribers } from "@/lib/queries";
import { PageHeader } from "@/components/ui";
import IndividualSearch from "./IndividualSearch";

export const dynamic = "force-dynamic";

export default async function IndividuellesPage() {
  const user = await getCurrentUser();
  if (!can(user?.role, "stats.read")) redirect("/accueil");
  const subs = await listSubscribers();
  const vis = await db
    .select({
      id: visitors.id,
      code: visitors.code,
      lastName: visitors.lastName,
      firstName: visitors.firstName,
      visitCount: sql<number>`(select count(*)::int from ${visits} v where v.visitor_id = ${visitors.id})`,
      lastVisit: sql<string | null>`(select max(v.occurred_at)::text from ${visits} v where v.visitor_id = ${visitors.id})`,
    })
    .from(visitors);

  return (
    <div>
      <PageHeader
        title="Statistiques individuelles"
        subtitle="Recherchez une personne pour consulter sa fiche complète. Les statistiques individuelles ne sont produites que pour les personnes identifiées de manière fiable."
      >
        <Link href="/rapports" className="btn-ghost">Exporter</Link>
      </PageHeader>
      <IndividualSearch
        subs={subs.map((s) => ({
          id: s.id,
          code: s.code,
          name: `${s.lastName} ${s.firstName}`,
          visitCount: s.visitCount,
          lastVisit: s.lastVisit ? s.lastVisit.toISOString() : null,
          endDate: s.endDate,
          daysLeft: s.daysLeft,
          typeName: s.typeName,
        }))}
        visitors={vis.map((v) => ({
          id: v.id,
          code: v.code,
          name: `${v.lastName} ${v.firstName}`,
          visitCount: Number(v.visitCount),
          lastVisit: v.lastVisit,
        }))}
      />
    </div>
  );
}
