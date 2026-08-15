import { NextResponse } from "next/server";
import { getAnalysis } from "@/lib/engine/context-cache";
import { groupLabel, suggestTrade } from "@/lib/engine/trade";
import { statLine, toCard } from "@/lib/engine/serialize";
import { rulesForPrompt } from "@/lib/engine/settings";
import { tradeCommentary } from "@/lib/ai/persona";
import { errorResponse, parseFormatOverride } from "@/lib/api-helpers";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * On-demand trade suggestion against one specific team.
 *
 * The swap is chosen by rule (see lib/engine/trade.ts); the model only writes
 * the pitch. When no complementary imbalance exists we say so plainly instead
 * of inventing a trade nobody would accept.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      leagueId?: string;
      userId?: string | null;
      partnerRosterId?: number;
      format?: string | null;
    };

    if (!body.leagueId?.trim() || body.partnerRosterId === undefined) {
      return NextResponse.json({ error: "Pick a team to trade with." }, { status: 400 });
    }

    const ctx = await getAnalysis(
      body.leagueId.trim(),
      body.userId?.trim() || null,
      parseFormatOverride(body.format),
    );
    const format = ctx.snapshot.format;
    const result = suggestTrade(ctx, body.partnerRosterId, format);

    if (!result.ok) {
      return NextResponse.json({ found: false, reason: result.reason });
    }

    const { proposal } = result;
    const partner = ctx.snapshot.teams.find((t) => t.rosterId === body.partnerRosterId);
    const partnerTeamName = partner?.teamName ?? "that team";
    const userNeed = groupLabel(ctx.profile, proposal.userNeed);
    const partnerNeed = groupLabel(ctx.profile, proposal.partnerNeed);

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
      commentary,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
