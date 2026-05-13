import { AppShell } from "@/components/app-shell";
import { requireCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireCurrentUser();
  return <AppShell userName={user.name}>{children}</AppShell>;
}
