import type { AnalysisContext, Recommendation } from "./recommend";
import { getTeamRoster } from "./recommend";
import type { ScoringFormat } from "./scoring";

export type PositionGroup = "G" | "F" | "C";
export const POSITION_GROUPS: PositionGroup[] = ["G", "F", "C"];

export function groupFor(position: string): PositionGroup {
  const p = position.toUpperCase();
  if (p.startsWith("C")) return "C";
  if (p === "SF" || p === "PF" || p === "F") return "F";
  return "G";
}

export type GroupStrength = Record<PositionGroup, { total: number; count: number; top: number }>;

/**
 * Strength of each position group on a roster.
 *
 * Scored on the top three players per group: fantasy lineups start a limited
 * number at each spot, so a team's ninth guard is not what makes them deep.
 */
export function groupStrength(roster: Recommendation[]): GroupStrength {
  const out: GroupStrength = {
    G: { total: 0, count: 0, top: 0 },
    F: { total: 0, count: 0, top: 0 },
    C: { total: 0, count: 0, top: 0 },
  };

  for (const g of POSITION_GROUPS) {
    const members = roster
      .filter((p) => groupFor(p.position) === g)
      .sort((a, b) => b.score - a.score);
    const counted = members.slice(0, 3);
    out[g] = {
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
  /** The imbalance this trade is built to correct. */
  userNeed: PositionGroup;
  partnerNeed: PositionGroup;
  userStrength: GroupStrength;
  partnerStrength: GroupStrength;
  /** Score gap between the two players, in the active format's units. */
  valueGap: number;
  fairness: "even" | "you-give-up-value" | "you-gain-value";
};

export type TradeResult =
  | { ok: true; proposal: TradeProposal }
  | { ok: false; reason: string };

const GROUP_LABEL: Record<PositionGroup, string> = {
  G: "guard",
  F: "forward",
  C: "center",
};

export function groupLabel(g: PositionGroup): string {
  return GROUP_LABEL[g];
}

/**
 * Find one player-for-player swap that addresses a real positional imbalance.
 *
 * Deliberately deterministic. The LLM narrates the result but never picks it,
 * so the same league always produces the same trade and the reasoning can be
 * explained on stage without hoping the model cooperates.
 */
export function suggestTrade(
  ctx: AnalysisContext,
  partnerRosterId: number,
  format: ScoringFormat,
): TradeResult {
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

  const myStrength = groupStrength(mine);
  const theirStrength = groupStrength(theirs);

  // Rank each side's groups weakest-first. A group with nobody in it is the
  // most acute need there is, so empty groups sort to the front.
  const weakestFor = (s: GroupStrength) =>
    [...POSITION_GROUPS].sort((a, b) => {
      if (s[a].count === 0 && s[b].count > 0) return -1;
      if (s[b].count === 0 && s[a].count > 0) return 1;
      return s[a].total - s[b].total;
    });

  const myNeeds = weakestFor(myStrength);
  const theirNeeds = weakestFor(theirStrength);

  // Try need pairings in order of how acute they are, taking the first that is
  // genuinely complementary — I need what they can spare, and vice versa.
  for (const myNeed of myNeeds) {
    for (const theirNeed of theirNeeds) {
      if (myNeed === theirNeed) continue;

      // They must have depth where I am thin, and I must have depth where they
      // are thin — otherwise this is a trade neither side would accept.
      const theirSurplus = theirs
        .filter((p) => groupFor(p.position) === myNeed)
        .sort((a, b) => b.score - a.score);
      const mySurplus = mine
        .filter((p) => groupFor(p.position) === theirNeed)
        .sort((a, b) => b.score - a.score);

      if (theirSurplus.length < 2 || mySurplus.length < 2) continue;

      // Neither manager trades their best player at a position of strength, so
      // draw from the second man down on each side.
      const receiveCandidates = theirSurplus.slice(1);
      const giveCandidates = mySurplus.slice(1);

      // Pick the closest-value pair; a lopsided offer gets declined instantly.
      let best: { give: Recommendation; receive: Recommendation; gap: number } | null = null;
      for (const receive of receiveCandidates) {
        for (const give of giveCandidates) {
          const gap = Math.abs(receive.score - give.score);
          if (!best || gap < best.gap) best = { give, receive, gap };
        }
      }
      if (!best) continue;

      // Express the gap relative to the roster's own scale so the fairness
      // read means the same thing in both formats.
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
