"use client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonValue = any;

interface DiffEntry {
  key: string;
  type: "unchanged" | "added" | "removed" | "changed";
  before: string;
  after: string;
}

function flattenDiff(
  before: JsonValue | undefined,
  after: JsonValue | undefined,
  prefix = "",
): DiffEntry[] {
  const keys = new Set([
    ...(before && typeof before === "object" && !Array.isArray(before)
      ? Object.keys(before)
      : []),
    ...(after && typeof after === "object" && !Array.isArray(after)
      ? Object.keys(after)
      : []),
  ]);

  const result: DiffEntry[] = [];

  for (const key of keys) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const bVal = before && typeof before === "object" && !Array.isArray(before) ? (before as Record<string, JsonValue>)[key] : undefined;
    const aVal = after && typeof after === "object" && !Array.isArray(after) ? (after as Record<string, JsonValue>)[key] : undefined;

    if (bVal === undefined && aVal !== undefined) {
      result.push({
        key: fullKey,
        type: "added",
        before: "-",
        after: JSON.stringify(aVal, null, 2),
      });
    } else if (bVal !== undefined && aVal === undefined) {
      result.push({
        key: fullKey,
        type: "removed",
        before: JSON.stringify(bVal, null, 2),
        after: "-",
      });
    } else if (
      typeof bVal === "object" &&
      typeof aVal === "object" &&
      bVal !== null &&
      aVal !== null &&
      !Array.isArray(bVal) &&
      !Array.isArray(aVal)
    ) {
      result.push(...flattenDiff(bVal as JsonValue, aVal as JsonValue, fullKey));
    } else if (JSON.stringify(bVal) !== JSON.stringify(aVal)) {
      result.push({
        key: fullKey,
        type: "changed",
        before: JSON.stringify(bVal, null, 2),
        after: JSON.stringify(aVal, null, 2),
      });
    } else {
      result.push({
        key: fullKey,
        type: "unchanged",
        before: JSON.stringify(bVal, null, 2),
        after: JSON.stringify(aVal, null, 2),
      });
    }
  }

  return result;
}

export function JsonDiff({
  before,
  after,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  before: Record<string, any> | null | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  after: Record<string, any> | null | undefined;
}) {
  const diffs = flattenDiff(before ?? undefined, after ?? undefined);

  if (diffs.length === 0) {
    return <p className="py-4 text-center text-sm text-muted">Tidak ada data untuk dibandingkan.</p>;
  }

  const changedCount = diffs.filter((d) => d.type !== "unchanged").length;

  return (
    <div className="space-y-3">
      {changedCount > 0 && (
        <p className="text-xs text-muted">
          <span className="font-medium text-gold-deep">{changedCount}</span> perubahan ditemukan
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Before column */}
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-wood">Sebelum</h4>
          <pre className="max-h-96 overflow-auto rounded-md border border-wood/15 bg-parchment/60 p-3 text-[11px] leading-relaxed">
            {JSON.stringify(before ?? {}, null, 2) || "{}"}
          </pre>
        </div>

        {/* After column */}
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-forest">Sesudah</h4>
          <pre className="max-h-96 overflow-auto rounded-md border border-wood/15 bg-parchment/60 p-3 text-[11px] leading-relaxed">
            {JSON.stringify(after ?? {}, null, 2) || "{}"}
          </pre>
        </div>
      </div>

      {/* Key-level diff table */}
      {changedCount > 0 && (
        <div className="overflow-x-auto rounded-md border border-wood/15">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">Perubahan per field</caption>
            <thead>
              <tr className="border-b border-wood/15 bg-parchment/40 text-muted">
                <th scope="col" className="px-3 py-2 font-medium">Field</th>
                <th scope="col" className="px-3 py-2 font-medium">Status</th>
                <th scope="col" className="px-3 py-2 font-medium">Sebelum</th>
                <th scope="col" className="px-3 py-2 font-medium">Sesudah</th>
              </tr>
            </thead>
            <tbody>
              {diffs
                .filter((d) => d.type !== "unchanged")
                .map((d) => (
                  <tr
                    key={d.key}
                    className={`border-b border-wood/10 last:border-0 ${
                      d.type === "added"
                        ? "bg-green-50"
                        : d.type === "removed"
                          ? "bg-red-50"
                          : "bg-amber-50"
                    }`}
                  >
                    <td className="px-3 py-2 font-mono text-[10px] text-forest">{d.key}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          d.type === "added"
                            ? "bg-green-100 text-green-800"
                            : d.type === "removed"
                              ? "bg-red-100 text-red-800"
                              : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {d.type === "added"
                          ? "Ditambah"
                          : d.type === "removed"
                            ? "Dihapus"
                            : "Berubah"}
                      </span>
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2 font-mono text-[10px] text-wood">
                      {d.before}
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2 font-mono text-[10px] text-forest">
                      {d.after}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}