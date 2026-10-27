import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function BornePage() {
  const user = await getCurrentUser();
  redirect(user ? "/accueil" : "/login");
}
