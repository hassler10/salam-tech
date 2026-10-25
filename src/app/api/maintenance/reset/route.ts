import { NextResponse } from "next/server";
import { db } from "@/db";
import { subscribers, visitors, visits, subscriptionPeriods } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getCurrentUser, can, logAudit } from "@/lib/auth";

type PersonType = "abonne" | "visiteur";
type Scope = "visits" | "subscription" | "contact" | "record";

const SCOPE_LABELS: Record<Scope, string> = {
  visits: "historique des visites",
  subscription: "abonnement",
  contact: "coordonnées",
  record: "fiche complète",
};

function scopesFor(type: PersonType): Scope[] {
  return type === "abonne"
    ? ["visits", "subscription", "contact", "record"]
    : ["visits", "contact", "record"];
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!can(user?.role, "settings.write")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  if (type !== "abonne" && type !== "visiteur") {
    return NextResponse.json({ error: "Type de fiche invalide." }, { status: 400 });
  }
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) {
    return NextResponse.json({ error: "Saisissez au moins 2 caractères." }, { status: 400 });
  }
  const like = `%${q}%`;

  if (type === "abonne") {
    const rows = await db.execute(sql`
      select s.id, s.code, s.last_name, s.first_name, s.phone, s.status, s.source,
        (select count(*)::int from visits v where v.subscriber_id = s.id) as visit_count,
        (select count(*)::int from subscription_periods p where p.subscriber_id = s.id) as period_count,
        (select max(p.end_date)::text from subscription_periods p where p.subscriber_id = s.id) as end_date
      from subscribers s
      where s.code ilike ${like}
        or coalesce(s.card_number, '') ilike ${like}
        or s.last_name ilike ${like}
        or s.first_name ilike ${like}
        or coalesce(s.phone, '') ilike ${like}
      order by s.last_name asc, s.first_name asc
      limit 20
    `);
    return NextResponse.json({
      data: (rows.rows as Record<string, unknown>[]).map((r) => ({
        id: Number(r.id),
        code: String(r.code),
        lastName: String(r.last_name),
        firstName: String(r.first_name),
        phone: r.phone ? String(r.phone) : null,
        status: String(r.status),
        source: String(r.source),
        visitCount: Number(r.visit_count ?? 0),
        periodCount: Number(r.period_count ?? 0),
        endDate: r.end_date ? String(r.end_date).slice(0, 10) : null,
        detail: null,
      })),
    });
  }

  const rows = await db.execute(sql`
    select v.id, v.code, v.last_name, v.first_name, v.phone, v.organization,
      (select count(*)::int from visits vi where vi.visitor_id = v.id) as visit_count
    from visitors v
    where v.code ilike ${like}
      or v.last_name ilike ${like}
      or v.first_name ilike ${like}
      or coalesce(v.phone, '') ilike ${like}
    order by v.last_name asc, v.first_name asc
    limit 20
  `);
  return NextResponse.json({
    data: (rows.rows as Record<string, unknown>[]).map((r) => ({
      id: Number(r.id),
      code: String(r.code),
      lastName: String(r.last_name),
      firstName: String(r.first_name),
      phone: r.phone ? String(r.phone) : null,
      status: null,
      source: "interne",
      visitCount: Number(r.visit_count ?? 0),
      periodCount: 0,
      endDate: null,
      detail: r.organization ? String(r.organization) : null,
    })),
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!can(user?.role, "settings.write")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object" || Array.isArray(b)) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const type = b.type as PersonType;
  if (type !== "abonne" && type !== "visiteur") {
    return NextResponse.json({ error: "Type de fiche invalide." }, { status: 400 });
  }
  const id = Number(b.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Fiche invalide." }, { status: 400 });
  }
  const rawScopes: unknown[] = Array.isArray(b.scopes) ? b.scopes : [];
  const allowed = scopesFor(type);
  const scopes: Scope[] = [...new Set(
    rawScopes.filter((s): s is Scope => typeof s === "string" && allowed.includes(s as Scope)),
  )];
  if (scopes.length === 0 || scopes.length !== rawScopes.length) {
    return NextResponse.json({ error: "Sélection de données invalide." }, { status: 400 });
  }
  if (scopes.includes("record") && scopes.length > 1) {
    return NextResponse.json(
      { error: "La suppression de la fiche complète est exclusive." },
      { status: 400 },
    );
  }
  const confirmation = typeof b.confirmation === "string" ? b.confirmation.trim() : "";
  if (!confirmation) {
    return NextResponse.json(
      { error: "Saisissez le code de la fiche pour confirmer." },
      { status: 400 },
    );
  }

  const target =
    type === "abonne"
      ? (await db
          .select({
            id: subscribers.id,
            code: subscribers.code,
            source: subscribers.source,
            lastName: subscribers.lastName,
            firstName: subscribers.firstName,
          })
          .from(subscribers)
          .where(eq(subscribers.id, id))
          .limit(1))[0] ?? null
      : (await db
          .select({
            id: visitors.id,
            code: visitors.code,
            source: sql<string>`'interne'`,
            lastName: visitors.lastName,
            firstName: visitors.firstName,
          })
          .from(visitors)
          .where(eq(visitors.id, id))
          .limit(1))[0] ?? null;

  if (!target) {
    return NextResponse.json({ error: "Fiche introuvable." }, { status: 404 });
  }
  if (target.source === "media_salam" && scopes.includes("record")) {
    return NextResponse.json(
      {
        error:
          "Cette fiche provient du registre officiel media-salam. Corrigez-la dans media-salam : une fiche supprimée ici serait réimportée à la prochaine synchronisation.",
      },
      { status: 409 },
    );
  }
  if (confirmation !== target.code) {
    return NextResponse.json(
      { error: "Le code saisi ne correspond pas à la fiche sélectionnée." },
      { status: 400 },
    );
  }

  const result = await db.transaction(async (tx) => {
    let visitsDeleted = 0;
    let periodsDeleted = 0;
    let contactReset = false;
    let recordDeleted = false;

    if (type === "abonne") {
      if (scopes.includes("record")) {
        const dv = await tx
          .delete(visits)
          .where(eq(visits.subscriberId, id))
          .returning({ id: visits.id });
        visitsDeleted = dv.length;
        const dp = await tx
          .delete(subscriptionPeriods)
          .where(eq(subscriptionPeriods.subscriberId, id))
          .returning({ id: subscriptionPeriods.id });
        periodsDeleted = dp.length;
        await tx.delete(subscribers).where(eq(subscribers.id, id));
        recordDeleted = true;
      } else {
        if (scopes.includes("visits")) {
          const dv = await tx
            .delete(visits)
            .where(eq(visits.subscriberId, id))
            .returning({ id: visits.id });
          visitsDeleted = dv.length;
        }
        if (scopes.includes("subscription")) {
          const dp = await tx
            .delete(subscriptionPeriods)
            .where(eq(subscriptionPeriods.subscriberId, id))
            .returning({ id: subscriptionPeriods.id });
          periodsDeleted = dp.length;
        }
        if (scopes.includes("contact")) {
          await tx
            .update(subscribers)
            .set({ phone: null, email: null, note: null, updatedAt: new Date() })
            .where(eq(subscribers.id, id));
          contactReset = true;
        }
      }
    } else if (scopes.includes("record")) {
      const dv = await tx
        .delete(visits)
        .where(eq(visits.visitorId, id))
        .returning({ id: visits.id });
      visitsDeleted = dv.length;
      await tx.delete(visitors).where(eq(visitors.id, id));
      recordDeleted = true;
    } else {
      if (scopes.includes("visits")) {
        const dv = await tx
          .delete(visits)
          .where(eq(visits.visitorId, id))
          .returning({ id: visits.id });
        visitsDeleted = dv.length;
      }
      if (scopes.includes("contact")) {
        await tx
          .update(visitors)
          .set({ phone: null, organization: null })
          .where(eq(visitors.id, id));
        contactReset = true;
      }
    }

    return { visitsDeleted, periodsDeleted, contactReset, recordDeleted };
  });

  await logAudit(
    user,
    "réinitialisation données",
    type === "abonne" ? "abonné" : "visiteur",
    id,
    `${target.code} — ${scopes.map((s) => SCOPE_LABELS[s]).join(", ")}`,
  );

  return NextResponse.json({ data: result });
}
