import { fantasyRelevant, rateOf, type PlayerRates } from "./rates";
import { pointScoringRate, type CategoryDef, type SportProfile } from "@/lib/sports";

export type ScoringFormat = "category" | "points";

/* ── Points scoring ─────────────────────────────────────────────────────── */

/**
 * Weight a player's per-game line by the league's own point values.
 *
 * Points leagues are just weighted raw production: no normalization, no
 * efficiency penalty beyond whatever the league assigns to turnovers. That is
 * exactly why a high-volume, low-efficiency scorer thrives here.
 */
export function pointsScore(
  profile: SportProfile,
  rates: PlayerRates,
  settings: Record<string, number>,
): number {
  let total = 0;
  for (const [stat, weight] of Object.entries(settings)) {
    if (typeof weight !== "number" || !isFinite(weight)) continue;
    const rate = pointScoringRate(profile, rates, stat);
    if (rate === null) continue;
    total += rate * weight;
  }
  return total;
}

/* ── Category scoring ───────────────────────────────────────────────────── */

export type CategoryNorms = {
  mean: Record<string, number>;
  stdDev: Record<string, number>;
  /** Pool-wide baseline for each volume-weighted ratio category. */
  poolRatio: Record<string, number>;
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
 * Raw percentages are a trap for fantasy value: a bench big shooting 70% on
 * three attempts moves your team's ratio far less than a starter shooting 52%
 * on twenty. We score the *swing a player applies to the pool baseline*,
 * scaled by their volume.
 */
function ratioImpact(rates: PlayerRates, cat: CategoryDef, poolPct: number): number {
  if (!cat.volume) return 0;
  const made = rateOf(rates, cat.volume.made);
  const attempted = rateOf(rates, cat.volume.attempted);
  return made - attempted * poolPct;
}

/** The raw value that gets z-scored for a given category. */
function categoryValue(
  rates: PlayerRates,
  cat: CategoryDef,
  norms: Pick<CategoryNorms, "poolRatio">,
): number {
  if (cat.volumeWeighted) return ratioImpact(rates, cat, norms.poolRatio[cat.key] ?? 0);
  return rateOf(rates, cat.key);
}

/** Compute normalization baselines from the fantasy-relevant player pool. */
export function computeNorms(
  profile: SportProfile,
  allRates: Iterable<PlayerRates>,
): CategoryNorms {
  const pool = fantasyRelevant(profile, allRates);

  const poolRatio: Record<string, number> = {};
  for (const cat of profile.categories) {
    if (!cat.volumeWeighted || !cat.volume) continue;
    const made = pool.reduce((s, p) => s + rateOf(p, cat.volume!.made), 0);
    const attempted = pool.reduce((s, p) => s + rateOf(p, cat.volume!.attempted), 0);
    poolRatio[cat.key] = attempted > 0 ? made / attempted : 0;
  }

  const mean: Record<string, number> = {};
  const stdDev: Record<string, number> = {};
  for (const cat of profile.categories) {
    const series = pool.map((p) => categoryValue(p, cat, { poolRatio }));
    mean[cat.key] = meanOf(series);
    stdDev[cat.key] = stdDevOf(series, mean[cat.key]);
  }

  return { mean, stdDev, poolRatio, poolSize: pool.length };
}

/**
 * Per-category z-scores for one player.
 *
 * Inverted categories flip sign: for turnovers, a player below the pool mean
 * must produce a positive z. Getting this backwards silently rewards the most
 * careless players in the league — exactly the kind of bug that survives a
 * demo, so the profile declares it and the verify script asserts it.
 */
export function categoryZScores(
  profile: SportProfile,
  rates: PlayerRates,
  norms: CategoryNorms,
): Record<string, number> {
  const z: Record<string, number> = {};
  for (const cat of profile.categories) {
    const sd = norms.stdDev[cat.key];
    if (!sd || sd <= 0) {
      z[cat.key] = 0;
      continue;
    }
    const raw = (categoryValue(rates, cat, norms) - norms.mean[cat.key]) / sd;
    z[cat.key] = cat.invert ? -raw : raw;
  }
  return z;
}

export function categoryScore(
  profile: SportProfile,
  rates: PlayerRates,
  norms: CategoryNorms,
): number {
  const z = categoryZScores(profile, rates, norms);
  return profile.categories.reduce((sum, cat) => sum + z[cat.key], 0);
}

/* ── Unified entry point ────────────────────────────────────────────────── */

export type ScoredPlayer = {
  playerId: string;
  rates: PlayerRates;
  score: number;
  /** Populated for category format only. */
  zScores: Record<string, number> | null;
};

export function scorePlayer(
  profile: SportProfile,
  rates: PlayerRates,
  format: ScoringFormat,
  norms: CategoryNorms,
  pointsSettings: Record<string, number>,
): ScoredPlayer {
  if (format === "points") {
    return {
      playerId: rates.playerId,
      rates,
      score: pointsScore(profile, rates, pointsSettings),
      zScores: null,
    };
  }
  return {
    playerId: rates.playerId,
    rates,
    score: categoryScore(profile, rates, norms),
    zScores: categoryZScores(profile, rates, norms),
  };
}

export function rankPlayers(
  profile: SportProfile,
  candidates: PlayerRates[],
  format: ScoringFormat,
  norms: CategoryNorms,
  pointsSettings: Record<string, number>,
): ScoredPlayer[] {
  return candidates
    .map((r) => scorePlayer(profile, r, format, norms, pointsSettings))
    .sort((a, b) => b.score - a.score);
}

/**
 * Best-effort read of a league's scoring format from its Sleeper settings.
 *
 * Sleeper publishes no category-vs-points flag and does not document the
 * scoring_settings object at all, so this is inference: fractional or negative
 * per-stat weights are the signature of a points league, while category
 * leagues tend to score the roto stats flat.
 *
 * Because this is a guess on undocumented data, the setup screen shows the
 * result and lets the user correct it. Never treat it as authoritative without
 * that confirmation step.
 */
export function detectFormat(
  profile: SportProfile,
  scoringSettings: Record<string, number> | null,
): ScoringFormat {
  // A sport with no category concept (NFL) can only be points.
  if (!profile.supportsCategories) return "points";
  if (!scoringSettings || Object.keys(scoringSettings).length === 0) return "category";

  const weights = Object.entries(scoringSettings).filter(
    ([, v]) => typeof v === "number" && v !== 0,
  );
  if (!weights.length) return "category";

  const hasFractional = weights.some(([, v]) => !Number.isInteger(v));
  const hasNegative = weights.some(([, v]) => v < 0);
  return hasFractional || hasNegative ? "points" : "category";
}

/** Category labels for display, keyed by category id. */
export function categoryLabels(profile: SportProfile): Record<string, string> {
  return Object.fromEntries(profile.categories.map((c) => [c.key, c.label]));
}
