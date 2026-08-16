import type { SleeperStatLine } from "@/lib/sleeper/types";
import { perGameRates, rateOf, type PlayerRates, type SportProfile } from "./types";

/**
 * Sleeper returns season *totals* plus `gp`, and playing time as `sp` in
 * seconds — not minutes.
 *
 * Every numeric stat passes through as a per-game rate so a league scoring
 * double-doubles, technicals or point bonuses gets real numbers rather than
 * zeros; the shooting percentages are the only derived additions.
 */
function toRates(playerId: string, line: SleeperStatLine): PlayerRates | null {
  const rates = perGameRates(playerId, line);
  if (!rates) return null;

  const fga = rateOf(rates, "fga");
  const fta = rateOf(rates, "fta");
  rates.fgPct = fga > 0 ? rateOf(rates, "fgm") / fga : 0;
  rates.ftPct = fta > 0 ? rateOf(rates, "ftm") / fta : 0;
  return rates;
}

export const nbaProfile: SportProfile = {
  id: "nba",
  label: "NBA",
  noun: "basketball",
  supportsCategories: true,

  // The nine standard roto categories.
  categories: [
    { key: "pts", label: "PTS" },
    { key: "reb", label: "REB" },
    { key: "ast", label: "AST" },
    { key: "stl", label: "STL" },
    { key: "blk", label: "BLK" },
    { key: "tpm", label: "3PM" },
    {
      key: "fgPct",
      label: "FG%",
      volumeWeighted: true,
      volume: { made: "fgm", attempted: "fga" },
    },
    {
      key: "ftPct",
      label: "FT%",
      volumeWeighted: true,
      volume: { made: "ftm", attempted: "fta" },
    },
    // Fewer turnovers is better.
    { key: "to", label: "TO", invert: true },
  ],

  toRates,

  positionGroups: [
    { id: "G", label: "guard", matches: (p) => /^(PG|SG|G)$/i.test(p) },
    { id: "F", label: "forward", matches: (p) => /^(SF|PF|F)$/i.test(p) },
    { id: "C", label: "center", matches: (p) => /^C/i.test(p) },
  ],

  defaultPointsSettings: { pts: 1, reb: 1.2, ast: 1.5, stl: 3, blk: 3, to: -1 },

  // Normalizing against all ~1800 players who logged a minute would drag the
  // means toward deep-bench production and inflate everyone's z-scores.
  poolMinimums: { games: 15, minutes: 14 },
};
