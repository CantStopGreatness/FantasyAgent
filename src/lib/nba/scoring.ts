import { fantasyRelevant, type PlayerRates } from "./rates";

export type ScoringFormat = "category" | "points";

/** The nine standard roto categories. */
export type CategoryKey = "pts" | "reb" | "ast" | "stl" | "blk" | "tpm" | "fgPct" | "ftPct" | "to";

export const CATEGORY_KEYS: CategoryKey[] = [
  "pts",
  "reb",
  "ast",
  "stl",
  "blk",
  "tpm",
  "fgPct",
  "ftPct",
  "to",
];

export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  pts: "PTS",
  reb: "REB",
  ast: "AST",
  stl: "STL",
  blk: "BLK",
  tpm: "3PM",
  fgPct: "FG%",
  ftPct: "FT%",
  to: "TO",
};

/**
 * Sleeper's default NBA points scoring, used when a league does not expose
 * per-stat values. Overridden by the league's real `scoring_settings`.
 */
export const DEFAULT_POINTS_SETTINGS: Record<string, number> = {
  pts: 1,
  reb: 1.2,
  ast: 1.5,
  stl: 3,
  blk: 3,
  to: -1,
};

/* ── Points scoring ─────────────────────────────────────────────────────── */

/**
 * Weight a player's per-game line by the league's own point values.
 *
 * Points leagues are just weighted raw production: no normalization, no
 * efficiency penalty beyond whatever the league assigns to turnovers. That is
 * exactly why a high-volume, low-efficiency scorer thrives here.
 */
export function pointsScore(
  rates: PlayerRates,
  settings: Record<string, number> = DEFAULT_POINTS_SETTINGS,
): number {
  let total = 0;
  for (const [stat, weight] of Object.entries(settings)) {
    if (typeof weight !== "number" || !isFinite(weight)) continue;
    const value = (rates as unknown as Record<string, number | undefined>)[stat];
    if (typeof value === "number" && isFinite(value)) total += value * weight;
  }
  return total;
}

/* ── Category (9-CAT) scoring ───────────────────────────────────────────── */

export type CategoryNorms = {
  mean: Record<CategoryKey, number>;
  stdDev: Record<CategoryKey, number>;
  /** Pool-wide shooting rates, the baseline each player's efficiency is judged against. */
  poolFgPct: number;
  poolFtPct: number;
  poolSize: number;
};

function meanOf(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDevOf(values: number[], mean: number): number {
  if (values.length < 2) return 0;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Volume-weighted shooting impact.
 *
 * Raw FG% is a trap for fantasy value: a bench big shooting 70% on 3 attempts
 * moves your team's ratio far less than a starter shooting 52% on 20. We score
 * the *swing a player applies to the pool baseline*, scaled by their volume.
 */
function shootingImpact(made: number, attempted: number, poolPct: number): number {
  return (made - attempted * poolPct);
}

/** Compute the normalization baselines from the fantasy-relevant player pool. */
export function computeNorms(allRates: Iterable<PlayerRates>): CategoryNorms {
  const pool = fantasyRelevant(allRates);

  const totalFgm = pool.reduce((s, p) => s + p.fgm, 0);
  const totalFga = pool.reduce((s, p) => s + p.fga, 0);
  const totalFtm = pool.reduce((s, p) => s + p.ftm, 0);
  const totalFta = pool.reduce((s, p) => s + p.fta, 0);
  const poolFgPct = totalFga > 0 ? totalFgm / totalFga : 0;
  const poolFtPct = totalFta > 0 ? totalFtm / totalFta : 0;

  const series: Record<CategoryKey, number[]> = {
    pts: pool.map((p) => p.pts),
    reb: pool.map((p) => p.reb),
    ast: pool.map((p) => p.ast),
    stl: pool.map((p) => p.stl),
    blk: pool.map((p) => p.blk),
    tpm: pool.map((p) => p.tpm),
    to: pool.map((p) => p.to),
    fgPct: pool.map((p) => shootingImpact(p.fgm, p.fga, poolFgPct)),
    ftPct: pool.map((p) => shootingImpact(p.ftm, p.fta, poolFtPct)),
  };

  const mean = {} as Record<CategoryKey, number>;
  const stdDev = {} as Record<CategoryKey, number>;
  for (const key of CATEGORY_KEYS) {
    mean[key] = meanOf(series[key]);
    stdDev[key] = stdDevOf(series[key], mean[key]);
  }

  return { mean, stdDev, poolFgPct, poolFtPct, poolSize: pool.length };
}

/** The raw value that gets z-scored for a given category. */
function categoryValue(rates: PlayerRates, key: CategoryKey, norms: CategoryNorms): number {
  if (key === "fgPct") return shootingImpact(rates.fgm, rates.fga, norms.poolFgPct);
  if (key === "ftPct") return shootingImpact(rates.ftm, rates.fta, norms.poolFtPct);
  return rates[key];
}

/**
 * Per-category z-scores for one player.
 *
 * Turnovers are inverted: fewer turnovers is *better*, so a player below the
 * pool mean must produce a positive z. Every other category keeps its natural
 * direction. Getting this backwards silently rewards the most careless players
 * in the league, which is exactly the kind of bug that survives a demo.
 */
export function categoryZScores(
  rates: PlayerRates,
  norms: CategoryNorms,
): Record<CategoryKey, number> {
  const z = {} as Record<CategoryKey, number>;
  for (const key of CATEGORY_KEYS) {
    const sd = norms.stdDev[key];
    if (sd <= 0) {
      z[key] = 0;
      continue;
    }
    const raw = (categoryValue(rates, key, norms) - norms.mean[key]) / sd;
    z[key] = key === "to" ? -raw : raw;
  }
  return z;
}

export function categoryScore(rates: PlayerRates, norms: CategoryNorms): number {
  const z = categoryZScores(rates, norms);
  return CATEGORY_KEYS.reduce((sum, key) => sum + z[key], 0);
}

/* ── Unified entry point ────────────────────────────────────────────────── */

export type ScoredPlayer = {
  playerId: string;
  rates: PlayerRates;
  score: number;
  /** Populated for category format only. */
  zScores: Record<CategoryKey, number> | null;
};

export function scorePlayer(
  rates: PlayerRates,
  format: ScoringFormat,
  norms: CategoryNorms,
  pointsSettings?: Record<string, number>,
): ScoredPlayer {
  if (format === "points") {
    return {
      playerId: rates.playerId,
      rates,
      score: pointsScore(rates, pointsSettings),
      zScores: null,
    };
  }
  return {
    playerId: rates.playerId,
    rates,
    score: categoryScore(rates, norms),
    zScores: categoryZScores(rates, norms),
  };
}

export function rankPlayers(
  candidates: PlayerRates[],
  format: ScoringFormat,
  norms: CategoryNorms,
  pointsSettings?: Record<string, number>,
): ScoredPlayer[] {
  return candidates
    .map((r) => scorePlayer(r, format, norms, pointsSettings))
    .sort((a, b) => b.score - a.score);
}

/**
 * Detect a league's format from its Sleeper settings.
 *
 * Sleeper does not expose a clean "this is a 9-CAT league" flag, so this is a
 * best-effort read: category leagues score the roto stats at 1 point each with
 * no fractional weights, points leagues assign real per-stat values. The UI
 * toggle is authoritative — this only picks the starting position.
 */
export function detectFormat(scoringSettings: Record<string, number> | null): ScoringFormat {
  if (!scoringSettings || Object.keys(scoringSettings).length === 0) return "category";

  const weights = Object.entries(scoringSettings).filter(
    ([, v]) => typeof v === "number" && v !== 0,
  );
  if (!weights.length) return "category";

  // Fractional or negative weights are the signature of a points league.
  const hasFractional = weights.some(([, v]) => !Number.isInteger(v));
  const hasNegative = weights.some(([, v]) => v < 0);
  if (hasFractional || hasNegative) return "points";

  return "category";
}
