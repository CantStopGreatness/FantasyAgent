import type { SportProfile } from "@/lib/sports";
import type { AnalysisContext, Recommendation } from "./recommend";
import { getTeamRoster } from "./recommend";
import type { ScoringFormat } from "./scoring";

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
  userNeed: string;
  partnerNeed: string;
  userStrength: GroupStrength;
  partnerStrength: GroupStrength;
  valueGap: number;
  fairness: "even" | "you-give-up-value" | "you-gain-value";
};

export type TradeResult =
  | { ok: true; proposal: TradeProposal }
  | { ok: false; reason: string };

/**
 * Find one player-for-player swap that addresses a real positional imbalance.
 *
 * Deliberately deterministic. The model narrates the result but never picks
 * it, so the same league always produces the same trade and the reasoning can
 * be explained without hoping the model cooperates.
 */
export function suggestTrade(
  ctx: AnalysisContext,
  partnerRosterId: number,
  format: ScoringFormat,
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
      const mySurplus = mine
        .filter((p) => groupFor(profile, p.position) === theirNeed)
        .sort((a, b) => b.score - a.score);

      if (theirSurplus.length < 2 || mySurplus.length < 2) continue;

      // Neither manager trades their best player at a position of strength, so
      // draw from the second man down on each side.
      let best: { give: Recommendation; receive: Recommendation; gap: number } | null = null;
      for (const receive of theirSurplus.slice(1)) {
        for (const give of mySurplus.slice(1)) {
          const gap = Math.abs(receive.score - give.score);
          if (!best || gap < best.gap) best = { give, receive, gap };
        }
      }
      if (!best) continue;

      // Express the gap relative to the roster's own scale so the fairness read
      // means the same thing in both formats.
      const scale =
        mine.reduce((s, p) => s + Math.abs(p.score), 0) / Math.max(mine.length, 1) || 1;
      const relative = (best.receive.score - best.give.score) / scale;
      const fairness =
        Math.abs(relative) < 0.25
          ? "even"
          : relative > 0
            ? "you-gain-value"
            : "you-give-up-value";

      return {
        ok: true,
        proposal: {
          give: best.give,
          receive: best.receive,
          userNeed: myNeed,
          partnerNeed: theirNeed,
          userStrength: myStrength,
          partnerStrength: theirStrength,
          valueGap: best.gap,
          fairness,
        },
      };
    }
  }

  return {
    ok: false,
    reason:
      "These two rosters are built too similarly — neither side has surplus where the other is thin. Try a different team.",
  };
}
