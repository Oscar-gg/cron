import { env } from "~/env";
import { db } from "~/server/db";
import { executeHttpCall } from "~/server/http-exec";
import type { ApiCall } from "../../generated/prisma";

function isDue(call: ApiCall, now: Date) {
  if (!call.lastRunAt) return true;
  const diffDays =
    (now.getTime() - call.lastRunAt.getTime()) / (24 * 60 * 60 * 1000);
  // small tolerance so a cron invocation that runs a few minutes early/late
  // each day doesn't skip a call that's due
  return diffDays >= call.cadenceDays - 0.05;
}

async function runOne(call: ApiCall) {
  const result = await executeHttpCall({
    method: call.method,
    url: call.url,
    headers: (call.headers as Record<string, string> | null) ?? undefined,
    body: call.body ?? undefined,
  });

  await db.$transaction(async (tx) => {
    await tx.apiCallResponse.create({
      data: {
        apiCallId: call.id,
        status: result.status,
        statusText: result.statusText,
        headers: result.headers ?? undefined,
        body: result.body,
        ok: result.ok,
        error: result.error,
        durationMs: result.durationMs,
      },
    });

    const stale = await tx.apiCallResponse.findMany({
      where: { apiCallId: call.id },
      orderBy: { createdAt: "desc" },
      skip: env.MAX_RESPONSES_PER_CALL,
      select: { id: true },
    });
    if (stale.length > 0) {
      await tx.apiCallResponse.deleteMany({
        where: { id: { in: stale.map((r) => r.id) } },
      });
    }

    await tx.apiCall.update({
      where: { id: call.id },
      data: { lastRunAt: new Date(), lastRunOk: result.ok },
    });
  });

  return { id: call.id, name: call.name, ok: result.ok, status: result.status };
}

export async function runDueCalls() {
  const now = new Date();
  const enabledCalls = await db.apiCall.findMany({ where: { enabled: true } });
  const due = enabledCalls.filter((call) => isDue(call, now));

  const settled = await Promise.allSettled(due.map((call) => runOne(call)));

  return {
    ranAt: now.toISOString(),
    enabledCount: enabledCalls.length,
    attempted: due.length,
    results: settled.map((s, i) =>
      s.status === "fulfilled"
        ? s.value
        : { id: due[i]!.id, name: due[i]!.name, ok: false, error: String(s.reason) },
    ),
  };
}
