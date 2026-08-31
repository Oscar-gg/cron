"use client";

import Link from "next/link";

import { api } from "~/trpc/react";
import { StatusBadge, OkBadge } from "~/app/_components/status-badge";
import { ResponseList } from "~/app/_components/response-list";

export function CallsClient() {
  const utils = api.useUtils();
  const { data: calls, isLoading } = api.apiCall.myCalls.useQuery();

  const deleteMutation = api.apiCall.delete.useMutation({
    onSuccess: () => utils.apiCall.myCalls.invalidate(),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My calls</h1>
        <Link
          href="/calls/new"
          className="rounded bg-purple-700 px-4 py-2 text-sm font-medium hover:bg-purple-600"
        >
          + New call
        </Link>
      </div>

      {isLoading && <p className="text-neutral-500">Loading…</p>}

      {calls && calls.length === 0 && (
        <p className="text-neutral-500">
          You haven&apos;t registered any calls yet.
        </p>
      )}

      <div className="flex flex-col gap-4">
        {calls?.map((call) => (
          <div key={call.id} className="rounded border border-neutral-800 p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{call.name}</span>
                <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs">
                  {call.method}
                </span>
                <StatusBadge enabled={call.enabled} />
                <OkBadge ok={call.lastRunOk} />
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/calls/${call.id}`}
                  className="rounded border border-neutral-700 px-3 py-1 text-sm hover:bg-neutral-800"
                >
                  {call.enabled ? "View" : "Edit"}
                </Link>
                <button
                  onClick={() => {
                    if (confirm(`Delete "${call.name}"?`)) {
                      deleteMutation.mutate({ id: call.id });
                    }
                  }}
                  className="rounded border border-red-900 px-3 py-1 text-sm text-red-400 hover:bg-red-950"
                >
                  Delete
                </button>
              </div>
            </div>
            <p className="mb-2 truncate text-sm text-neutral-400">
              {call.url}
            </p>
            <p className="mb-3 text-xs text-neutral-500">
              Every {call.cadenceDays} day{call.cadenceDays === 1 ? "" : "s"}
              {call.lastRunAt &&
                ` · last run ${new Date(call.lastRunAt).toLocaleString()}`}
            </p>
            <ResponseList
              responses={call.responses.map((r) => ({
                ...r,
                headers: r.headers,
              }))}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
