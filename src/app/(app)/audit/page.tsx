import { redirect } from "next/navigation";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { desc } from "drizzle-orm";
import { getCurrentUser, can } from "@/lib/auth";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const user = await getCurrentUser();
  if (!can(user?.role, "audit.read")) redirect("/dashboard");
  const rows = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(300);
  return (
    <div>
      <PageHeader title="Journal d'audit" subtitle="Traçabilité des opérations sensibles (300 dernières entrées)." />
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Date et heure</th><th>Utilisateur</th><th>Action</th><th>Entité</th><th>Référence</th><th>Détails</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-slate-500">Aucune entrée.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.createdAt).toLocaleString("fr-FR")}</td>
                <td className="font-semibold">{r.userName ?? "—"}</td>
                <td>{r.action}</td>
                <td>{r.entity ?? "—"}</td>
                <td className="font-mono text-xs">{r.entityId ?? "—"}</td>
                <td className="max-w-md truncate text-xs text-slate-500">{r.details ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
