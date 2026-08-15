import type { SportProfile } from "@/lib/sports";
import type { AnalysisContext, Recommendation } from "./recommend";
import { getTeamRoster } from "./recommend";
import { categoryZScores, type ScoringFormat } from "./scoring";

/** Group strength keyed by the profile's position-group ids. */
export type GroupStrength = Record<string, { total: number; count: number; top: number }>;

export function groupFor(profile: SportProfile, position: string): string {
  const match = profile.positionGroups.find((g) => g.matches(position));
  // Fall back to the last group so an unrecognised position is still counted
  // somewhere rather than silently dropped from every roster comparison.
  return match?.id ?? profile.positionGroups[profile.positionGroups.length - 1].id;
}

export function groupLabel(profile: SportProfile, id: string): string {
  return profile.positionGroups.find((g) => g.id === id)?.label ?? id;
}

/**
 * What the user is actually trying to accomplish with this trade.
 *
 * Without any of it the engine behaves as before: find a mutual positional
 * imbalance and propose the closest-value swap. With it, "fair" stops meaning
 * only "even value" and starts meaning "worth it for what you need" — a trade
 * that costs a little value but fixes a stated hole is a good trade, and the
 * proposal reports both numbers so the manager can judge for themselves.
 */
export type TradeIntent = {
  /** Category keys the manager wants to improve, e.g. ["reb", "blk"]. */
  wantCategories?: string[];
  /** A specific player on the partner's roster to build the deal around. */
  targetPlayerId?: string | null;
  /** Players the manager will not give up. */
  protectedPlayerIds?: string[];
};

/**
 * Strength of each position group on a roster.
 *
 * Scored on the top three per group: lineups start a limited number at each
 * spot, so a team's ninth guard is not what makes them deep.
 */
export function groupStrength(profile: SportProfile, roster: Recommendation[]): GroupStrength {
  const out: GroupStrength = {};
  for (const g of profile.positionGroups) {
    const members = roster
      .filter((p) => groupFor(profile, p.position) === g.id)
      .sort((a, b) => b.score - a.score);
    const counted = members.slice(0, 3);
    out[g.id] = {
      total: counted.reduce((s, p) => s + p.score, 0),
      count: members.length,
      top: members[0]?.score ?? 0,
    };
  }
  return out;
}

export type TradeProposal = {
  give: Recommendation;
  receive: Recommendation;
  /** Set when the deal was built from a positional imbalance. */
  userNeed: string | null;
  partnerNeed: string | null;
  valueGap: number;
  fairness: "even" | "you-give-up-value" | "you-gain-value" | "worth-the-overpay";
  /** How the deal moves each category the manager asked to improve. */
  goalDelta: { key: string; label: string; delta: number }[];
  /** Total z gained across the wanted categories. Null when no goal was set. */
  goalGain: number | null;
  /** Why this particular pair was chosen, in one plain sentence. */
  rationale: string;
};

export type TradeResult =
  | { ok: true; proposal: TradeProposal }
  | { ok: false; reason: string };

/**
 * A trade the partner would plausibly accept.
 *
 * Without this cap the engine happily proposes robbery — the manager receives
 * a far better player and the deal reads as a suggestion rather than a fantasy.
 */
const ACCEPTABLE_GAIN = 0.6;

/** Z-scores are computed regardless of format, since a goal is about stats. */
function zOf(ctx: AnalysisContext, player: Recommendation): Record<string, number> {
  return player.zScores ?? categoryZScores(ctx.profile, player.rates, ctx.norms);
}

function goalScore(
  ctx: AnalysisContext,
  player: Recommendation,
  wanted: string[],
): number {
  if (!wanted.length) return 0;
  const z = zOf(ctx, player);
  return wanted.reduce((s, key) => s + (z[key] ?? 0), 0);
}

function buildGoalDelta(
  ctx: AnalysisContext,
  give: Recommendation,
  receive: Recommendation,
  wanted: string[],
): { key: string; label: string; delta: number }[] {
  const labels = Object.fromEntries(ctx.profile.categories.map((c) => [c.key, c.label]));
  const gz = zOf(ctx, give);
  const rz = zOf(ctx, receive);
  return wanted.map((key) => ({
    key,
    label: labels[key] ?? key.toUpperCase(),
    delta: (rz[key] ?? 0) - (gz[key] ?? 0),
  }));
}

/** Average absolute score on a roster — the unit we express fairness in. */
function rosterScale(roster: Recommendation[]): number {
  return roster.reduce((s, p) => s + Math.abs(p.score), 0) / Math.max(roster.length, 1) || 1;
}

function classifyFairness(
  relative: number,
  goalGain: number | null,
): TradeProposal["fairness"] {
  if (Math.abs(relative) < 0.25) return "even";
  if (relative > 0) return "you-gain-value";
  // Paying a bit over the odds is the right call when it fixes a real hole.
  if (goalGain !== null && goalGain >= 1 && relative > -0.6) return "worth-the-overpay";
  return "you-give-up-value";
}

/**
 * Find a trade with the partner, shaped by whatever the manager asked for.
 *
 * Selection stays deterministic in every mode: the same league and the same
 * conditions always produce the same deal, so the reasoning can be explained
 * rather than hoped for. The model narrates the result; it never picks it.
 */
export function suggestTrade(
  ctx: AnalysisContext,
  partnerRosterId: number,
  format: ScoringFormat,
  intent: TradeIntent = {},
): TradeResult {
  const { profile } = ctx;
  const userTeamId = ctx.snapshot.userTeamId;
  if (userTeamId === null) {
    return { ok: false, reason: "We could not tell which team is yours in this league." };
  }
  if (userTeamId === partnerRosterId) {
    return { ok: false, reason: "That is your own team — pick an opponent to trade with." };
  }

  const mine = getTeamRoster(ctx, userTeamId, format);
  const theirs = getTeamRoster(ctx, partnerRosterId, format);

  if (mine.length < 3 || theirs.length < 3) {
    return {
      ok: false,
      reason: "One of these rosters has too few scored players to read an imbalance.",
    };
  }

  const wanted = (intent.wantCategories ?? []).filter((k) =>
    profile.categories.some((c) => c.key === k),
  );
  const protectedIds = new Set(intent.protectedPlayerIds ?? []);
  const scale = rosterScale(mine);

  // Nobody trades their single best player, and the manager may have ring-fenced
  // others besides.
  const bestMine = mine[0]?.playerId;
  const givable = mine.filter((p) => p.playerId !== bestMine && !protectedIds.has(p.playerId));

  if (!givable.length) {
    return {
      ok: false,
      reason: "Every player on your roster is either protected or untouchable — free one up first.",
    };
  }

  const finish = (
    give: Recommendation,
    receive: Recommendation,
    userNeed: string | null,
    partnerNeed: string | null,
    rationale: string,
  ): TradeResult => {
    const relative = (receive.score - give.score) / scale;
    const goalGain = wanted.length ? goalScore(ctx, receive, wanted) - goalScore(ctx, give, wanted) : null;
    return {
      ok: true,
      proposal: {
        give,
        receive,
        userNeed,
        partnerNeed,
        valueGap: Math.abs(receive.score - give.score),
        fairness: classifyFairness(relative, goalGain),
        goalDelta: wanted.length ? buildGoalDelta(ctx, give, receive, wanted) : [],
        goalGain,
        rationale,
      },
    };
  };

  /* ── Mode 1: a named target ───────────────────────────────────────────── */
  if (intent.targetPlayerId) {
    const receive = theirs.find((p) => p.playerId === intent.targetPlayerId);
    if (!receive) {
      return {
        ok: false,
        reason: "That player is not on this team's roster, or has no scoreable stats.",
      };
    }

    // Closest value wins; among near-ties prefer giving up whoever contributes
    // least to the stated goal.
    const ranked = [...givable].sort((a, b) => {
      const gapA = Math.abs(receive.score - a.score);
      const gapB = Math.abs(receive.score - b.score);
      if (Math.abs(gapA - gapB) > scale * 0.1) return gapA - gapB;
      return goalScore(ctx, a, wanted) - goalScore(ctx, b, wanted);
    });

    const give = ranked[0];
    const relative = (receive.score - give.score) / scale;
    if (relative > ACCEPTABLE_GAIN) {
      return {
        ok: false,
        reason: `${receive.name} is worth more than anything you can spare — no realistic one-for-one gets him. Protect fewer players, or aim lower.`,
      };
    }

    return finish(
      give,
      receive,
      null,
      null,
      `Built around landing ${receive.name}; ${give.name} is the closest match in value you can spare.`,
    );
  }

  /* ── Mode 2: a stated goal ────────────────────────────────────────────── */
  if (wanted.length) {
    const labels = wanted
      .map((k) => profile.categories.find((c) => c.key === k)?.label ?? k)
      .join(" and ");

    let best: { give: Recommendation; receive: Recommendation; fitness: number } | null = null;

    for (const receive of theirs) {
      // Their best player is not available either.
      if (receive.playerId === theirs[0]?.playerId) continue;
      for (const give of givable) {
        const relative = (receive.score - give.score) / scale;
        if (relative > ACCEPTABLE_GAIN) continue; // they would never accept

        const net = goalScore(ctx, receive, wanted) - goalScore(ctx, give, wanted);
        if (net <= 0) continue; // does not actually serve the goal

        // Reward the categories gained, penalise how far off even value it is.
        const fitness = net - Math.abs(relative) * 1.5;
        if (!best || fitness > best.fitness) best = { give, receive, fitness };
      }
    }

    if (!best) {
      return {
        ok: false,
        reason: `Nothing on this roster improves your ${labels} without overpaying badly. Try another team.`,
      };
    }

    return finish(
      best.give,
      best.receive,
      null,
      null,
      `Targets ${labels}: ${best.receive.name} adds it, ${best.give.name} was your least productive piece there.`,
    );
  }

  /* ── Mode 3: no conditions — read the positional imbalance ────────────── */
  const myStrength = groupStrength(profile, mine);
  const theirStrength = groupStrength(profile, theirs);
  const groupIds = profile.positionGroups.map((g) => g.id);

  // Rank each side's groups weakest-first. An empty group is the most acute
  // need there is, so it sorts to the front.
  const weakestFor = (s: GroupStrength) =>
    [...groupIds].sort((a, b) => {
      if (s[a].count === 0 && s[b].count > 0) return -1;
      if (s[b].count === 0 && s[a].count > 0) return 1;
      return s[a].total - s[b].total;
    });

  for (const myNeed of weakestFor(myStrength)) {
    for (const theirNeed of weakestFor(theirStrength)) {
      if (myNeed === theirNeed) continue;

      // They must have depth where I am thin, and I must have depth where they
      // are thin — otherwise this is a trade neither side would accept.
      const theirSurplus = theirs
        .filter((p) => groupFor(profile, p.position) === myNeed)
        .sort((a, b) => b.score - a.score);
      const mySurplus = givable
        .filter((p) => groupFor(profile, p.position) === theirNeed)
        .sort((a, b) => b.score - a.score);

      if (theirSurplus.length < 2 || mySurplus.length < 1) continue;

      let best: { give: Recommendation; receive: Recommendation; gap: number } | null = null;
      for (const receive of theirSurplus.slice(1)) {
        for (const give of mySurplus) {
          const gap = Math.abs(receive.score - give.score);
          if (!best || gap < best.gap) best = { give, receive, gap };
        }
      }
      if (!best) continue;

      return finish(
        best.give,
        best.receive,
        myNeed,
        theirNeed,
        `You are thin at ${groupLabel(profile, myNeed)} and they are thin at ${groupLabel(profile, theirNeed)}.`,
      );
    }
  }

  return {
    ok: false,
    reason:
      "These two rosters are built too similarly — neither side has surplus where the other is thin. Try naming a target player or a category you want instead.",
  };
}
