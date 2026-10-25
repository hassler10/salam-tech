import { redirect } from "next/navigation";
import { db } from "@/db";
import { visitReasons } from "@/db/schema";
import { getCurrentUser, can } from "@/lib/auth";
import { getSettingsMap } from "@/lib/seed";
import { PUBLIC_DEFAULTS } from "@/lib/public-defaults";
import { getBranding } from "@/lib/branding";
import { PageHeader } from "@/components/ui";
import SettingsClient from "./SettingsClient";
import AccountPassword from "./AccountPassword";
import DataReset from "./DataReset";
import ReasonsClient from "./ReasonsClient";

export const dynamic = "force-dynamic";

const OPERATION_DEFAULTS: Record<string, string> = {
  ...PUBLIC_DEFAULTS,
  alert_soon_days: "7",
  alert_imminent_days: "3",
  duplicate_window_minutes: "30",
  session_timeout_minutes: "60",
  self_service_enabled: "1",
};

export default async function ParametresPage() {
  const user = await getCurrentUser();
  if (!can(user?.role, "settings.write")) redirect("/dashboard");
  const [stored, branding, reasons] = await Promise.all([
    getSettingsMap(),
    getBranding(),
    db.select().from(visitReasons).orderBy(visitReasons.id),
  ]);
  const settings = Object.fromEntries(
    Object.entries(OPERATION_DEFAULTS).map(([key, fallback]) => [key, stored[key] ?? fallback]),
  );
  return (
    <div className="space-y-5">
      <PageHeader
        title="Paramètres de la bibliothèque"
        subtitle="Identité visuelle, vitrine publique, compte, réinitialisation des données et motifs de visite."
      />
      <SettingsClient settings={settings} logoUrl={branding.logoUrl} coverUrl={branding.coverUrl} />
      <AccountPassword username={user?.username ?? ""} />
      <DataReset />
      <ReasonsClient reasons={reasons} />
    </div>
  );
}
