import { NextResponse } from "next/server";
import { db } from "@/db";
import { visits, visitors } from "@/db/schema";
import { and, gte, lte, eq, desc } from "drizzle-orm";
import { getCurrentUser, can } from "@/lib/auth";
import { listSubscribers } from "@/lib/queries";
import { STATUS_LABEL } from "@/lib/subscriptions";

const REPORT_TYPES = ["visites", "abonnes", "visiteurs", "motifs"] as const;
type ReportType = (typeof REPORT_TYPES)[number];

function isReportType(value: string | null): value is ReportType {
  return !!value && (REPORT_TYPES as readonly string[]).includes(value);
}

function parseDay(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const [y, m, dd] = value.split("-").map(Number);
  if (d.getFullYear() !== y || d.getMonth() !== m - 1 || d.getDate() !== dd) return null;
  return d;
}

function cell(c: string | number | null): string {
  let s = c === null || c === undefined ? "" : String(c);
  // Neutralise les formules Excel/Sheets issues de données saisies par les usagers.
  if (typeof c === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

function csv(rows: (string | number | null)[][]): string {
  return "\uFEFF" + rows.map((r) => r.map(cell).join(";")).join("\r\n");
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!can(user?.role, "reports.read")) {
    return new Response("Non autorisé", { status: 403 });
  }
  const url = new URL(req.url);
  const typeParam = url.searchParams.get("type") ?? "visites";
  if (!isReportType(typeParam)) {
    return NextResponse.json({ error: "Type de rapport invalide." }, { status: 400 });
  }
  const type = typeParam;

  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const personType = url.searchParams.get("personType");

  const fromDate = from ? parseDay(from) : null;
  const toDate = to ? parseDay(to) : null;
  if ((from && !fromDate) || (to && !toDate)) {
    return NextResponse.json({ error: "Date invalide (format attendu : AAAA-MM-JJ)." }, { status: 400 });
  }
  if (fromDate && toDate && fromDate > toDate) {
    return NextResponse.json({ error: "La date de début doit précéder la date de fin." }, { status: 400 });
  }
  if (personType && personType !== "abonne" && personType !== "visiteur") {
    return NextResponse.json({ error: "Type de personne invalide." }, { status: 400 });
  }

  let rows: (string | number | null)[][] = [];
  let filename = "rapport.csv";

  if (type === "visites") {
    const conds = [];
    if (fromDate) conds.push(gte(visits.occurredAt, fromDate));
    if (toDate) conds.push(lte(visits.occurredAt, new Date(toDate.getTime() + 86399999)));
    if (personType) conds.push(eq(visits.personType, personType));
    const data = await db
      .select()
      .from(visits)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(visits.occurredAt));
    rows = [
      ["Identifiant visite", "Type", "Nom et prénoms", "Motif", "Fonction", "Date et heure", "Agent", "Synchronisation"],
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
    filename = `rapport-frequentation-${fromDate ? from : "debut"}_${toDate ? to : "fin"}.csv`;
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
    filename = "rapport-abonnes.csv";
  } else if (type === "visiteurs") {
    const data = await db.select().from(visitors);
    rows = [
      ["Identifiant", "Nom", "Prénoms", "Contact", "Fonction", "Créé le"],
      ...data.map((v) => [
        v.code,
        v.lastName,
        v.firstName,
        v.phone,
        v.organization,
        new Date(v.createdAt).toLocaleDateString("fr-FR"),
      ]),
    ];
    filename = "rapport-visiteurs.csv";
  } else {
    const data = await db.select().from(visits);
    const map = new Map<string, number>();
    for (const v of data) {
      const k = v.reason || "Non précisé";
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    rows = [["Motif", "Nombre de visites"], ...[...map.entries()].sort((a, b) => b[1] - a[1])];
    filename = "rapport-motifs.csv";
  }

  return new Response(csv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
