import { db } from "@/db";
import { subscribers, subscriptionPeriods, visits, visitors } from "@/db/schema";
import { sql, eq, desc, and, gte, lte } from "drizzle-orm";
import { computeStatus, daysLeft, type SubStatus } from "./subscriptions";
import { getThresholds } from "./seed";

export type SubscriberRow = {
  id: number;
  code: string;
  lastName: string;
  firstName: string;
  phone: string | null;
  registeredAt: string;
  status: string;
  typeName: string | null;
  startDate: string | null;
  endDate: string | null;
  durationMonths: number | null;
  visitCount: number;
  lastVisit: Date | null;
  computed: SubStatus;
  daysLeft: number | null;
};

export async function listSubscribers(): Promise<SubscriberRow[]> {
  const th = await getThresholds();
  const rows = await db.execute(sql`
    select s.id, s.code, s.last_name, s.first_name, s.phone, s.registered_at, s.status,
      p.type_name, p.start_date, p.end_date, p.duration_months,
      coalesce(v.cnt, 0) as visit_count, v.last_visit
    from subscribers s
    left join lateral (
      select type_name, start_date, end_date, duration_months
      from subscription_periods sp where sp.subscriber_id = s.id
      order by end_date desc limit 1
    ) p on true
    left join lateral (
      select count(*)::int as cnt, max(occurred_at) as last_visit
      from visits vi where vi.subscriber_id = s.id
    ) v on true
    order by s.last_name asc, s.first_name asc
  `);
  return (rows.rows as Record<string, unknown>[]).map((r) => {
    const endDate = r.end_date ? String(r.end_date).slice(0, 10) : null;
    return {
      id: Number(r.id),
      code: String(r.code),
      lastName: String(r.last_name),
      firstName: String(r.first_name),
      phone: (r.phone as string) ?? null,
      registeredAt: String(r.registered_at).slice(0, 10),
      status: String(r.status),
      typeName: (r.type_name as string) ?? null,
      startDate: r.start_date ? String(r.start_date).slice(0, 10) : null,
      endDate,
      durationMonths: r.duration_months ? Number(r.duration_months) : null,
      visitCount: Number(r.visit_count ?? 0),
      lastVisit: r.last_visit ? new Date(String(r.last_visit)) : null,
      computed: computeStatus(endDate, th, String(r.status)),
      daysLeft: daysLeft(endDate),
    };
  });
}

export async function getSubscriber(id: number) {
  const rows = await db.select().from(subscribers).where(eq(subscribers.id, id)).limit(1);
  if (!rows[0]) return null;
  const periods = await db
    .select()
    .from(subscriptionPeriods)
    .where(eq(subscriptionPeriods.subscriberId, id))
    .orderBy(desc(subscriptionPeriods.endDate));
  const vs = await db
    .select()
    .from(visits)
    .where(eq(visits.subscriberId, id))
    .orderBy(desc(visits.occurredAt))
    .limit(500);
  const th = await getThresholds();
  const current = periods[0] ?? null;
  return {
    subscriber: rows[0],
    periods,
    visits: vs,
    current,
    computed: computeStatus(current?.endDate ?? null, th, rows[0].status),
    daysLeft: daysLeft(current?.endDate ?? null),
  };
}

export async function getVisitorDetail(id: number) {
  const rows = await db.select().from(visitors).where(eq(visitors.id, id)).limit(1);
  if (!rows[0]) return null;
  const vs = await db
    .select()
    .from(visits)
    .where(eq(visits.visitorId, id))
    .orderBy(desc(visits.occurredAt))
    .limit(500);
  return { visitor: rows[0], visits: vs };
}

function startOfDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export async function periodCounts() {
  const now = new Date();
  const day = startOfDay(now);
  const week = startOfDay(new Date(now.getTime() - ((now.getDay() + 6) % 7) * 86400000));
  const month = new Date(now.getFullYear(), now.getMonth(), 1);
  const year = new Date(now.getFullYear(), 0, 1);
  const count = async (from: Date, type?: string) => {
    const conds = [gte(visits.occurredAt, from)];
    if (type) conds.push(eq(visits.personType, type));
    const r = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(visits)
      .where(and(...conds));
    return r[0]?.c ?? 0;
  };
  return {
    today: await count(day),
    week: await count(week),
    month: await count(month),
    year: await count(year),
    todaySubscribers: await count(day, "abonne"),
    todayVisitors: await count(day, "visiteur"),
  };
}

export async function dashboardData() {
  const subs = await listSubscribers();
  const counts = await periodCounts();
  const totalVisitors = (
    await db.select({ c: sql<number>`count(*)::int` }).from(visitors)
  )[0]?.c ?? 0;

  const daily = await db.execute(sql`
    select to_char(occurred_at::date,'YYYY-MM-DD') as d,
      count(*) filter (where person_type='abonne')::int as abonnes,
      count(*) filter (where person_type='visiteur')::int as visiteurs
    from visits where occurred_at >= now() - interval '29 days'
    group by 1 order by 1
  `);
  const monthly = await db.execute(sql`
    select to_char(date_trunc('month', occurred_at),'YYYY-MM') as m, count(*)::int as total
    from visits where occurred_at >= now() - interval '11 months'
    group by 1 order by 1
  `);
  const yearly = await db.execute(sql`
    select to_char(date_trunc('year', occurred_at),'YYYY') as y, count(*)::int as total
    from visits group by 1 order by 1
  `);
  const reasons = await db.execute(sql`
    select coalesce(nullif(reason,''),'Non précisé') as reason, count(*)::int as total
    from visits group by 1 order by 2 desc limit 8
  `);

  return {
    subs,
    counts,
    totalVisitors,
    daily: daily.rows as unknown as { d: string; abonnes: number; visiteurs: number }[],
    monthly: monthly.rows as unknown as { m: string; total: number }[],
    yearly: yearly.rows as unknown as { y: string; total: number }[],
    reasons: reasons.rows as unknown as { reason: string; total: number }[],
    statusCounts: {
      total: subs.length,
      actif: subs.filter((s) => s.computed === "actif").length,
      bientot: subs.filter((s) => s.computed === "bientot" || s.computed === "imminent").length,
      expire: subs.filter((s) => s.computed === "expire").length,
      aucun: subs.filter((s) => s.computed === "aucun").length,
    },
  };
}

export async function visitsBetween(from: Date, to: Date, personType?: string) {
  const conds = [gte(visits.occurredAt, from), lte(visits.occurredAt, to)];
  if (personType) conds.push(eq(visits.personType, personType));
  return db.select().from(visits).where(and(...conds)).orderBy(desc(visits.occurredAt));
}
