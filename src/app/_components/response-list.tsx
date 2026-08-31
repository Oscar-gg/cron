"use client";

import { useState } from "react";
import { OkBadge } from "~/app/_components/status-badge";

export interface ResponseItem {
  id: string;
  status: number | null;
  statusText: string | null;
  headers: unknown;
  body: string | null;
  ok: boolean;
  error: string | null;
  durationMs: number;
  createdAt: string | Date;
}

export function ResponseList({ responses }: { responses: ResponseItem[] }) {
  if (responses.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        No responses recorded yet — this call hasn&apos;t run.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {responses.map((r) => (
        <ResponseRow key={r.id} response={r} />
      ))}
    </div>
  );
}

function ResponseRow({ response }: { response: ResponseItem }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded border border-neutral-800">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-neutral-900"
      >
        <span className="flex items-center gap-2">
          <OkBadge ok={response.ok} />
          <span className="text-neutral-300">
            {response.status ?? "—"} {response.statusText ?? ""}
          </span>
        </span>
        <span className="text-xs text-neutral-500">
          {new Date(response.createdAt).toLocaleString()} ·{" "}
          {response.durationMs}ms
        </span>
      </button>
      {open && (
        <div className="border-t border-neutral-800 px-3 py-2 text-xs">
          {response.error && (
            <p className="mb-2 text-red-400">Error: {response.error}</p>
          )}
          {!!response.headers && (
            <div className="mb-2">
              <p className="mb-1 text-neutral-500">Response headers</p>
              <pre className="overflow-x-auto rounded bg-neutral-900 p-2">
                {JSON.stringify(response.headers, null, 2)}
              </pre>
            </div>
          )}
          <div>
            <p className="mb-1 text-neutral-500">Body</p>
            <pre className="max-h-64 overflow-auto rounded bg-neutral-900 p-2 whitespace-pre-wrap">
              {response.body || "(empty)"}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
