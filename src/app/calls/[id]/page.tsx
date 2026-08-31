import { redirect } from "next/navigation";

import { auth } from "~/server/auth";
import { CallDetail } from "./call-detail";

export default async function CallDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/api/auth/signin");

  const { id } = await params;
  return <CallDetail id={id} />;
}
