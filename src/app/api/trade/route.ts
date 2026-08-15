import { NextResponse } from "next/server";
import { getAnalysis } from "@/lib/engine/context-cache";
import { groupLabel, suggestTrade, type TradeIntent } from "@/lib/engine/trade";
import { statLine, toCard } from "@/lib/engine/serialize";
import { rulesForPrompt } from "@/lib/engine/settings";
import { tradeCommentary } from "@/lib/ai/persona";
import { errorResponse, parseOverrides } from "@/lib/api-helpers";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Only accept category keys the sport actually has, and cap list sizes. */
function parseIntent(raw: unknown): TradeIntent {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const strings = (v: unknown, max: number) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, max) : [];
  return {
    wantCategories: strings(o.wantCategories, 4),
    targetPlayerId: typeof o.targetPlayerId === "string" ? o.targetPlayerId : null,
    protectedPlayerIds: strings(o.protectedPlayerIds, 30),
  };
}

/**
 * On-demand trade suggestion against one specific team.
 *
 * The swap is chosen by rule (see lib/engine/trade.ts) whether or not the
 * manager attached conditions; the model only writes the pitch. When nothing
 * works we say why instead of inventing a trade nobody would accept.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      leagueId?: string;
      userId?: string | null;
      partnerRosterId?: number;
      format?: string | null;
      ruleOverrides?: Record<string, number | string>;
      scoringOverrides?: Record<string, number>;
      intent?: unknown;
    };

    if (!body.leagueId?.trim() || body.partnerRosterId === undefined) {
      return NextResponse.json({ error: "Pick a team to trade with." }, { status: 400 });
    }

    const ctx = await getAnalysis(
      body.leagueId.trim(),
      body.userId?.trim() || null,
      parseOverrides(body),
    );
    const format = ctx.snapshot.format;
    const intent = parseIntent(body.intent);
    const result = suggestTrade(ctx, body.partnerRosterId, format, intent);

    if (!result.ok) {
      return NextResponse.json({ found: false, reason: result.reason });
    }

    const { proposal } = result;
    const partner = ctx.snapshot.teams.find((t) => t.rosterId === body.partnerRosterId);
    const partnerTeamName = partner?.teamName ?? "that team";
    const userNeed = proposal.userNeed ? groupLabel(ctx.profile, proposal.userNeed) : null;
    const partnerNeed = proposal.partnerNeed
      ? groupLabel(ctx.profile, proposal.partnerNeed)
      : null;

    const commentary = await tradeCommentary(
      {
        giveName: proposal.give.name,
        givePosition: proposal.give.position,
        giveStats: statLine(ctx.profile, proposal.give),
        receiveName: proposal.receive.name,
        receivePosition: proposal.receive.position,
        receiveStats: statLine(ctx.profile, proposal.receive),
        userNeed,
        partnerNeed,
        partnerTeamName,
        format,
        fairness: proposal.fairness,
        rationale: proposal.rationale,
        goalDelta: proposal.goalDelta,
        targeted: Boolean(intent.targetPlayerId),
      },
      {
        sportNoun: ctx.profile.noun,
        rules: rulesForPrompt(ctx.snapshot.rules, ctx.snapshot.currentWeek),
      },
    );

    return NextResponse.json({
      found: true,
      format,
      partnerTeamName,
      give: toCard(ctx.profile, proposal.give, format),
      receive: toCard(ctx.profile, proposal.receive, format),
      userNeed,
      partnerNeed,
      fairness: proposal.fairness,
      goalDelta: proposal.goalDelta,
      goalGain: proposal.goalGain,
      rationale: proposal.rationale,
      commentary,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
