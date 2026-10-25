import { notFound } from "next/navigation";
import { getVisitorDetail } from "@/lib/queries";
import { PageHeader, StatCard, ReportHeader } from "@/components/ui";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

export default async function FicheVisiteur({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getVisitorDetail(Number(id));
  if (!data) notFound();
  const v = data.visitor;
  const dates = data.visits.map((x) => new Date(x.occurredAt));
  const now = new Date();
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const since = (f: Date) => dates.filter((d) => d >= f).length;
  const reasons = new Map<string, number>();
  for (const x of data.visits) reasons.set(x.reason || "Non précisé", (reasons.get(x.reason || "Non précisé") ?? 0) + 1);

  return (
    <div>
      <ReportHeader title={`Fiche visiteur — ${v.lastName} ${v.firstName}`} />
      <PageHeader title={`${v.lastName} ${v.firstName}`} subtitle={`Identifiant ${v.code} — fiche créée le ${new Date(v.createdAt).toLocaleDateString("fr-FR")}`}>
        <PrintButton />
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Visites totales" value={data.visits.length} icon="📚" />
        <StatCard label="Cette semaine" value={since(weekStart)} icon="🗓️" tone="gold" />
        <StatCard label="Ce mois" value={since(monthStart)} icon="📆" tone="slate" />
        <StatCard label="Cette année" value={since(yearStart)} icon="📈" tone="green" />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="card">
          <h3 className="mb-3 text-sm font-bold">Informations</h3>
          <dl className="space-y-2 text-sm">
            <div><dt className="label">Contact</dt><dd>{v.phone ?? "—"}</dd></div>
            <div><dt className="label">Organisme</dt><dd>{v.organization ?? "—"}</dd></div>
            <div><dt className="label">Dernière visite</dt><dd>{dates[0] ? dates[0].toLocaleString("fr-FR") : "—"}</dd></div>
          </dl>
          <h3 className="mb-2 mt-4 text-sm font-bold">Motifs de visite</h3>
          <ul className="space-y-1 text-sm">
            {[...reasons.entries()].map(([k, n]) => (
              <li key={k} className="flex justify-between rounded-lg bg-slate-50 px-3 py-1.5 dark:bg-slate-800">
                <span>{k}</span><span className="font-semibold">{n}</span>
              </li>
            ))}
            {reasons.size === 0 && <li className="text-slate-500">Aucune visite.</li>}
          </ul>
        </div>

        <div className="lg:col-span-2">
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Date et heure</th><th>Motif</th><th>Agent</th></tr></thead>
              <tbody>
                {data.visits.length === 0 && <tr><td colSpan={3} className="py-6 text-center text-slate-500">Aucune visite.</td></tr>}
                {data.visits.map((x) => (
                  <tr key={x.id}>
                    <td>{new Date(x.occurredAt).toLocaleString("fr-FR")}</td>
                    <td>{x.reason ?? "—"}</td>
                    <td>{x.agentName ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
