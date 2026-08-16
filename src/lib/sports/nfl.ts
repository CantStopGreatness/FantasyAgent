import type { SleeperStatLine } from "@/lib/sleeper/types";
import { perGameRates, type PointScoringDef, type SportProfile } from "./types";

/** Sleeper NFL fields with exact per-game normalization in the generic engine. */
const NFL_POINTS_SCORING: PointScoringDef[] = [
  { key: "pass_yd", label: "Passing yards", rateKey: "pass_yd" },
  { key: "pass_td", label: "Passing touchdowns", rateKey: "pass_td" },
  { key: "pass_int", label: "Interceptions thrown", rateKey: "pass_int" },
  { key: "rush_yd", label: "Rushing yards", rateKey: "rush_yd" },
  { key: "rush_td", label: "Rushing touchdowns", rateKey: "rush_td" },
  { key: "rec", label: "Receptions", rateKey: "rec" },
  { key: "rec_tgt", label: "Receiving targets", rateKey: "rec_tgt" },
  { key: "rec_yd", label: "Receiving yards", rateKey: "rec_yd" },
  { key: "rec_td", label: "Receiving touchdowns", rateKey: "rec_td" },
  { key: "fum_lost", label: "Fumbles lost", rateKey: "fum_lost" },
  { key: "fgm", label: "Made field goals", rateKey: "fgm" },
  { key: "xpm", label: "Made extra points", rateKey: "xpm" },
  { key: "def_td", label: "Defensive touchdowns", rateKey: "def_td" },
  { key: "def_int", label: "Defensive interceptions", rateKey: "def_int" },
  { key: "def_sack", label: "Sacks", rateKey: "def_sack" },
  { key: "def_fum_rec", label: "Fumble recoveries", rateKey: "def_fum_rec" },
  { key: "def_ff", label: "Forced fumbles", rateKey: "def_ff" },
  { key: "def_tkl", label: "Tackles", rateKey: "def_tkl" },
  { key: "def_safe", label: "Safeties", rateKey: "def_safe" },
];

function toRates(playerId: string, line: SleeperStatLine) {
  return perGameRates(playerId, line);
}

export const nflProfile: SportProfile = {
  id: "nfl",
  label: "NFL",
  noun: "football",
  supportsCategories: false,
  categories: [],
  pointsScoring: NFL_POINTS_SCORING,
  toRates,
  positionGroups: [
    { id: "QB", label: "quarterback", matches: (p) => /^QB$/i.test(p) },
    { id: "RB", label: "running back", matches: (p) => /^(RB|FB)$/i.test(p) },
    { id: "WR", label: "wide receiver", matches: (p) => /^WR$/i.test(p) },
    { id: "TE", label: "tight end", matches: (p) => /^TE$/i.test(p) },
    { id: "K", label: "kicker", matches: (p) => /^K$/i.test(p) },
    { id: "DEF", label: "team defense", matches: (p) => /^(DEF|DST)$/i.test(p) },
  ],
  defaultPointsSettings: {
    pass_yd: 0.04,
    pass_td: 4,
    pass_int: -2,
    rush_yd: 0.1,
    rush_td: 6,
    rec: 1,
    rec_yd: 0.1,
    rec_td: 6,
    fum_lost: -2,
  },
  poolMinimums: { games: 2, minutes: 0 },
};
