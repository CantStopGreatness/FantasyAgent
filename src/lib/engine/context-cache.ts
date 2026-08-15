import "server-only";
import { buildAnalysis, type AnalysisContext } from "./recommend";
import { buildSnapshot, type LeagueOverrides } from "./league";

/**
 * Short-lived cache of assembled analysis contexts.
 *
 * Building one is cheap after the Sleeper payloads are on disk, but it still
 * re-derives z-score baselines across the whole player pool. Holding it for a
 * few minutes keeps tab switches instant.
 *
 * Note this is a per-process Map: correct for a single server, ineffective
 * across serverless instances. Swap for a shared store before deploying to a
 * multi-instance host.
 */
const TTL_MS = 5 * 60 * 1000;
const contexts = new Map<string, { at: number; ctx: AnalysisContext }>();

/**
 * Overrides are part of the identity of a context, not a variation of it —
 * a corrected point value produces genuinely different rankings, so it must
 * not read a cache entry built from the league's original weights.
 */
function cacheKey(leagueId: string, userId: string | null, o: LeagueOverrides): string {
  const stable = (obj: Record<string, unknown> | undefined) =>
    obj && Object.keys(obj).length
      ? JSON.stringify(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)))
      : "";
  return [
    leagueId,
    userId ?? "anon",
    o.format ?? "auto",
    stable(o.rules),
    stable(o.scoring),
  ].join("::");
}

export async function getAnalysis(
  leagueId: string,
  userId: string | null,
  overrides: LeagueOverrides = {},
): Promise<AnalysisContext> {
  const key = cacheKey(leagueId, userId, overrides);
  const hit = contexts.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.ctx;

  const snapshot = await buildSnapshot(leagueId, userId, overrides);
  const ctx = await buildAnalysis(snapshot);

  // Bound the map so a session of repeated edits cannot grow it without limit.
  if (contexts.size > 40) contexts.clear();
  contexts.set(key, { at: Date.now(), ctx });
  return ctx;
}
