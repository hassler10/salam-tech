import { notFound } from "next/navigation";
import { db } from "@/db";
import { subscriptionTypes } from "@/db/schema";
import { eq } from "drizzle-orm";
import QRCode from "qrcode";
import { getSubscriber } from "@/lib/queries";
import { getBranding } from "@/lib/branding";
import { PageHeader, StatCard, StatCardIcon, StatusBadge, ReportHeader } from "@/components/ui";
import SubscriberActions from "./SubscriberActions";

export const dynamic = "force-dynamic";

function countSince(dates: Date[], from: Date) {
  return dates.filter((d) => d >= from).length;
}

export default async function FicheAbonne({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getSubscriber(Number(id));
  if (!data) notFound();
  const [types, branding] = await Promise.all([
    db.select().from(subscriptionTypes).where(eq(subscriptionTypes.active, true)),
    getBranding(),
  ]);
  const s = data.subscriber;
  const dates = data.visits.map((v) => new Date(v.occurredAt));
  const now = new Date();
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const qr = await QRCode.toDataURL(`SALAM-LIBRARY:${s.code}:${s.lastName} ${s.firstName}`, {
    margin: 1,
    width: 220,
    color: { dark: "#14532d", light: "#ffffff" },
  });

  return (
    <div>
      <ReportHeader title={`Fiche abonné — ${s.lastName} ${s.firstName}`} />
      <PageHeader title={`${s.lastName} ${s.firstName}`} subtitle={`Identifiant ${s.code} — inscrit le ${s.registeredAt}`}>
        <StatusBadge status={data.computed} />
      </PageHeader>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Visites totales" value={data.visits.length} icon={<StatCardIcon name="book" />} />
            <StatCard label="Cette semaine" value={countSince(dates, weekStart)} icon={<StatCardIcon name="history" />} tone="gold" />
            <StatCard label="Ce mois" value={countSince(dates, monthStart)} icon={<StatCardIcon name="calendar" />} tone="slate" />
            <StatCard label="Cette année" value={countSince(dates, yearStart)} icon={<StatCardIcon name="chart" />} tone="green" />
          </div>

          <div className="card">
            <h3 className="mb-3 text-sm font-bold">Abonnement en cours</h3>
            {data.current ? (
              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <div><dt className="label">Type</dt><dd>{data.current.typeName}</dd></div>
                <div><dt className="label">Début</dt><dd>{data.current.startDate}</dd></div>
                <div><dt className="label">Durée</dt><dd>{data.current.durationMonths} mois</dd></div>
                <div><dt className="label">Expiration</dt><dd>{data.current.endDate}</dd></div>
                <div><dt className="label">Jours restants</dt><dd>{data.daysLeft} j</dd></div>
                <div><dt className="label">Statut</dt><dd><StatusBadge status={data.computed} /></dd></div>
              </dl>
            ) : (
              <p className="text-sm text-slate-500">Aucune période d&apos;abonnement enregistrée.</p>
            )}
          </div>

          <div className="card">
            <h3 className="mb-3 text-sm font-bold">Historique des périodes d&apos;abonnement</h3>
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Type</th><th>Début</th><th>Fin</th><th>Durée</th><th>Enregistré le</th></tr></thead>
                <tbody>
                  {data.periods.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-slate-500">Aucune période.</td></tr>}
                  {data.periods.map((p) => (
                    <tr key={p.id}>
                      <td>{p.typeName}</td><td>{p.startDate}</td><td>{p.endDate}</td>
                      <td>{p.durationMonths} mois</td>
                      <td>{new Date(p.createdAt).toLocaleDateString("fr-FR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h3 className="mb-3 text-sm font-bold">Historique des visites ({data.visits.length})</h3>
            <div className="table-wrap max-h-96 overflow-y-auto">
              <table className="data">
                <thead><tr><th>Date et heure</th><th>Motif</th><th>Agent</th><th>Synchronisation</th></tr></thead>
                <tbody>
                  {data.visits.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-slate-500">Aucune visite.</td></tr>}
                  {data.visits.map((v) => (
                    <tr key={v.id}>
                      <td>{new Date(v.occurredAt).toLocaleString("fr-FR")}</td>
                      <td>{v.reason ?? "—"}</td>
                      <td>{v.agentName ?? "—"}</td>
                      <td className="text-xs">{v.syncStatus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="card text-center">
            <h3 className="mb-3 text-sm font-bold">Carte d&apos;abonné</h3>
            <div className="rounded-2xl bg-gradient-to-br from-[#14532d] to-[#166534] p-4 text-left text-white">
              <p className="text-[11px] uppercase tracking-widest text-[#c5a253]">{branding.shortName}</p>
              <p className="mt-1 text-lg font-bold">{s.lastName} {s.firstName}</p>
              <p className="font-mono text-xs">{s.code}</p>
              <p className="mt-2 text-xs">Valide jusqu&apos;au {data.current?.endDate ?? "—"}</p>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR code abonné" className="mx-auto mt-3 h-40 w-40" />
          </div>

          <div className="card">
            <h3 className="mb-3 text-sm font-bold">Informations</h3>
            <dl className="space-y-2 text-sm">
              <div><dt className="label">Téléphone</dt><dd>{s.phone ?? "—"}</dd></div>
              <div><dt className="label">Courriel</dt><dd>{s.email ?? "—"}</dd></div>
              <div><dt className="label">Statut de la fiche</dt><dd>{s.status}</dd></div>
              <div><dt className="label">Dernière modification</dt><dd>{new Date(s.updatedAt).toLocaleString("fr-FR")}</dd></div>
            </dl>
          </div>

          <SubscriberActions
            subscriberId={s.id}
            types={types}
            subscriber={{ lastName: s.lastName, firstName: s.firstName, phone: s.phone ?? "", status: s.status }}
          />
        </div>
      </div>
    </div>
  );
}
