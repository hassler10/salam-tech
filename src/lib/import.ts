import { db } from "@/db";
import { subscribers, subscriptionPeriods, subscriptionTypes } from "@/db/schema";
import { sql, eq } from "drizzle-orm";
import { addDays, daysBetween, todayIso } from "./subscriptions";

export type ImportRow = {
  cardNumber: string;
  lastName: string;
  firstName: string;
  phone?: string;
  typeName?: string;
  startDate?: string;
  endDate?: string;
  durationDays?: number;
};

export type RowResult = {
  line: number;
  cardNumber: string;
  name: string;
  action: "créé" | "mis à jour" | "ignoré" | "erreur";
  message?: string;
};

const HEADER_ALIASES: Record<string, string> = {
  "numero carte": "cardNumber", "numéro carte": "cardNumber", "n° carte": "cardNumber",
  "numero": "cardNumber", "numéro": "cardNumber", "carte": "cardNumber",
  "numero abonnement": "cardNumber", "numéro abonnement": "cardNumber",
  "identifiant": "cardNumber", "id": "cardNumber", "matricule": "cardNumber", "code": "cardNumber",
  "nom": "lastName", "nom de famille": "lastName",
  "prenom": "firstName", "prénom": "firstName", "prenoms": "firstName", "prénoms": "firstName",
  "telephone": "phone", "téléphone": "phone", "contact": "phone", "tel": "phone",
  "type": "typeName", "type abonnement": "typeName", "type d'abonnement": "typeName", "formule": "typeName",
  "debut": "startDate", "début": "startDate", "date debut": "startDate", "date de debut": "startDate",
  "date début": "startDate", "date de début": "startDate",
  "fin": "endDate", "expiration": "endDate", "date fin": "endDate", "date de fin": "endDate",
  "date expiration": "endDate", "date d'expiration": "endDate",
  "duree": "durationDays", "durée": "durationDays", "duree jours": "durationDays", "durée (jours)": "durationDays",
  "duree j": "durationDays", "durée (j)": "durationDays",
};

function norm(s: string) {
  return s.trim().toLowerCase().replace(/^"|"$/g, "").replace(/\s+/g, " ");
}

function splitLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === sep && !inQ) {
      out.push(cur); cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((v) => v.trim().replace(/^"|"$/g, ""));
}

/** Convertit JJ/MM/AAAA, AAAA-MM-JJ, JJ-MM-AAAA en AAAA-MM-JJ. */
export function parseDate(v: string | undefined): string | null {
  if (!v) return null;
  const s = v.trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

export function parseCsv(text: string): { rows: ImportRow[]; errors: RowResult[]; headers: string[] } {
  const clean = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const lines = clean.split("\n").filter((l) => l.trim().length > 0);
  const errors: RowResult[] = [];
  if (lines.length < 2) return { rows: [], errors, headers: [] };

  const sep = [";", ",", "\t"]
    .map((s) => ({ s, n: lines[0].split(s).length }))
    .sort((a, b) => b.n - a.n)[0].s;

  const rawHeaders = splitLine(lines[0], sep);
  const headers = rawHeaders.map((h) => HEADER_ALIASES[norm(h)] ?? "");

  const rows: ImportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i], sep);
    const o: Record<string, string> = {};
    headers.forEach((h, j) => { if (h) o[h] = (cells[j] ?? "").trim(); });

    const cardNumber = o.cardNumber ?? "";
    const lastName = o.lastName ?? "";
    const firstName = o.firstName ?? "";
    if (!cardNumber || !lastName) {
      errors.push({
        line: i + 1,
        cardNumber,
        name: `${lastName} ${firstName}`.trim(),
        action: "erreur",
        message: !cardNumber ? "Numéro de carte manquant" : "Nom manquant",
      });
      continue;
    }
    const durationDays = Number(o.durationDays);
    rows.push({
      cardNumber,
      lastName,
      firstName,
      phone: o.phone || undefined,
      typeName: o.typeName || undefined,
      startDate: parseDate(o.startDate) ?? undefined,
      endDate: parseDate(o.endDate) ?? undefined,
      durationDays: Number.isInteger(durationDays) && durationDays > 0 ? durationDays : undefined,
    });
  }
  return { rows, errors, headers: rawHeaders };
}

export async function applyImport(
  rows: ImportRow[],
  opts: { updateExisting: boolean; userId?: number | null },
): Promise<RowResult[]> {
  const results: RowResult[] = [];
  const types = await db.select().from(subscriptionTypes);
  const seen = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const line = i + 2;
    const name = `${r.lastName} ${r.firstName}`.trim();
    const card = r.cardNumber.trim();

    if (seen.has(card.toLowerCase())) {
      results.push({ line, cardNumber: card, name, action: "ignoré", message: "Doublon dans le fichier" });
      continue;
    }
    seen.add(card.toLowerCase());

    try {
      const existing = await db
        .select()
        .from(subscribers)
        .where(sql`lower(${subscribers.cardNumber}) = lower(${card}) or lower(${subscribers.code}) = lower(${card})`)
        .limit(1);

      let subscriberId: number;

      if (existing[0]) {
        if (!opts.updateExisting) {
          results.push({ line, cardNumber: card, name, action: "ignoré", message: "Déjà présent" });
          continue;
        }
        await db
          .update(subscribers)
          .set({
            cardNumber: card,
            lastName: r.lastName,
            firstName: r.firstName,
            phone: r.phone ?? existing[0].phone,
            source: "import",
            importedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(subscribers.id, existing[0].id));
        subscriberId = existing[0].id;
        results.push({ line, cardNumber: card, name, action: "mis à jour" });
      } else {
        const [created] = await db
          .insert(subscribers)
          .values({
            code: card,
            cardNumber: card,
            lastName: r.lastName,
            firstName: r.firstName,
            phone: r.phone ?? null,
            registeredAt: r.startDate ?? todayIso(),
            status: "actif",
            source: "import",
            importedAt: new Date(),
          })
          .returning();
        subscriberId = created.id;
        results.push({ line, cardNumber: card, name, action: "créé" });
      }

      // Période d'abonnement si le fichier en fournit une.
      const start = r.startDate ?? null;
      let end = r.endDate ?? null;
      let days = r.durationDays ?? null;
      const matched = r.typeName
        ? types.find((t) => t.name.toLowerCase().includes(r.typeName!.toLowerCase().trim()))
        : null;
      if (!days && matched) days = matched.durationDays;
      if (!end && start && days) end = addDays(start, days);
      if (start && end && !days) days = daysBetween(start, end);

      if (start && end && days && days > 0) {
        const dup = await db
          .select({ id: subscriptionPeriods.id })
          .from(subscriptionPeriods)
          .where(sql`${subscriptionPeriods.subscriberId} = ${subscriberId} and ${subscriptionPeriods.startDate} = ${start} and ${subscriptionPeriods.endDate} = ${end}`)
          .limit(1);
        if (!dup[0]) {
          await db.insert(subscriptionPeriods).values({
            subscriberId,
            typeId: matched?.id ?? null,
            typeName: r.typeName || matched?.name || "Abonnement importé",
            startDate: start,
            endDate: end,
            durationDays: days,
            createdBy: opts.userId ?? null,
          });
        }
      }
    } catch (e) {
      results.push({
        line,
        cardNumber: card,
        name,
        action: "erreur",
        message: e instanceof Error ? e.message.slice(0, 120) : "Erreur inconnue",
      });
    }
  }
  return results;
}
