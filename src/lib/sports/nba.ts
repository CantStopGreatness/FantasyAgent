import type { SleeperStatLine } from "@/lib/sleeper/types";
import type { PlayerRates, SportProfile } from "./types";

const num = (v: number | undefined): number => (typeof v === "number" && isFinite(v) ? v : 0);

/**
 * Sleeper returns season *totals* plus `gp`, and playing time as `sp` in
 * seconds — not minutes. Everything here is derived from that.
 */
function toRates(playerId: string, line: SleeperStatLine): PlayerRates | null {
  const gp = num(line.gp);
  if (gp <= 0) return null;

  const per = (v: number | undefined) => num(v) / gp;
  const fga = per(line.fga);
  const fta = per(line.fta);
  const fgm = per(line.fgm);
  const ftm = per(line.ftm);

  return {
    playerId,
    gp,
    mpg: num(line.sp) / 60 / gp,
    pts: per(line.pts),
    reb: per(line.reb),
    ast: per(line.ast),
    stl: per(line.stl),
    blk: per(line.blk),
    to: per(line.to),
    tpm: per(line.tpm),
    fgm,
    fga,
    ftm,
    fta,
    fgPct: fga > 0 ? fgm / fga : 0,
    ftPct: fta > 0 ? ftm / fta : 0,
  };
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
