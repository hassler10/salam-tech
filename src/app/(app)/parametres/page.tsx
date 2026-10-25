import { redirect } from "next/navigation";
import { db } from "@/db";
import { visitReasons } from "@/db/schema";
import { getCurrentUser, can } from "@/lib/auth";
import { getSettingsMap } from "@/lib/seed";
import { PageHeader } from "@/components/ui";
import SettingsClient from "./SettingsClient";
import ReasonsClient from "./ReasonsClient";

export const dynamic = "force-dynamic";

export default async function ParametresPage() {
  const user = await getCurrentUser();
  if (!can(user?.role, "settings.write")) redirect("/dashboard");
  const settings = await getSettingsMap();
  const reasons = await db.select().from(visitReasons).orderBy(visitReasons.id);
  return (
    <div className="space-y-5">
      <PageHeader
        title="Paramètres de la bibliothèque"
        subtitle="Identité, seuils d'alerte, sécurité et motifs de visite."
      />
      <SettingsClient settings={settings} />
      <ReasonsClient reasons={reasons} />
    </div>
  );
}
