import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ensureSeed } from "@/lib/seed";
import Shell from "@/components/Shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await ensureSeed();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <Shell user={{ fullName: user.fullName, role: user.role, username: user.username }}>{children}</Shell>
  );
}
