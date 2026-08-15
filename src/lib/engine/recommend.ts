import { getPlayers, getSeasonStats, getTrendingAdds } from "@/lib/sleeper/client";
import type { SleeperPlayer } from "@/lib/sleeper/types";
import { getProfile, rateOf, type SportProfile } from "@/lib/sports";
import { describeForm, getRecentForm, type FormDelta } from "./form";
import { fantasyRelevant, ratesFromStats, type PlayerRates } from "./rates";
import {
  categoryLabels,
  categoryZScores,
  computeNorms,
  rankPlayers,
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
  zScores: Record<string, number> | null;
  bestCategories: { key: string; label: string; z: number }[];
  worstCategory: { key: string; label: string; z: number } | null;
  buzz: number;
  form: FormDelta | null;
  tags: ReasonTag[];
};

/** Everything needed to answer any ranking question about one league. */
export type AnalysisContext = {
  snapshot: LeagueSnapshot;
  profile: SportProfile;
  players: Record<string, SleeperPlayer>;
  rates: Map<string, PlayerRates>;
  norms: CategoryNorms;
  form: Map<string, FormDelta>;
  buzz: Record<string, number>;
  rosteredIds: Set<string>;
  pointsSettings: Record<string, number>;
  /** Rank of every pool player in each format, for cross-format deltas. */
  ranksByFormat: Record<ScoringFormat, Map<string, number>>;
};

export async function buildAnalysis(snapshot: LeagueSnapshot): Promise<AnalysisContext> {
  const profile = getProfile(snapshot.sport);
  if (!profile) throw new Error(`No scoring profile for ${snapshot.sport}`);

  const [players, stats, form, buzz] = await Promise.all([
    getPlayers(profile.id),
    getSeasonStats(profile.id, snapshot.statsSeason),
    getRecentForm(profile.id, snapshot.statsSeason),
    getTrendingAdds(profile.id),
  ]);

  const rates = ratesFromStats(profile, stats);
  const norms = computeNorms(profile, rates.values());
  const pool = fantasyRelevant(profile, rates.values());

  // A league's own point values win; fall back to the sport's defaults when
  // the league does not publish a usable scoring map.
  const settings = snapshot.scoringSettings;
  const pointsSettings =
    settings && Object.keys(settings).length > 0 ? settings : profile.defaultPointsSettings;

  // Both formats are always computed. Even with the format locked to the
  // league, the cross-format rank is what makes a recommendation explicable —
  // "69th here, 5th in points formats, and his FT% is why".
  const ranksByFormat: Record<ScoringFormat, Map<string, number>> = {
    category: new Map(
      rankPlayers(profile, pool, "category", norms, pointsSettings).map((p, i) => [
        p.playerId,
        i + 1,
      ]),
    ),
    points: new Map(
      rankPlayers(profile, pool, "points", norms, pointsSettings).map((p, i) => [
        p.playerId,
        i + 1,
      ]),
    ),
  };

  return {
    snapshot,
    profile,
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
  ctx: AnalysisContext,
  rates: PlayerRates,
  z: Record<string, number> | null,
  form: FormDelta | null,
  buzz: number,
  player: SleeperPlayer | undefined,
  format: ScoringFormat,
): ReasonTag[] {
  const tags: ReasonTag[] = [];
  const cat = (key: string) => z?.[key] ?? 0;

  if (form && form.minutesPct >= 0.15) tags.push({ label: "Minutes Up", tone: "hot" });
  if (form && form.pointsPct >= 0.25) tags.push({ label: "Scoring Surge", tone: "hot" });
  if (buzz >= 200) tags.push({ label: "League-Wide Buzz", tone: "hot" });

  if (z) {
    // Category shorthand is basketball-shaped today; guarded by key presence so
    // a sport without these categories simply produces no tag.
    if (cat("stl") + cat("blk") >= 2) tags.push({ label: "Defensive Stats", tone: "good" });
    if (cat("tpm") >= 1.2) tags.push({ label: "Three-Point Volume", tone: "good" });
    if (cat("reb") >= 1.2) tags.push({ label: "Glass Cleaner", tone: "good" });
    if (cat("ast") >= 1.2) tags.push({ label: "Playmaker", tone: "good" });
    if (cat("fgPct") >= 1) tags.push({ label: "Efficient Finisher", tone: "good" });
    if (cat("to") <= -1.2) tags.push({ label: "Turnover Prone", tone: "warn" });
    if (cat("ftPct") <= -1.2) tags.push({ label: "Drags FT%", tone: "warn" });
  } else {
    const production = ctx.profile.categories
      .filter((c) => !c.invert && !c.volumeWeighted)
      .reduce((s, c) => s + rateOf(rates, c.key), 0);
    if (rateOf(rates, "pts") >= 18) tags.push({ label: "Volume Scorer", tone: "good" });
    if (production >= 30) tags.push({ label: "Stat Stuffer", tone: "good" });
  }

  if (rates.mpg >= 30) tags.push({ label: "Heavy Minutes", tone: "good" });
  if (player?.injury_status) tags.push({ label: player.injury_status, tone: "warn" });

  // Keep cards quiet — the design brief asks for less competing metadata.
  return tags.slice(0, format === "category" ? 3 : 2);
}

function toRecommendation(
  ctx: AnalysisContext,
  rates: PlayerRates,
  score: number,
  rank: number,
  format: ScoringFormat,
): Recommendation {
  const player = ctx.players[rates.playerId];
  const labels = categoryLabels(ctx.profile);
  const zAll = categoryZScores(ctx.profile, rates, ctx.norms);
  const z = format === "category" ? zAll : null;

  const other: ScoringFormat = format === "category" ? "points" : "category";
  const otherRank = ctx.ranksByFormat[other].get(rates.playerId) ?? null;
  const thisRank = ctx.ranksByFormat[format].get(rates.playerId) ?? null;

  const ordered = ctx.profile.categories
    .map((c) => ({ key: c.key, label: labels[c.key], z: zAll[c.key] }))
    .sort((a, b) => b.z - a.z);

  const form = ctx.form.get(rates.playerId) ?? null;

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
    rankDelta: otherRank !== null && thisRank !== null ? otherRank - thisRank : null,
    rates,
    zScores: z,
    bestCategories: ordered.slice(0, 3),
    worstCategory: ordered[ordered.length - 1] ?? null,
    buzz: ctx.buzz[rates.playerId] ?? 0,
    form,
    tags: buildTags(ctx, rates, z, form, ctx.buzz[rates.playerId] ?? 0, player, format),
  };
}

/** Players with stats who are not on any roster in this league. */
function availablePool(ctx: AnalysisContext): PlayerRates[] {
  return fantasyRelevant(ctx.profile, ctx.rates.values()).filter((r) => {
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
  return rankPlayers(ctx.profile, availablePool(ctx), format, ctx.norms, ctx.pointsSettings)
    .slice(0, limit)
    .map((p, i) => toRecommendation(ctx, p.rates, p.score, i + 1, format));
}

/**
 * Sleepers: available players who are *rising* rather than merely good.
 *
 * Ranked on a blend of role trend, league-wide add velocity, and per-36
 * production that outstrips their current minutes — the profile of someone
 * about to be worth more than their box score says today.
 */
export function getSleepers(
  ctx: AnalysisContext,
  format: ScoringFormat,
  limit = 10,
): (Recommendation & { sleeperReason: string })[] {
  const pool = availablePool(ctx);
  const ranked = rankPlayers(ctx.profile, pool, format, ctx.norms, ctx.pointsSettings);
  const rankOf = new Map(ranked.map((p, i) => [p.playerId, i + 1]));
  const scoreOf = new Map(ranked.map((p) => [p.playerId, p.score]));

  const scored = pool.map((rates) => {
    const form = ctx.form.get(rates.playerId) ?? null;
    const buzz = ctx.buzz[rates.playerId] ?? 0;
    const player = ctx.players[rates.playerId];

    // Per-36 production against the minutes actually played. Computed from
    // full-season totals, so unlike the weekly splits it is stable rather than
    // sample noise.
    const production = ctx.profile.categories
      .filter((c) => !c.invert && !c.volumeWeighted)
      .reduce((s, c) => s + rateOf(rates, c.key), 0);
    const per36 = rates.mpg > 0 ? (production / rates.mpg) * 36 : 0;
    const roleUpside = rates.mpg < 28 ? per36 / 12 : 0;
    const youth = player?.age && player.age <= 24 ? 1 : 0;

    // Form is a relative change against the player's own season rate, capped
    // so one hot stretch cannot outweigh everything else on the list.
    const trend = form
      ? Math.min(Math.max(0, form.minutesPct), 0.6) * 3 +
        Math.min(Math.max(0, form.pointsPct), 0.8) * 1.5
      : 0;

    const rise = trend + Math.min(buzz / 200, 2.5) + roleUpside + youth;

    const formPhrase = form ? describeForm(form) : null;
    let reason: string;
    if (formPhrase) {
      reason = formPhrase;
    } else if (buzz >= 100) {
      reason = `Added in ${buzz.toLocaleString()} Sleeper leagues this week`;
    } else if (roleUpside > 0 && per36 >= 28) {
      reason = `${per36.toFixed(0)} combined per 36 in only ${rates.mpg.toFixed(0)} minutes a night`;
    } else if (youth) {
      reason = `Age ${player?.age} and already producing in a rotation role`;
    } else {
      reason = `Producing more than his ownership suggests`;
    }

    return { rates, rise, reason };
  });

  return scored
    .filter((s) => s.rise > 0)
    .sort((a, b) => b.rise - a.rise)
    .slice(0, limit)
    .map((s) => ({
      ...toRecommendation(
        ctx,
        s.rates,
        scoreOf.get(s.rates.playerId) ?? 0,
        rankOf.get(s.rates.playerId) ?? 0,
        format,
      ),
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

  return rankPlayers(ctx.profile, rates, format, ctx.norms, ctx.pointsSettings).map((p, i) =>
    toRecommendation(ctx, p.rates, p.score, i + 1, format),
  );
}
