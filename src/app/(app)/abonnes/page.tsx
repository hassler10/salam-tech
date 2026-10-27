import { listSubscribers } from "@/lib/queries";
import { refreshMediaSalamIfDue } from "@/lib/media-salam";
import { PageHeader } from "@/components/ui";
import SubscribersClient from "./SubscribersClient";

export const dynamic = "force-dynamic";

export default async function AbonnesPage() {
  await refreshMediaSalamIfDue();
  const subs = await listSubscribers();
  return (
    <div>
      <PageHeader
        title="Gestion des abonnés"
        subtitle="Registre des abonnés Media Salam, actualisé automatiquement. Seules les cartes actives du registre officiel sont reconnues."
      />
      <SubscribersClient
        subs={subs.map((s) => ({ ...s, lastVisit: s.lastVisit ? s.lastVisit.toISOString() : null }))}
      />
    </div>
  );
}
