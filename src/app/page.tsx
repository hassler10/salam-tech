import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ensureSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";

export default async function Home() {
  await ensureSeed();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect(user.role === "agent" ? "/accueil" : "/dashboard");
}
