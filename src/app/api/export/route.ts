import { db } from "@/db";
import { visits, visitors } from "@/db/schema";
import { and, gte, lte, eq, desc } from "drizzle-orm";
import { getCurrentUser, can } from "@/lib/auth";
import { listSubscribers } from "@/lib/queries";
import { STATUS_LABEL } from "@/lib/subscriptions";

function csv(rows: (string | number | null)[][]): string {
  return (
    "\uFEFF" +
    rows
      .map((r) =>
        r
          .map((c) => {
            const s = c === null || c === undefined ? "" : String(c);
            return `"${s.replace(/"/g, '""')}"`;
          })
          .join(";"),
      )
      .join("\r\n")
  );
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!can(user?.role, "reports.read")) {
    return new Response("Non autorisé", { status: 403 });
  }
  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "visites";
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const personType = url.searchParams.get("personType");

  let rows: (string | number | null)[][] = [];
  let filename = `rapport-${type}.csv`;

  if (type === "visites") {
    const conds = [];
    if (from) conds.push(gte(visits.occurredAt, new Date(`${from}T00:00:00`)));
    if (to) conds.push(lte(visits.occurredAt, new Date(`${to}T23:59:59`)));
    if (personType) conds.push(eq(visits.personType, personType));
    const data = await db
      .select()
      .from(visits)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(visits.occurredAt));
    rows = [
      ["Identifiant visite", "Type", "Nom et prénoms", "Motif", "Organisme", "Date et heure", "Agent", "Synchronisation"],
      ...data.map((v) => [
        v.uid,
        v.personType === "abonne" ? "Abonné" : "Visiteur",
        v.displayName,
        v.reason,
        v.organization,
        new Date(v.occurredAt).toLocaleString("fr-FR"),
        v.agentName,
        v.syncStatus,
      ]),
    ];
    filename = `rapport-frequentation-${from ?? "debut"}_${to ?? "fin"}.csv`;
  } else if (type === "abonnes") {
    const statusFilter = url.searchParams.get("status");
    let data = await listSubscribers();
    if (statusFilter) {
      data = data.filter((s) =>
        statusFilter === "bientot"
          ? s.computed === "bientot" || s.computed === "imminent"
          : s.computed === statusFilter,
      );
    }
    rows = [
      ["Identifiant", "Nom", "Prénoms", "Téléphone", "Inscription", "Type", "Début", "Expiration", "Jours restants", "Statut", "Visites", "Dernière visite"],
      ...data.map((s) => [
        s.code,
        s.lastName,
        s.firstName,
        s.phone,
        s.registeredAt,
        s.typeName,
        s.startDate,
        s.endDate,
        s.daysLeft,
        STATUS_LABEL[s.computed],
        s.visitCount,
        s.lastVisit ? new Date(s.lastVisit).toLocaleString("fr-FR") : "",
      ]),
    ];
  } else if (type === "visiteurs") {
    const data = await db.select().from(visitors);
    rows = [
      ["Identifiant", "Nom", "Prénoms", "Contact", "Organisme", "Créé le"],
      ...data.map((v) => [
        v.code,
        v.lastName,
        v.firstName,
        v.phone,
        v.organization,
        new Date(v.createdAt).toLocaleDateString("fr-FR"),
      ]),
    ];
  } else if (type === "motifs") {
    const data = await db.select().from(visits);
    const map = new Map<string, number>();
    for (const v of data) {
      const k = v.reason || "Non précisé";
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    rows = [["Motif", "Nombre de visites"], ...[...map.entries()].sort((a, b) => b[1] - a[1])];
  }

  return new Response(csv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
