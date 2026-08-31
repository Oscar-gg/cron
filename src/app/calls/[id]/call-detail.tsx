"use client";

import { api } from "~/trpc/react";
import { CallForm } from "~/app/_components/call-form";
import { StatusBadge } from "~/app/_components/status-badge";
import { ResponseList } from "~/app/_components/response-list";

export function CallDetail({ id }: { id: string }) {
  const { data: call, isLoading, error } = api.apiCall.byId.useQuery({ id });

  if (isLoading) return <p className="text-neutral-500">Loading…</p>;
  if (error)
    return (
      <p className="text-red-400">
        {error.data?.code === "FORBIDDEN"
          ? "You don't have access to this call."
          : "Call not found."}
      </p>
    );
  if (!call) return null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">{call.name}</h1>
        <StatusBadge enabled={call.enabled} />
      </div>

      {!call.isOwner && (
        <p className="text-sm text-neutral-500">
          Registered by {call.createdBy.name ?? call.createdBy.email}
        </p>
      )}

      <CallForm
        mode="edit"
        callId={call.id}
        readOnly={!call.canEdit}
        initial={{
          name: call.name,
          url: call.url,
          method: call.method,
          headers: (call.headers as Record<string, string> | null) ?? null,
          body: call.body,
          cadenceDays: call.cadenceDays,
        }}
      />

      <div>
        <h2 className="mb-3 text-lg font-semibold">Recent responses</h2>
        <ResponseList responses={call.responses} />
      </div>
    </div>
  );
}
