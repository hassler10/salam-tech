import { redirect } from "next/navigation";
import { getCurrentUser, can } from "@/lib/auth";
import { dashboardData } from "@/lib/queries";
import { PageHeader, StatCard, StatCardIcon, ReportHeader } from "@/components/ui";
import PrintButton from "@/components/PrintButton";
import { DailyChart, MonthlyChart, YearlyChart, SplitPie, ReasonsChart, StatusChart } from "@/components/Charts";

export const dynamic = "force-dynamic";

export default async function StatistiquesPage() {
  const user = await getCurrentUser();
  if (!can(user?.role, "stats.read")) redirect("/accueil");
  const d = await dashboardData();
  const split = [
    { name: "Abonnés", value: d.counts.todaySubscribers },
    { name: "Visiteurs", value: d.counts.todayVisitors },
  ];
  return (
    <div>
      <ReportHeader title="Statistiques générales de fréquentation" />
      <PageHeader title="Statistiques générales" subtitle="Les encadrés sous les graphiques résument automatiquement les tendances, les pics et les répartitions affichés.">
        <PrintButton />
      </PageHeader>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Visites aujourd'hui" value={d.counts.today} icon={<StatCardIcon name="calendar" />} />
        <StatCard label="Visites cette semaine" value={d.counts.week} icon={<StatCardIcon name="history" />} tone="gold" />
        <StatCard label="Visites ce mois" value={d.counts.month} icon={<StatCardIcon name="calendar" />} tone="slate" />
        <StatCard label="Visites cette année" value={d.counts.year} icon={<StatCardIcon name="chart" />} tone="green" />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <DailyChart data={d.daily} />
        <MonthlyChart data={d.monthly} />
        <YearlyChart data={d.yearly} />
        <SplitPie data={split} />
        <ReasonsChart data={d.reasons} />
        <StatusChart
          data={[
            { name: "Actifs", value: d.statusCounts.actif },
            { name: "Bientôt expirés", value: d.statusCounts.bientot },
            { name: "Expirés", value: d.statusCounts.expire },
          ]}
        />
      </div>
      <p className="mt-4 text-xs text-slate-500">
        Rappel méthodologique : le nombre de visites est distinct du nombre de personnes uniques
        ({d.statusCounts.total} abonnés et {d.totalVisitors} visiteurs identifiés).
      </p>
    </div>
  );
}
