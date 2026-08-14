import { getPlayers, getSeasonStats, getTrendingAdds } from "@/lib/sleeper/client";
import type { SleeperPlayer } from "@/lib/sleeper/types";
import { formDelta, getRecentForm, type FormDelta, type RecentForm } from "./form";
import { fantasyRelevant, ratesFromStats, type PlayerRates } from "./rates";
import {
  CATEGORY_KEYS,
  CATEGORY_LABELS,
  categoryZScores,
  computeNorms,
  DEFAULT_POINTS_SETTINGS,
  rankPlayers,
  type CategoryKey,
  type CategoryNorms,
  type ScoringFormat,
} from "./scoring";
import type { LeagueSnapshot } from "./league";

export type ReasonTag = {
  label: string;
  /** Drives the chip colour: hot = urgent/orange, good = teal, warn = red. */
  tone: "hot" | "good" | "warn";
};

export type Recommendation = {
  playerId: string;
  name: string;
  position: string;
  team: string;
  injuryStatus: string | null;
  age: number | null;
  score: number;
  rank: number;
  /** This player's rank under the *other* scoring format. */
  otherFormatRank: number | null;
  /** Positive means this format rates them higher than the other one does. */
  rankDelta: number | null;
  rates: PlayerRates;
  zScores: Record<CategoryKey, number> | null;
  /** Strongest and weakest categories, for the card's stat strip. */
  bestCategories: { key: CategoryKey; label: string; z: number }[];
  worstCategory: { key: CategoryKey; label: string; z: number } | null;
  buzz: number;
  form: FormDelta | null;
  tags: ReasonTag[];
};

/** Everything needed to answer any ranking question about one league. */
export type AnalysisContext = {
  snapshot: LeagueSnapshot;
  players: Record<string, SleeperPlayer>;
  rates: Map<string, PlayerRates>;
  norms: CategoryNorms;
  form: Map<string, RecentForm>;
  buzz: Record<string, number>;
  rosteredIds: Set<string>;
  pointsSettings: Record<string, number>;
  /** Rank of every pool player in each format, for cross-format deltas. */
  ranksByFormat: Record<ScoringFormat, Map<string, number>>;
};

export async function buildAnalysis(snapshot: LeagueSnapshot): Promise<AnalysisContext> {
  const [players, stats, form, buzz] = await Promise.all([
    getPlayers(),
    getSeasonStats(snapshot.statsSeason),
    getRecentForm(snapshot.statsSeason),
    getTrendingAdds(),
  ]);

  const rates = ratesFromStats(stats);
  const norms = computeNorms(rates.values());
  const pool = fantasyRelevant(rates.values());

  // A league's own point values win; fall back to Sleeper's NBA defaults when
  // the league does not publish a usable scoring map.
  const settings = snapshot.scoringSettings;
  const pointsSettings =
    settings && Object.keys(settings).length > 0 ? settings : DEFAULT_POINTS_SETTINGS;

  const ranksByFormat: Record<ScoringFormat, Map<string, number>> = {
    category: new Map(
      rankPlayers(pool, "category", norms).map((p, i) => [p.playerId, i + 1]),
    ),
    points: new Map(
      rankPlayers(pool, "points", norms, pointsSettings).map((p, i) => [p.playerId, i + 1]),
    ),
  };

  return {
    snapshot,
    players,
    rates,
    norms,
    form,
    buzz,
    rosteredIds: new Set(snapshot.rosteredIds),
    pointsSettings,
    ranksByFormat,
  };
}

/* ── Reason tags ─────────────────────────────────────────────────────────
 * Deterministic and rule-based, exactly like the ranking itself. The AI layer
 * narrates these; it never invents them.
 */

function buildTags(
  rates: PlayerRates,
  z: Record<CategoryKey, number> | null,
  form: FormDelta | null,
  buzz: number,
  player: SleeperPlayer | undefined,
  format: ScoringFormat,
): ReasonTag[] {
  const tags: ReasonTag[] = [];

  if (form && form.minutes >= 3) tags.push({ label: "Minutes Up", tone: "hot" });
  if (form && form.points >= 4) tags.push({ label: "Scoring Surge", tone: "hot" });
  if (buzz >= 200) tags.push({ label: "League-Wide Buzz", tone: "hot" });

  if (z) {
    if (z.stl + z.blk >= 2) tags.push({ label: "Defensive Stats", tone: "good" });
    if (z.tpm >= 1.2) tags.push({ label: "Three-Point Volume", tone: "good" });
    if (z.reb >= 1.2) tags.push({ label: "Glass Cleaner", tone: "good" });
    if (z.ast >= 1.2) tags.push({ label: "Playmaker", tone: "good" });
    if (z.fgPct >= 1) tags.push({ label: "Efficient Finisher", tone: "good" });
    if (z.to <= -1.2) tags.push({ label: "Turnover Prone", tone: "warn" });
    if (z.ftPct <= -1.2) tags.push({ label: "Drags FT%", tone: "warn" });
  } else {
    // Points format: volume is the whole story.
    if (rates.pts >= 18) tags.push({ label: "Volume Scorer", tone: "good" });
    if (rates.pts + rates.reb + rates.ast >= 30) {
      tags.push({ label: "Stat Stuffer", tone: "good" });
    }
  }

  if (rates.mpg >= 30) tags.push({ label: "Heavy Minutes", tone: "good" });
  if (player?.injury_status) {
    tags.push({ label: player.injury_status, tone: "warn" });
  }

  // Keep cards quiet — the spec explicitly asks for less competing metadata.
  const limit = format === "category" ? 3 : 2;
  return tags.slice(0, limit);
}

function toRecommendation(
  ctx: AnalysisContext,
  rates: PlayerRates,
  score: number,
  rank: number,
  format: ScoringFormat,
): Recommendation {
  const player = ctx.players[rates.playerId];
  const z = format === "category" ? categoryZScores(rates, ctx.norms) : null;
  const other: ScoringFormat = format === "category" ? "points" : "category";
  const otherRank = ctx.ranksByFormat[other].get(rates.playerId) ?? null;
  const thisPoolRank = ctx.ranksByFormat[format].get(rates.playerId) ?? null;

  const zForDisplay = z ?? categoryZScores(rates, ctx.norms);
  const ordered = CATEGORY_KEYS.map((key) => ({
    key,
    label: CATEGORY_LABELS[key],
    z: zForDisplay[key],
  })).sort((a, b) => b.z - a.z);

  const delta =
    otherRank !== null && thisPoolRank !== null ? otherRank - thisPoolRank : null;

  return {
    playerId: rates.playerId,
    name: player?.full_name ?? `Player ${rates.playerId}`,
    position: player?.fantasy_positions?.[0] ?? "—",
    team: player?.team ?? "FA",
    injuryStatus: player?.injury_status ?? null,
    age: player?.age ?? null,
    score,
    rank,
    otherFormatRank: otherRank,
    rankDelta: delta,
    rates,
    zScores: z,
    bestCategories: ordered.slice(0, 3),
    worstCategory: ordered[ordered.length - 1] ?? null,
    buzz: ctx.buzz[rates.playerId] ?? 0,
    form: formDelta(rates, ctx.form.get(rates.playerId)),
    tags: buildTags(
      rates,
      z,
      formDelta(rates, ctx.form.get(rates.playerId)),
      ctx.buzz[rates.playerId] ?? 0,
      player,
      format,
    ),
  };
}

/** Players with stats who are not on any roster in this league. */
function availablePool(ctx: AnalysisContext): PlayerRates[] {
  return fantasyRelevant(ctx.rates.values()).filter((r) => {
    if (ctx.rosteredIds.has(r.playerId)) return false;
    const p = ctx.players[r.playerId];
    return Boolean(p && p.active);
  });
}

export function getWaiverRecommendations(
  ctx: AnalysisContext,
  format: ScoringFormat,
  limit = 12,
): Recommendation[] {
  const ranked = rankPlayers(availablePool(ctx), format, ctx.norms, ctx.pointsSettings);
  return ranked
    .slice(0, limit)
    .map((p, i) => toRecommendation(ctx, p.rates, p.score, i + 1, format));
}

/**
 * Sleepers: available players who are *rising* rather than merely good.
 *
 * Ranked by a blend of recent-minutes trend, league-wide add velocity, and
 * per-36 production that outstrips their current role — the profile of someone
 * about to be worth more than their box score says today.
 */
export function getSleepers(
  ctx: AnalysisContext,
  format: ScoringFormat,
  limit = 10,
): (Recommendation & { sleeperReason: string })[] {
  const pool = availablePool(ctx);
  const ranked = rankPlayers(pool, format, ctx.norms, ctx.pointsSettings);
  const rankOf = new Map(ranked.map((p, i) => [p.playerId, i + 1]));

  const scored = pool.map((rates) => {
    const form = formDelta(rates, ctx.form.get(rates.playerId));
    const buzz = ctx.buzz[rates.playerId] ?? 0;
    const player = ctx.players[rates.playerId];

    // Per-36 production relative to the minutes they actually play: a young
    // player producing at a high per-36 rate in a small role is the classic
    // breakout shape.
    const per36 = rates.mpg > 0 ? ((rates.pts + rates.reb + rates.ast) / rates.mpg) * 36 : 0;
    const roleUpside = rates.mpg < 28 ? per36 / 10 : 0;
    const youth = player?.age && player.age <= 24 ? 1.2 : 0;

    const rise =
      (form ? Math.max(0, form.minutes) * 0.8 + Math.max(0, form.points) * 0.5 : 0) +
      Math.min(buzz / 150, 3) +
      roleUpside +
      youth;

    let reason: string;
    if (form && form.minutes >= 3) {
      reason = `Minutes up ${form.minutes.toFixed(1)}/g in late-season action`;
    } else if (form && form.points >= 3) {
      reason = `Scoring up ${form.points.toFixed(1)}/g down the stretch`;
    } else if (buzz >= 100) {
      reason = `Added in ${buzz.toLocaleString()} Sleeper leagues this week`;
    } else if (roleUpside > 0 && per36 >= 28) {
      reason = `${per36.toFixed(0)} PRA per 36 in only ${rates.mpg.toFixed(0)} minutes`;
    } else if (youth) {
      reason = `Age ${player?.age} with a growing role`;
    } else {
      reason = `Producing above his roster share`;
    }

    return { rates, rise, reason };
  });

  return scored
    .filter((s) => s.rise > 0)
    .sort((a, b) => b.rise - a.rise)
    .slice(0, limit)
    .map((s, i) => ({
      ...toRecommendation(
        ctx,
        s.rates,
        ranked.find((r) => r.playerId === s.rates.playerId)?.score ?? 0,
        i + 1,
        format,
      ),
      rank: rankOf.get(s.rates.playerId) ?? i + 1,
      sleeperReason: s.reason,
    }));
}

/** A roster, scored and sorted under the active format. */
export function getTeamRoster(
  ctx: AnalysisContext,
  rosterId: number,
  format: ScoringFormat,
): Recommendation[] {
  const team = ctx.snapshot.teams.find((t) => t.rosterId === rosterId);
  if (!team) return [];

  const rates = team.playerIds
    .map((id) => ctx.rates.get(id))
    .filter((r): r is PlayerRates => Boolean(r));

  return rankPlayers(rates, format, ctx.norms, ctx.pointsSettings).map((p, i) =>
    toRecommendation(ctx, p.rates, p.score, i + 1, format),
  );
}
