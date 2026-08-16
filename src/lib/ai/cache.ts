import { createHash } from "node:crypto";

/** Recursively sorts object keys while preserving array order. */
export function normalizeNarrationBrief<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => normalizeNarrationBrief(item)) as T;
  if (value && typeof value === "object") {
    const sorted = Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((out, key) => {
        const item = (value as Record<string, unknown>)[key];
        if (item !== undefined) out[key] = normalizeNarrationBrief(item);
        return out;
      }, {});
    return sorted as T;
  }
  return value;
}

export function narrationCacheKey(brief: unknown): string {
  const normalized = normalizeNarrationBrief(brief);
  return `narration:v1:${createHash("sha256").update(JSON.stringify(normalized)).digest("hex")}`;
}
