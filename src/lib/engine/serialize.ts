import type { SportProfile } from "@/lib/sports";
import { rateOf } from "./rates";
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
  scoreLabel: string;
  statLine: string;
  injuryStatus: string | null;
  tags: { label: string; tone: "hot" | "good" | "warn" }[];
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

/**
 * A short per-game line for the card.
 *
 * Built from the profile's counting categories so a new sport gets a sensible
 * line without touching this file, with the sport's headline ratio appended
 * when it has one.
 */
export function statLine(profile: SportProfile, rec: Recommendation): string {
  const counting = profile.categories
    .filter((c) => !c.invert && !c.volumeWeighted)
    .slice(0, 3)
    .map((c) => `${rateOf(rec.rates, c.key).toFixed(1)} ${c.label}`);

  const ratio = profile.categories.find((c) => c.volumeWeighted);
  if (ratio) {
    counting.push(`${(rateOf(rec.rates, ratio.key) * 100).toFixed(0)}% ${ratio.label}`);
  }
  return counting.join(" · ");
}

export function toCard(
  profile: SportProfile,
  rec: Recommendation,
  format: ScoringFormat,
): PlayerCard {
  return {
    playerId: rec.playerId,
    name: rec.name,
    position: rec.position,
    team: rec.team,
    rank: rec.rank,
    score: rec.score,
    scoreLabel: scoreLabel(rec.score, format),
    statLine: statLine(profile, rec),
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
