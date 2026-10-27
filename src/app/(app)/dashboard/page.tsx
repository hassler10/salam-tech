import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { visitReasons, visits } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getCurrentUser, can } from "@/lib/auth";
import { dashboardData } from "@/lib/queries";
import { SectionHeading, StatCard, StatusBadge } from "@/components/ui";
import { Icon, type IconName } from "@/components/icons";
import { DailyChart, MonthlyChart, YearlyChart, SplitPie, ReasonsChart, StatusChart } from "@/components/Charts";
import QuickRegister from "./QuickRegister";

export const dynamic = "force-dynamic";

const kpiIcon = (name: IconName) => <Icon name={name} className="h-[18px] w-[18px]" />;

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

  const firstName = user?.fullName.split(/\s+/)[0] ?? "";
  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const dateLabel = today.charAt(0).toUpperCase() + today.slice(1);

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-brand-800 via-brand-900 to-brand-950 p-6 text-white shadow-lift sm:p-8">
        <div className="pointer-events-none absolute inset-0 pattern-grid opacity-30" />
        <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-gold-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-brand-400/10 blur-3xl" />

        <div className="relative flex flex-wrap items-end justify-between gap-7">
          <div className="min-w-0">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.24em] text-gold-300">
              Tableau de bord · {dateLabel}
            </p>
            <h1 className="mt-2 font-display text-[30px] font-semibold leading-tight tracking-tight sm:text-[36px]">
              Salam, {firstName}
            </h1>
            <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-white/60">
              Toute la vie de la bibliothèque en un regard. Enregistrez une visite ou suivez la
              fréquentation sans quitter cet écran.
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Link href="/accueil" className="btn-gold text-[12.5px]">
                <Icon name="bell" className="h-4 w-4" />
                Enregistrer une visite
              </Link>
              <Link
                href="/abonnes"
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-[12.5px] font-semibold text-white backdrop-blur transition hover:bg-white/[0.12]"
              >
                <Icon name="users" className="h-4 w-4" />
                Gérer les abonnés
              </Link>
              {user?.role === "admin" && (
                <Link
                  href="/parametres#data-reset"
                  className="inline-flex items-center gap-2 rounded-xl border border-rose-200/30 bg-rose-500/10 px-4 py-2.5 text-[12.5px] font-semibold text-rose-50 backdrop-blur transition hover:bg-rose-500/20"
                >
                  <Icon name="refresh" className="h-4 w-4" />
                  Nettoyer les données de test
                </Link>
              )}
            </div>
          </div>

          <div className="grid w-full max-w-sm grid-cols-3 gap-2.5">
            {[
              { label: "Visites du jour", value: d.counts.today },
              { label: "Abonnements actifs", value: d.statusCounts.actif },
              { label: "Alertes", value: alerts.length },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-white/10 bg-white/[0.055] px-3.5 py-3 backdrop-blur-sm"
              >
                <p className="text-[9px] font-semibold uppercase leading-tight tracking-[0.12em] text-white/45">
                  {s.label}
                </p>
                <p className="mt-1.5 font-display text-[26px] font-semibold leading-none">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-5">
        <div className="2xl:col-span-2">
          <div className="2xl:sticky 2xl:top-24">
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

        <div className="space-y-8 2xl:col-span-3">
          <section>
            <SectionHeading
              eyebrow="Aujourd'hui"
              title="Fréquentation"
              action={
                <Link
                  href="/statistiques"
                  className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-brand-700 transition hover:text-brand-900 dark:text-gold-300 dark:hover:text-gold-200"
                >
                  Voir l&apos;analyse
                  <Icon name="arrowRight" className="h-3.5 w-3.5" />
                </Link>
              }
            />
            <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-3">
              <StatCard label="Visites aujourd'hui" value={d.counts.today} icon={kpiIcon("calendar")} />
              <StatCard label="Abonnés venus" value={d.counts.todaySubscribers} icon={kpiIcon("ticket")} />
              <StatCard label="Visiteurs reçus" value={d.counts.todayVisitors} icon={kpiIcon("userPlus")} tone="gold" />
              <StatCard label="Cette semaine" value={d.counts.week} icon={kpiIcon("history")} tone="slate" />
              <StatCard label="Ce mois" value={d.counts.month} icon={kpiIcon("calendar")} tone="slate" />
              <StatCard label="Cette année" value={d.counts.year} icon={kpiIcon("chart")} tone="gold" />
            </div>
          </section>

          <section>
            <SectionHeading eyebrow="Communauté" title="État des abonnements" />
            <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-3">
              <StatCard label="Total abonnés" value={d.statusCounts.total} icon={kpiIcon("users")} href="/abonnes" />
              <StatCard label="Abonnements actifs" value={d.statusCounts.actif} icon={kpiIcon("check")} tone="green" href="/abonnements" />
              <StatCard label="Bientôt expirés" value={d.statusCounts.bientot} icon={kpiIcon("clock")} tone="amber" href="/abonnements" />
              <StatCard label="Abonnements expirés" value={d.statusCounts.expire} icon={kpiIcon("alert")} tone="rose" href="/abonnements" />
              <StatCard label="Visiteurs enregistrés" value={d.totalVisitors} icon={kpiIcon("userPlus")} tone="gold" href="/visiteurs" />
              <StatCard label="Sans abonnement actif" value={d.statusCounts.aucun} icon={kpiIcon("sparkles")} tone="slate" />
            </div>
          </section>

          <section className="card overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-4 pt-5">
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-300">
                  <Icon name="alert" className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="font-display text-[14px] font-semibold text-slate-800 dark:text-slate-100">
                    Alertes d&apos;expiration
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Abonnements à renouveler en priorité
                  </p>
                </div>
              </div>
              <Link
                href="/abonnements"
                className="text-[11px] font-semibold text-brand-700 hover:underline dark:text-gold-300"
              >
                Tout voir
              </Link>
            </div>
            {alerts.length === 0 ? (
              <p className="px-5 pb-6 text-sm text-slate-500 dark:text-slate-400">
                Aucune alerte d&apos;expiration à signaler.
              </p>
            ) : (
              <div className="overflow-x-auto">
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
                          <Link
                            className="font-semibold text-brand-700 hover:underline dark:text-gold-300"
                            href={`/abonnes/${s.id}`}
                          >
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
          </section>
        </div>
      </div>

      <section>
        <SectionHeading
          eyebrow="Analyse"
          title="Graphiques de fréquentation"
          action={
            <Link href="/rapports" className="btn-ghost px-3 py-1.5 text-[11.5px]">
              <Icon name="file" className="h-3.5 w-3.5" />
              Rapports
            </Link>
          }
        />
        <p className="-mt-2 mb-4 text-xs text-slate-500 dark:text-slate-400">
          Chaque graphique est accompagné d&apos;une interprétation automatique pour mettre en évidence les tendances et les chiffres importants.
        </p>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <DailyChart data={d.daily} />
          <MonthlyChart data={d.monthly} />
          <YearlyChart data={d.yearly} />
          <SplitPie data={split} />
          <ReasonsChart data={d.reasons} />
          <StatusChart data={statusData} />
        </div>
      </section>
    </div>
  );
}
