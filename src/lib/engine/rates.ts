import type { StatsBySeason } from "@/lib/sleeper/types";
import { rateOf, type PlayerRates, type SportProfile } from "@/lib/sports";

export type { PlayerRates };
export { rateOf };

/** Convert a sport's raw stat dictionary into per-game rates. */
export function ratesFromStats(
  profile: SportProfile,
  stats: StatsBySeason,
): Map<string, PlayerRates> {
  const out = new Map<string, PlayerRates>();
  for (const [playerId, line] of Object.entries(stats)) {
    // Sleeper mixes synthetic team entries (TEAM_DEN) into the same dictionary.
    if (playerId.startsWith("TEAM_")) continue;
    const rates = profile.toRates(playerId, line);
    if (rates) out.set(playerId, rates);
  }
  return out;
}

/**
 * The normalization pool: roughly "fantasy-relevant" players.
 *
 * This threshold matters more than it looks. Z-scores are only meaningful
 * relative to the population you compute them against — normalizing against
 * everyone who logged a minute would drag the means toward deep-bench
 * production and inflate every rotation player's score. Filtering to real
 * contributors keeps a replacement-level pickup scoring near 0.
 */
export function fantasyRelevant(
  profile: SportProfile,
  rates: Iterable<PlayerRates>,
): PlayerRates[] {
  const { games, minutes } = profile.poolMinimums;
  return [...rates].filter((r) => r.gp >= games && r.mpg >= minutes);
}
