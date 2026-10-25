import Link from "next/link";
import { listSubscribers } from "@/lib/queries";
import { getThresholds } from "@/lib/seed";
import { PageHeader, StatCard, StatCardIcon, StatusBadge, ReportHeader } from "@/components/ui";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

export default async function SuiviAbonnements() {
  const subs = await listSubscribers();
  const th = await getThresholds();
  const groups = [
    { key: "imminent", title: `Expiration imminente (≤ ${th.imminent} jours)`, items: subs.filter((s) => s.computed === "imminent") },
    { key: "bientot", title: `Expiration proche (≤ ${th.soon} jours)`, items: subs.filter((s) => s.computed === "bientot") },
    { key: "expire", title: "Abonnements expirés", items: subs.filter((s) => s.computed === "expire") },
    { key: "actif", title: "Abonnements actifs", items: subs.filter((s) => s.computed === "actif") },
    { key: "aucun", title: "Sans période d'abonnement", items: subs.filter((s) => s.computed === "aucun" || s.computed === "suspendu") },
  ];

  return (
    <div>
      <ReportHeader title="Suivi des abonnements" />
      <PageHeader
        title="Suivi des abonnements"
        subtitle={`Seuils d'alerte configurés : ${th.soon} jours (proche) et ${th.imminent} jours (imminent). Aucune information financière n'est traitée.`}
      >
        <PrintButton />
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Actifs" value={groups[3].items.length} icon={<StatCardIcon name="check" />} />
        <StatCard label="Expiration proche" value={groups[1].items.length} icon={<StatCardIcon name="clock" />} tone="amber" />
        <StatCard label="Expiration imminente" value={groups[0].items.length} icon={<StatCardIcon name="clock" />} tone="gold" />
        <StatCard label="Expirés" value={groups[2].items.length} icon={<StatCardIcon name="alert" />} tone="rose" />
      </div>

      <div className="mt-6 space-y-6">
        {groups.map((g) => (
          <div key={g.key}>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
              {g.title} — {g.items.length}
            </h2>
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Identifiant</th><th>Abonné</th><th>Type</th><th>Début</th><th>Durée</th><th>Expiration</th><th>Jours restants</th><th>Statut</th></tr></thead>
                <tbody>
                  {g.items.length === 0 && <tr><td colSpan={8} className="py-5 text-center text-slate-500">Aucun abonné dans cette catégorie.</td></tr>}
                  {g.items.map((s) => (
                    <tr key={s.id}>
                      <td className="font-mono text-xs">{s.code}</td>
                      <td><Link href={`/abonnes/${s.id}`} className="font-semibold text-[#166534] hover:underline dark:text-[#c5a253]">{s.lastName} {s.firstName}</Link></td>
                      <td>{s.typeName ?? "—"}</td>
                      <td>{s.startDate ?? "—"}</td>
                      <td>{s.durationMonths ? `${s.durationMonths} mois` : "—"}</td>
                      <td>{s.endDate ?? "—"}</td>
                      <td>{s.daysLeft !== null ? `${s.daysLeft} j` : "—"}</td>
                      <td><StatusBadge status={s.computed} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
