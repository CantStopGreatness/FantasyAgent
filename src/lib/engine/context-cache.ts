import "server-only";
import { buildAnalysis, type AnalysisContext } from "./recommend";
import { buildSnapshot } from "./league";
import type { ScoringFormat } from "./scoring";

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

export async function getAnalysis(
  leagueId: string,
  userId: string | null,
  formatOverride?: ScoringFormat | null,
): Promise<AnalysisContext> {
  const key = `${leagueId}::${userId ?? "anon"}::${formatOverride ?? "auto"}`;
  const hit = contexts.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.ctx;

  const snapshot = await buildSnapshot(leagueId, userId, formatOverride);
  const ctx = await buildAnalysis(snapshot);
  contexts.set(key, { at: Date.now(), ctx });
  return ctx;
}
