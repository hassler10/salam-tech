import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { visitReasons, visits } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getCurrentUser, can } from "@/lib/auth";
import { dashboardData } from "@/lib/queries";
import { PageHeader, StatCard, StatusBadge } from "@/components/ui";
import { DailyChart, MonthlyChart, YearlyChart, SplitPie, ReasonsChart, StatusChart } from "@/components/Charts";
import QuickRegister from "./QuickRegister";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!can(user?.role, "stats.read")) redirect("/accueil");
  const d = await dashboardData();
  const reasons = await db.select().from(visitReasons).where(eq(visitReasons.active, true));
  const recent = await db.select().from(visits).orderBy(desc(visits.occurredAt)).limit(10);

  const split = [
    { name: "Abonnés", value: d.daily.reduce((a, b) => a + Number(b.abonnes), 0) },
    { name: "Visiteurs", value: d.daily.reduce((a, b) => a + Number(b.visiteurs), 0) },
  ];
  const statusData = [
    { name: "Actifs", value: d.statusCounts.actif },
    { name: "Bientôt expirés", value: d.statusCounts.bientot },
    { name: "Expirés", value: d.statusCounts.expire },
    { name: "Sans abonnement", value: d.statusCounts.aucun },
  ];
  const alerts = d.subs
    .filter((s) => s.computed === "imminent" || s.computed === "bientot" || s.computed === "expire")
    .sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0))
    .slice(0, 8);

  return (
    <div>
      <PageHeader
        title="Tableau de bord"
        subtitle={`${user?.fullName} — poste d'enregistrement et pilotage réunis sur un seul écran.`}
      >
        <Link href="/rapports" className="btn-ghost">🧾 Rapports</Link>
        <Link href="/abonnes" className="btn-primary">👥 Abonnés</Link>
      </PageHeader>

      {/* Zone de travail : enregistrement à gauche, indicateurs à droite */}
      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-5">
        <div className="2xl:col-span-2">
          <div className="2xl:sticky 2xl:top-20">
            <QuickRegister
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
        </div>

        <div className="space-y-6 2xl:col-span-3">
          <div>
            <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-[#14532d] dark:text-[#c5a253]">
              Indicateurs de fréquentation
            </h2>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              <StatCard label="Visites aujourd'hui" value={d.counts.today} icon="📅" tone="green" />
              <StatCard label="Abonnés venus aujourd'hui" value={d.counts.todaySubscribers} icon="🎫" tone="green" />
              <StatCard label="Visiteurs reçus aujourd'hui" value={d.counts.todayVisitors} icon="🧍" tone="gold" />
              <StatCard label="Visites cette semaine" value={d.counts.week} icon="🗓️" tone="slate" />
              <StatCard label="Visites ce mois" value={d.counts.month} icon="📆" tone="slate" />
              <StatCard label="Visites cette année" value={d.counts.year} icon="📈" tone="gold" />
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-[#14532d] dark:text-[#c5a253]">
              État des abonnements
            </h2>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              <StatCard label="Total abonnés" value={d.statusCounts.total} icon="👥" href="/abonnes" />
              <StatCard label="Abonnements actifs" value={d.statusCounts.actif} icon="✅" tone="green" href="/abonnements" />
              <StatCard label="Bientôt expirés" value={d.statusCounts.bientot} icon="⏳" tone="amber" href="/abonnements" />
              <StatCard label="Abonnements expirés" value={d.statusCounts.expire} icon="⛔" tone="rose" href="/abonnements" />
              <StatCard label="Visiteurs enregistrés" value={d.totalVisitors} icon="🚶" tone="gold" href="/visiteurs" />
              <StatCard label="Sans abonnement actif" value={d.statusCounts.aucun} icon="❔" tone="slate" />
            </div>
          </div>

          <div className="card">
            <h3 className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">
              Alertes d&apos;expiration
            </h3>
            {alerts.length === 0 ? (
              <p className="text-sm text-slate-500">Aucune alerte d&apos;expiration à signaler.</p>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Abonné</th>
                      <th>Type</th>
                      <th>Expiration</th>
                      <th>Jours</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <Link className="font-semibold text-[#166534] hover:underline dark:text-[#c5a253]" href={`/abonnes/${s.id}`}>
                            {s.lastName} {s.firstName}
                          </Link>
                        </td>
                        <td>{s.typeName ?? "—"}</td>
                        <td>{s.endDate ?? "—"}</td>
                        <td>{s.daysLeft !== null ? `${s.daysLeft} j` : "—"}</td>
                        <td><StatusBadge status={s.computed} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Graphiques */}
      <h2 className="mb-3 mt-8 text-sm font-extrabold uppercase tracking-wide text-[#14532d] dark:text-[#c5a253]">
        Analyse graphique
      </h2>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <DailyChart data={d.daily} />
        <MonthlyChart data={d.monthly} />
        <YearlyChart data={d.yearly} />
        <SplitPie data={split} />
        <ReasonsChart data={d.reasons} />
        <StatusChart data={statusData} />
      </div>
    </div>
  );
}
