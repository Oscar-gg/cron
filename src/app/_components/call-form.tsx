"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { api } from "~/trpc/react";
import {
  HeaderEditor,
  pairsToRecord,
  recordToPairs,
  type HeaderPair,
} from "~/app/_components/header-editor";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"] as const;
type Method = (typeof METHODS)[number];

export interface CallFormInitial {
  name: string;
  url: string;
  method: Method;
  headers: Record<string, string> | null;
  body: string | null;
  cadenceDays: number;
}

export function CallForm({
  mode,
  callId,
  initial,
  readOnly,
}: {
  mode: "create" | "edit";
  callId?: string;
  initial?: CallFormInitial;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const utils = api.useUtils();

  const [name, setName] = useState(initial?.name ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [method, setMethod] = useState<Method>(initial?.method ?? "GET");
  const [headerPairs, setHeaderPairs] = useState<HeaderPair[]>(
    recordToPairs(initial?.headers),
  );
  const [body, setBody] = useState(initial?.body ?? "");
  const [cadenceDays, setCadenceDays] = useState(initial?.cadenceDays ?? 1);

  const [testResult, setTestResult] = useState<null | {
    ok: boolean;
    status: number | null;
    statusText: string | null;
    headers: Record<string, string> | null;
    body: string | null;
    error: string | null;
    durationMs: number;
  }>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const showBody = method !== "GET" && method !== "HEAD";

  const testMutation = api.apiCall.test.useMutation({
    onSuccess: (result) => setTestResult(result),
  });

  const createMutation = api.apiCall.create.useMutation({
    onSuccess: async () => {
      await utils.apiCall.myCalls.invalidate();
      router.push("/calls");
    },
    onError: (e) => setFormError(e.message),
  });

  const updateMutation = api.apiCall.update.useMutation({
    onSuccess: async () => {
      await utils.apiCall.myCalls.invalidate();
      await utils.apiCall.allCalls.invalidate();
      if (callId) await utils.apiCall.byId.invalidate({ id: callId });
      router.push("/calls");
    },
    onError: (e) => setFormError(e.message),
  });

  function currentFields() {
    return {
      name,
      url,
      method,
      headers: pairsToRecord(headerPairs),
      body: showBody ? body : undefined,
      cadenceDays: Number(cadenceDays),
    };
  }

  function handleTest() {
    setTestResult(null);
    testMutation.mutate({
      method,
      url,
      headers: pairsToRecord(headerPairs),
      body: showBody ? body : undefined,
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (mode === "create") {
      createMutation.mutate(currentFields());
    } else if (callId) {
      updateMutation.mutate({ id: callId, ...currentFields() });
    }
  }

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {readOnly && (
        <p className="rounded border border-amber-800 bg-amber-950/40 px-3 py-2 text-sm text-amber-300">
          This request is enabled and can only be edited by an admin. You can
          still delete it.
        </p>
      )}

      <div>
        <label className="mb-1 block text-sm text-neutral-400">Name</label>
        <input
          className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2"
          value={name}
          disabled={readOnly}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div className="flex gap-3">
        <div className="w-40">
          <label className="mb-1 block text-sm text-neutral-400">
            Method
          </label>
          <select
            className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2"
            value={method}
            disabled={readOnly}
            onChange={(e) => setMethod(e.target.value as Method)}
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-sm text-neutral-400">URL</label>
          <input
            className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2"
            placeholder="https://api.example.com/endpoint"
            value={url}
            disabled={readOnly}
            onChange={(e) => setUrl(e.target.value)}
            required
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm text-neutral-400">
          Headers
        </label>
        <HeaderEditor
          pairs={headerPairs}
          onChange={setHeaderPairs}
          disabled={readOnly}
        />
      </div>

      {showBody && (
        <div>
          <label className="mb-1 block text-sm text-neutral-400">
            Body
          </label>
          <textarea
            className="h-32 w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 font-mono text-sm"
            value={body}
            disabled={readOnly}
            onChange={(e) => setBody(e.target.value)}
            placeholder='{"example":"json body"}'
          />
        </div>
      )}

      <div className="w-56">
        <label className="mb-1 block text-sm text-neutral-400">
          Cadence (days between runs)
        </label>
        <input
          type="number"
          min={1}
          max={365}
          className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2"
          value={cadenceDays}
          disabled={readOnly}
          onChange={(e) => setCadenceDays(Number(e.target.value))}
        />
        <p className="mt-1 text-xs text-neutral-500">
          Minimum is 1 (at most once per day, per the hobby-plan cron limit).
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleTest}
          disabled={testMutation.isPending || !url}
          className="rounded border border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-800 disabled:opacity-50"
        >
          {testMutation.isPending ? "Testing…" : "Test request"}
        </button>

        {!readOnly && (
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-purple-700 px-4 py-2 text-sm font-medium hover:bg-purple-600 disabled:opacity-50"
          >
            {saving
              ? "Saving…"
              : mode === "create"
                ? "Save request"
                : "Update request"}
          </button>
        )}
      </div>

      {formError && <p className="text-sm text-red-400">{formError}</p>}

      {testResult && (
        <div className="rounded border border-neutral-800 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm">
            <span
              className={
                "rounded-full px-2 py-0.5 text-xs font-medium " +
                (testResult.ok
                  ? "bg-emerald-900/60 text-emerald-300"
                  : "bg-red-900/60 text-red-300")
              }
            >
              {testResult.ok ? "ok" : "failed"}
            </span>
            <span className="text-neutral-300">
              {testResult.status ?? "—"} {testResult.statusText ?? ""}
            </span>
            <span className="text-xs text-neutral-500">
              {testResult.durationMs}ms
            </span>
          </div>
          {testResult.error && (
            <p className="mb-2 text-sm text-red-400">{testResult.error}</p>
          )}
          {testResult.headers && (
            <details className="mb-2">
              <summary className="cursor-pointer text-xs text-neutral-500">
                Response headers
              </summary>
              <pre className="mt-1 overflow-x-auto rounded bg-neutral-900 p-2 text-xs">
                {JSON.stringify(testResult.headers, null, 2)}
              </pre>
            </details>
          )}
          <pre className="max-h-64 overflow-auto rounded bg-neutral-900 p-2 text-xs whitespace-pre-wrap">
            {testResult.body || "(empty body)"}
          </pre>
        </div>
      )}
    </form>
  );
}
