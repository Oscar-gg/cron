import { redirect } from "next/navigation";

import { auth } from "~/server/auth";
import { CallsClient } from "./calls-client";

export default async function CallsPage() {
  const session = await auth();
  if (!session?.user) redirect("/api/auth/signin");

  return <CallsClient />;
}
