import { redirect } from "next/navigation";
import { getCurrentUser, can } from "@/lib/auth";
import { dashboardData } from "@/lib/queries";
import { PageHeader, StatCard, StatCardIcon } from "@/components/ui";
import ReportsClient from "./ReportsClient";

export const dynamic = "force-dynamic";

export default async function RapportsPage() {
  const user = await getCurrentUser();
  if (!can(user?.role, "reports.read")) redirect("/accueil");
  const d = await dashboardData();
  return (
    <div>
      <PageHeader
        title="Rapports et exportations"
        subtitle="Exports CSV/Excel et documents imprimables (PDF via l'impression du navigateur). Aucun rapport financier."
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Visites du jour" value={d.counts.today} icon={<StatCardIcon name="calendar" />} />
        <StatCard label="Visites de la semaine" value={d.counts.week} icon={<StatCardIcon name="history" />} tone="gold" />
        <StatCard label="Visites du mois" value={d.counts.month} icon={<StatCardIcon name="calendar" />} tone="slate" />
        <StatCard label="Visites de l'année" value={d.counts.year} icon={<StatCardIcon name="chart" />} tone="green" />
      </div>
      <div className="mt-6">
        <ReportsClient />
      </div>
    </div>
  );
}
