import { NextResponse } from "next/server";
import { getCurrentUser, can, logAudit } from "@/lib/auth";
import { parseCsv, applyImport } from "@/lib/import";

const MAX_CSV_BYTES = 5_000_000;
const MAX_ROWS = 20_000;

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!can(user?.role, "users.manage")) {
    return NextResponse.json({ error: "Non autorisé. Réservé à l'administrateur." }, { status: 403 });
  }
  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_CSV_BYTES + 100_000) {
    return NextResponse.json({ error: "Fichier trop volumineux (5 Mo maximum)." }, { status: 413 });
  }
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object" || typeof b.csv !== "string") {
    return NextResponse.json({ error: "Fichier invalide." }, { status: 400 });
  }
  const text = b.csv;
  if (!text.trim()) return NextResponse.json({ error: "Fichier vide." }, { status: 400 });
  if (text.length > MAX_CSV_BYTES) {
    return NextResponse.json({ error: "Fichier trop volumineux (5 Mo maximum)." }, { status: 413 });
  }

  const { rows, errors, headers } = parseCsv(text);
  if (rows.length === 0 && errors.length === 0) {
    return NextResponse.json(
      { error: "Aucune ligne exploitable. Vérifiez les en-têtes du fichier.", headers },
      { status: 400 },
    );
  }
  if (rows.length > MAX_ROWS) {
    return NextResponse.json(
      { error: `Trop de lignes (${MAX_ROWS} maximum par import).` },
      { status: 413 },
    );
  }

  // Mode aperçu : rien n'est écrit en base.
  if (b.dryRun) {
    return NextResponse.json({
      preview: true,
      total: rows.length,
      headers,
      sample: rows.slice(0, 10),
      errors,
    });
  }

  const results = await applyImport(rows, {
    updateExisting: Boolean(b?.updateExisting),
    userId: user?.id ?? null,
  });
  const all = [...errors, ...results];
  const summary = {
    crees: all.filter((r) => r.action === "créé").length,
    majs: all.filter((r) => r.action === "mis à jour").length,
    ignores: all.filter((r) => r.action === "ignoré").length,
    erreurs: all.filter((r) => r.action === "erreur").length,
  };
  await logAudit(
    user,
    "import registre abonnés",
    "abonné",
    undefined,
    `${summary.crees} créé(s), ${summary.majs} mis à jour, ${summary.ignores} ignoré(s), ${summary.erreurs} erreur(s)`,
  );
  return NextResponse.json({ summary, results: all.slice(0, 500) });
}
