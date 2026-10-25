import { redirect } from "next/navigation";
import { db } from "@/db";
import { subscriptionTypes } from "@/db/schema";
import { getCurrentUser, can } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import TypesClient from "./TypesClient";

export const dynamic = "force-dynamic";

export default async function TypesPage() {
  const user = await getCurrentUser();
  if (!can(user?.role, "types.write")) redirect("/dashboard");
  const types = await db.select().from(subscriptionTypes).orderBy(subscriptionTypes.durationMonths);
  return (
    <div>
      <PageHeader
        title="Types et durées d'abonnement"
        subtitle="Les durées sont configurables. La date d'expiration est calculée automatiquement à partir de la date de début."
      />
      <TypesClient types={types.map((t) => ({ ...t, description: t.description ?? "" }))} />
    </div>
  );
}
