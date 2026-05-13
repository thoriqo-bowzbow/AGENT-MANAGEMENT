import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth-form";
import { hasOwner } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (await hasOwner()) {
    redirect("/login");
  }

  return <AuthForm mode="setup" />;
}
