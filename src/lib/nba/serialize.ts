import type { Recommendation } from "./recommend";
import type { ScoringFormat } from "./scoring";

/** The card shape the UI renders. Deliberately lean — see the density notes. */
export type PlayerCard = {
  playerId: string;
  name: string;
  position: string;
  team: string;
  rank: number;
  score: number;
  /** Formatted for display so the client never re-derives scoring units. */
  scoreLabel: string;
  statLine: string;
  injuryStatus: string | null;
  tags: { label: string; tone: "hot" | "good" | "warn" }[];
  /** Rank movement vs the other scoring format; null when not comparable. */
  rankDelta: number | null;
  otherFormatRank: number | null;
  topCategories: { label: string; z: number }[];
  buzz: number;
};

/**
 * Category scores are z-score sums (small, signed); points scores are raw
 * fantasy points (large, positive). Label them so a "+4.8" is never mistaken
 * for a points total.
 */
export function scoreLabel(score: number, format: ScoringFormat): string {
  return format === "category"
    ? `${score >= 0 ? "+" : ""}${score.toFixed(1)}`
    : score.toFixed(1);
}

export function statLine(rec: Recommendation): string {
  const r = rec.rates;
  return `${r.pts.toFixed(1)} PTS · ${r.reb.toFixed(1)} REB · ${r.ast.toFixed(1)} AST · ${(r.fgPct * 100).toFixed(0)}% FG`;
}

export function toCard(rec: Recommendation, format: ScoringFormat): PlayerCard {
  return {
    playerId: rec.playerId,
    name: rec.name,
    position: rec.position,
    team: rec.team,
    rank: rec.rank,
    score: rec.score,
    scoreLabel: scoreLabel(rec.score, format),
    statLine: statLine(rec),
    injuryStatus: rec.injuryStatus,
    tags: rec.tags,
    rankDelta: rec.rankDelta,
    otherFormatRank: rec.otherFormatRank,
    topCategories: rec.bestCategories.map((c) => ({ label: c.label, z: c.z })),
    buzz: rec.buzz,
  };
}

/** A compact, human-readable summary of a player's best categories. */
export function strengthsPhrase(rec: Recommendation): string {
  return rec.bestCategories
    .map((c) => `${c.label} ${c.z >= 0 ? "+" : ""}${c.z.toFixed(1)} z`)
    .join(", ");
}

export function weaknessPhrase(rec: Recommendation): string | null {
  const w = rec.worstCategory;
  if (!w || w.z > -0.5) return null;
  return `${w.label} ${w.z.toFixed(1)} z`;
}
