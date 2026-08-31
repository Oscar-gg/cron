import { redirect } from "next/navigation";

import { auth } from "~/server/auth";
import { AdminClient } from "./admin-client";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/api/auth/signin");
  if (!session.user.isAdmin) redirect("/calls");

  return <AdminClient />;
}
