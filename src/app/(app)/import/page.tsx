import { redirect } from "next/navigation";
import { db } from "@/db";
import { subscribers } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getCurrentUser, can } from "@/lib/auth";
import { getSettingsMap } from "@/lib/seed";
import { PageHeader } from "@/components/ui";
import ImportClient from "./ImportClient";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const user = await getCurrentUser();
  if (!can(user?.role, "users.manage")) redirect("/dashboard");
  const settings = await getSettingsMap();
  const r = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(subscribers)
    .where(eq(subscribers.source, "import"));

  return (
    <div>
      <PageHeader
        title="Import du registre des abonnés"
        subtitle="Reprenez les numéros de carte et les noms déjà émis par votre plateforme existante, puis restreignez la borne à ces identifiants."
      />
      <ImportClient
        strict={(settings.require_registered_card ?? "0") === "1"}
        imported={r[0]?.c ?? 0}
      />
    </div>
  );
}
