import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ensureSeed } from "@/lib/seed";
import { getBranding } from "@/lib/branding";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  await ensureSeed();
  const user = await getCurrentUser();
  if (user) redirect(user.role === "agent" ? "/accueil" : "/dashboard");
  const branding = await getBranding();
  return (
    <LoginForm
      branding={{
        name: branding.name,
        shortName: branding.shortName,
        org: branding.org,
        city: branding.city,
        logoUrl: branding.logoUrl,
        coverUrl: branding.coverUrl,
      }}
    />
  );
}
