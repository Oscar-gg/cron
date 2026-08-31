"use client";

export interface HeaderPair {
  key: string;
  value: string;
}

export function HeaderEditor({
  pairs,
  onChange,
  disabled,
}: {
  pairs: HeaderPair[];
  onChange: (pairs: HeaderPair[]) => void;
  disabled?: boolean;
}) {
  function update(index: number, field: "key" | "value", value: string) {
    const next = pairs.map((p, i) =>
      i === index ? { ...p, [field]: value } : p,
    );
    onChange(next);
  }

  function remove(index: number) {
    onChange(pairs.filter((_, i) => i !== index));
  }

  function add() {
    onChange([...pairs, { key: "", value: "" }]);
  }

  return (
    <div className="flex flex-col gap-2">
      {pairs.map((pair, i) => (
        <div key={i} className="flex gap-2">
          <input
            className="w-1/2 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm"
            placeholder="Header-Name"
            value={pair.key}
            disabled={disabled}
            onChange={(e) => update(i, "key", e.target.value)}
          />
          <input
            className="w-1/2 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm"
            placeholder="value"
            value={pair.value}
            disabled={disabled}
            onChange={(e) => update(i, "value", e.target.value)}
          />
          {!disabled && (
            <button
              type="button"
              onClick={() => remove(i)}
              className="rounded border border-neutral-700 px-2 text-sm text-neutral-400 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>
      ))}
      {!disabled && (
        <button
          type="button"
          onClick={add}
          className="w-fit rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
        >
          + Add header
        </button>
      )}
    </div>
  );
}

export function pairsToRecord(pairs: HeaderPair[]): Record<string, string> {
  const record: Record<string, string> = {};
  for (const { key, value } of pairs) {
    if (key.trim()) record[key.trim()] = value;
  }
  return record;
}

export function recordToPairs(
  record: Record<string, string> | null | undefined,
): HeaderPair[] {
  if (!record) return [];
  return Object.entries(record).map(([key, value]) => ({ key, value }));
}
