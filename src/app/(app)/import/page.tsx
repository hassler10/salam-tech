import { redirect } from "next/navigation";
import { db } from "@/db";
import { subscribers } from "@/db/schema";
import { sql } from "drizzle-orm";
import { getCurrentUser, can } from "@/lib/auth";
import { getSettingsMap } from "@/lib/seed";
import { getMediaSalamConfig, readMediaSalamState } from "@/lib/media-salam";
import { PageHeader } from "@/components/ui";
import ImportClient from "./ImportClient";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const user = await getCurrentUser();
  if (!can(user?.role, "users.manage")) redirect("/dashboard");

  const [settings, counts] = await Promise.all([
    getSettingsMap(),
    db
      .select({ source: subscribers.source, count: sql<number>`count(*)::int` })
      .from(subscribers)
      .groupBy(subscribers.source),
  ]);

  const imported = counts.find((row) => row.source === "import")?.count ?? 0;
  const synced = counts.find((row) => row.source === "media_salam")?.count ?? 0;
  const config = getMediaSalamConfig();
  const state = readMediaSalamState(settings);

  return (
    <div>
      <PageHeader
        title="Registre officiel des abonnés"
        subtitle="Synchronisez les abonnés de media-salam, puis restreignez la borne aux cartes et aux noms qui y figurent."
      />
      <ImportClient
        strict={(settings.require_registered_card ?? "0") === "1"}
        imported={imported}
        synced={synced}
        autoConfigured={config.configured}
        upstreamUrl={config.url}
        state={state}
      />
    </div>
  );
}
