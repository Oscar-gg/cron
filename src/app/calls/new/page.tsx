import { redirect } from "next/navigation";

import { auth } from "~/server/auth";
import { CallForm } from "~/app/_components/call-form";

export default async function NewCallPage() {
  const session = await auth();
  if (!session?.user) redirect("/api/auth/signin");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">New call</h1>
      <CallForm mode="create" />
    </div>
  );
}
