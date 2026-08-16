import type { SleeperStatLine } from "@/lib/sleeper/types";

/** Sports Sleeper serves player and stat data for. */
export type SportId = "nba" | "nfl" | "nhl" | "mlb";

/**
 * One scoring category, plus the two rules that are easy to get wrong.
 *
 * `invert` marks a category where less is better — turnovers in basketball,
 * ERA and WHIP if baseball ever lands. Without it the engine silently rewards
 * the most careless players in the league.
 *
 * `volumeWeighted` marks a ratio category that must be scored as the swing a
 * player applies to the pool baseline rather than as a raw percentage.
 * Otherwise a bench big shooting 70% on three attempts outranks a starter
 * shooting 52% on twenty.
 */
export type CategoryDef = {
  key: string;
  label: string;
  invert?: boolean;
  volumeWeighted?: boolean;
  /** For volume-weighted ratios: the made/attempted fields backing the rate. */
  volume?: { made: string; attempted: string };
};

/** A roster slot family used for reading positional surplus and need. */
export type PositionGroupDef = {
  id: string;
  label: string;
  matches: (position: string) => boolean;
};

/**
 * One points-league scoring key CourtIQ can evaluate exactly.
 *
 * rateKey names the normalized per-game value placed on PlayerRates.
 * Keeping this mapping in the sport profile makes support an engine contract,
 * rather than an assumption made independently by the scorer and UI.
 */
export type PointScoringDef = {
  key: string;
  label: string;
  rateKey: string;
};

/**
 * Everything the engine needs to know about a sport.
 *
 * The math around these — z-scores, weighted points, positional imbalance —
 * is sport-agnostic. This is the part that is not.
 */
export type SportProfile = {
  id: SportId;
  /** Short display label, e.g. "NBA". */
  label: string;
  /** Used in prose and the analyst persona, e.g. "basketball". */
  noun: string;
  /**
   * Whether category scoring exists for this sport at all. NFL is points-only,
   * so a "category vs points" question is meaningless there.
   */
  supportsCategories: boolean;
  categories: CategoryDef[];
  /** Imported points-scoring keys backed by exact upstream player stats. */
  pointsScoring: PointScoringDef[];
  /** Convert one Sleeper stat line into per-game rates, or null if unusable. */
  toRates: (playerId: string, line: SleeperStatLine) => PlayerRates | null;
  positionGroups: PositionGroupDef[];
  /** Used when a league does not publish a usable scoring map. */
  defaultPointsSettings: Record<string, number>;
  /** Minimum games and playing time to count toward normalization baselines. */
  poolMinimums: { games: number; minutes: number };
};

/**
 * A player's production per game, plus the raw volume behind any ratio
 * categories. Keys beyond the fixed ones are sport-defined.
 */
export type PlayerRates = {
  playerId: string;
  gp: number;
  /** Playing time per game. Minutes in most sports; 0 where not tracked. */
  mpg: number;
  [stat: string]: number | string;
};

/** Read a numeric stat off a rates object without fighting the index signature. */
export function rateOf(rates: PlayerRates, key: string): number {
  const v = rates[key];
  return typeof v === "number" && isFinite(v) ? v : 0;
}

/** The declared scoring definition for an imported key, if CourtIQ supports it. */
export function pointScoringDef(
  profile: SportProfile,
  key: string,
): PointScoringDef | null {
  return profile.pointsScoring.find((stat) => stat.key === key) ?? null;
}

export function isScoringKeySupported(profile: SportProfile, key: string): boolean {
  return pointScoringDef(profile, key) !== null;
}

/**
 * Read the normalized rate promised by the sport profile.
 *
 * Unsupported keys return null. A declared key with no numeric rate is a
 * broken profile and throws instead of silently behaving like a zero.
 */
export function pointScoringRate(
  profile: SportProfile,
  rates: PlayerRates,
  key: string,
): number | null {
  const def = pointScoringDef(profile, key);
  if (!def) return null;

  const value = rates[def.rateKey];
  if (typeof value !== "number" || !isFinite(value)) {
    throw new Error(
      'Supported scoring key "' + key + '" has no numeric player rate "' + def.rateKey + '"',
    );
  }
  return value;
}
