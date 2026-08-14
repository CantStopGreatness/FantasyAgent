import "server-only";
import { buildAnalysis, type AnalysisContext } from "./recommend";
import { buildSnapshot } from "./league";

/**
 * Short-lived cache of assembled analysis contexts.
 *
 * Building one is cheap after the Sleeper payloads are on disk, but it still
 * re-derives z-score baselines across ~1800 players. Holding it for a few
 * minutes keeps tab switches and format toggles instant during a demo.
 */
const TTL_MS = 5 * 60 * 1000;
const contexts = new Map<string, { at: number; ctx: AnalysisContext }>();

export async function getAnalysis(
  leagueId: string,
  userId: string | null,
): Promise<AnalysisContext> {
  const key = `${leagueId}::${userId ?? "anon"}`;
  const hit = contexts.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.ctx;

  const snapshot = await buildSnapshot(leagueId, userId);
  const ctx = await buildAnalysis(snapshot);
  contexts.set(key, { at: Date.now(), ctx });
  return ctx;
}
