export function StatusBadge({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={
        "rounded-full px-2.5 py-0.5 text-xs font-medium " +
        (enabled
          ? "bg-emerald-900/60 text-emerald-300"
          : "bg-amber-900/60 text-amber-300")
      }
    >
      {enabled ? "Enabled" : "Disabled · pending review"}
    </span>
  );
}

export function OkBadge({ ok }: { ok: boolean | null | undefined }) {
  if (ok === null || ok === undefined) {
    return (
      <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">
        never run
      </span>
    );
  }
  return (
    <span
      className={
        "rounded-full px-2 py-0.5 text-xs font-medium " +
        (ok
          ? "bg-emerald-900/60 text-emerald-300"
          : "bg-red-900/60 text-red-300")
      }
    >
      {ok ? "ok" : "failed"}
    </span>
  );
}
