import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser, can } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import UsersClient from "./UsersClient";

export const dynamic = "force-dynamic";

export default async function UtilisateursPage() {
  const user = await getCurrentUser();
  if (!can(user?.role, "users.manage")) redirect("/dashboard");
  const rows = await db.select().from(users).orderBy(users.id);
  return (
    <div>
      <PageHeader title="Gestion des utilisateurs" subtitle="Trois profils : administrateur, responsable de la bibliothèque et agent d'accueil." />
      <UsersClient
        rows={rows.map((u) => ({
          id: u.id,
          username: u.username,
          fullName: u.fullName,
          role: u.role,
          active: u.active,
          createdAt: u.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
