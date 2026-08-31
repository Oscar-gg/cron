"use client";

import Link from "next/link";

import { api } from "~/trpc/react";
import { StatusBadge, OkBadge } from "~/app/_components/status-badge";

export function AdminClient() {
  const utils = api.useUtils();

  const { data: pending } = api.apiCall.pendingCalls.useQuery();
  const { data: all, isLoading } = api.apiCall.allCalls.useQuery();

  const setEnabled = api.apiCall.setEnabled.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.apiCall.allCalls.invalidate(),
        utils.apiCall.pendingCalls.invalidate(),
      ]);
    },
  });

  const deleteMutation = api.apiCall.delete.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.apiCall.allCalls.invalidate(),
        utils.apiCall.pendingCalls.invalidate(),
      ]);
    },
  });

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-2xl font-bold">Admin</h1>
        <p className="text-neutral-400">
          Review new requests, and enable, disable, edit, or delete any
          registered call.
        </p>
      </div>

      {pending && pending.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-amber-300">
            Pending review ({pending.length})
          </h2>
          <div className="flex flex-col gap-3">
            {pending.map((call) => (
              <div
                key={call.id}
                className="rounded border border-amber-900/60 bg-amber-950/20 p-4"
              >
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{call.name}</span>
                    <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs">
                      {call.method}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/calls/${call.id}`}
                      className="rounded border border-neutral-700 px-3 py-1 text-sm hover:bg-neutral-800"
                    >
                      Inspect
                    </Link>
                    <button
                      onClick={() =>
                        setEnabled.mutate({ id: call.id, enabled: true })
                      }
                      className="rounded bg-emerald-800 px-3 py-1 text-sm hover:bg-emerald-700"
                    >
                      Enable
                    </button>
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
                <p className="truncate text-sm text-neutral-400">
                  {call.url}
                </p>
                <p className="text-xs text-neutral-500">
                  by {call.createdBy.name ?? call.createdBy.email} · every{" "}
                  {call.cadenceDays} day{call.cadenceDays === 1 ? "" : "s"}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold">
          All calls {all ? `(${all.length})` : ""}
        </h2>
        {isLoading && <p className="text-neutral-500">Loading…</p>}
        <div className="flex flex-col gap-3">
          {all?.map((call) => (
            <div key={call.id} className="rounded border border-neutral-800 p-4">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
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
                    Edit
                  </Link>
                  <button
                    onClick={() =>
                      setEnabled.mutate({
                        id: call.id,
                        enabled: !call.enabled,
                      })
                    }
                    className="rounded border border-neutral-700 px-3 py-1 text-sm hover:bg-neutral-800"
                  >
                    {call.enabled ? "Disable" : "Enable"}
                  </button>
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
              <p className="truncate text-sm text-neutral-400">{call.url}</p>
              <p className="text-xs text-neutral-500">
                by {call.createdBy.name ?? call.createdBy.email} · every{" "}
                {call.cadenceDays} day{call.cadenceDays === 1 ? "" : "s"}
                {call.lastRunAt &&
                  ` · last run ${new Date(call.lastRunAt).toLocaleString()}`}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
