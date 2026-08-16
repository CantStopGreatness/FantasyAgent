import type { SleeperStatLine } from "@/lib/sleeper/types";
import type { PlayerRates, PointScoringDef, SportProfile } from "./types";

const num = (v: number | undefined): number => (typeof v === "number" && isFinite(v) ? v : 0);

/**
 * Exact season-total fields in Sleeper's NBA player-stat payload that can also
 * appear as league point values. Every one is normalized per game by
 * toRates; keys not declared here are explicitly unsupported.
 */
const NBA_POINTS_SCORING: PointScoringDef[] = [
  { key: "pts", label: "Points", rateKey: "pts" },
  { key: "reb", label: "Rebounds", rateKey: "reb" },
  { key: "oreb", label: "Offensive rebounds", rateKey: "oreb" },
  { key: "dreb", label: "Defensive rebounds", rateKey: "dreb" },
  { key: "ast", label: "Assists", rateKey: "ast" },
  { key: "stl", label: "Steals", rateKey: "stl" },
  { key: "blk", label: "Blocks", rateKey: "blk" },
  { key: "to", label: "Turnovers", rateKey: "to" },
  { key: "tpm", label: "Three-pointers made", rateKey: "tpm" },
  { key: "tpa", label: "Three-pointers attempted", rateKey: "tpa" },
  { key: "fgm", label: "Field goals made", rateKey: "fgm" },
  { key: "fga", label: "Field goals attempted", rateKey: "fga" },
  { key: "ftm", label: "Free throws made", rateKey: "ftm" },
  { key: "fta", label: "Free throws attempted", rateKey: "fta" },
  { key: "fgmi", label: "Field goals missed", rateKey: "fgmi" },
  { key: "ftmi", label: "Free throws missed", rateKey: "ftmi" },
  { key: "tpmi", label: "Three-pointers missed", rateKey: "tpmi" },
  { key: "pf", label: "Personal fouls", rateKey: "pf" },
  { key: "ff", label: "Flagrant fouls", rateKey: "ff" },
  { key: "tf", label: "Technical fouls", rateKey: "tf" },
  { key: "dd", label: "Double-doubles", rateKey: "dd" },
  { key: "td", label: "Triple-doubles", rateKey: "td" },
  { key: "blk_stl", label: "Blocks + steals", rateKey: "blk_stl" },
  { key: "pts_reb", label: "Points + rebounds", rateKey: "pts_reb" },
  { key: "reb_ast", label: "Rebounds + assists", rateKey: "reb_ast" },
  { key: "pts_ast", label: "Points + assists", rateKey: "pts_ast" },
  {
    key: "pts_reb_ast",
    label: "Points + rebounds + assists",
    rateKey: "pts_reb_ast",
  },
];

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
  const pointsRates = Object.fromEntries(
    NBA_POINTS_SCORING.map((stat) => [stat.rateKey, per(line[stat.key])]),
  );

  return {
    playerId,
    gp,
    mpg: num(line.sp) / 60 / gp,
    ...pointsRates,
    fgPct: fga > 0 ? fgm / fga : 0,
    ftPct: fta > 0 ? ftm / fta : 0,
  };
}

export const nbaProfile: SportProfile = {
  id: "nba",
  label: "NBA",
  noun: "basketball",
  supportsCategories: true,
  pointsScoring: NBA_POINTS_SCORING,

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
