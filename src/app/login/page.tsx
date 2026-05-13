import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth-form";
import { getCurrentUser, hasOwner } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (!(await hasOwner())) {
    redirect("/setup");
  }

  if (await getCurrentUser()) {
    redirect("/chat");
  }

  return <AuthForm mode="login" />;
}
