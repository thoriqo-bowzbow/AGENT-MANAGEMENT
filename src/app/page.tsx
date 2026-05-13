import { redirect } from "next/navigation";

import { getCurrentUser, hasOwner } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!(await hasOwner())) {
    redirect("/setup");
  }

  const user = await getCurrentUser();
  redirect(user ? "/chat" : "/login");
}
