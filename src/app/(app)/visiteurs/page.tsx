import Link from "next/link";
import { db } from "@/db";
import { visitors, visits } from "@/db/schema";
import { sql } from "drizzle-orm";
import { PageHeader } from "@/components/ui";
import VisitorsClient from "./VisitorsClient";

export const dynamic = "force-dynamic";

export default async function VisiteursPage() {
  const rows = await db
    .select({
      id: visitors.id,
      code: visitors.code,
      lastName: visitors.lastName,
      firstName: visitors.firstName,
      phone: visitors.phone,
      organization: visitors.organization,
      createdAt: visitors.createdAt,
      visitCount: sql<number>`(select count(*)::int from ${visits} v where v.visitor_id = ${visitors.id})`,
      lastVisit: sql<string | null>`(select max(v.occurred_at)::text from ${visits} v where v.visitor_id = ${visitors.id})`,
    })
    .from(visitors)
    .orderBy(visitors.lastName);

  const anonymous = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(visits)
    .where(sql`person_type = 'visiteur' and visitor_id is null`);

  return (
    <div>
      <PageHeader
        title="Gestion des visiteurs"
        subtitle={`Visiteurs occasionnels identifiés. ${anonymous[0]?.c ?? 0} visite(s) ponctuelle(s) enregistrée(s) sans fiche permanente.`}
      >
        <Link href="/accueil" className="btn-primary">+ Enregistrer une visite</Link>
      </PageHeader>
      <VisitorsClient
        rows={rows.map((r) => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
