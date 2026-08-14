import { NextResponse } from "next/server";
import { getAnalysis } from "@/lib/nba/context-cache";
import { groupLabel, suggestTrade } from "@/lib/nba/trade";
import { statLine, toCard } from "@/lib/nba/serialize";
import { tradeCommentary } from "@/lib/ai/persona";
import { errorResponse, parseFormat } from "@/lib/api-helpers";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * On-demand trade suggestion against one specific team.
 *
 * The swap itself is chosen by rule (see lib/nba/trade.ts); the model only
 * writes the pitch. When no complementary imbalance exists we say so plainly
 * instead of inventing a trade nobody would accept.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      leagueId?: string;
      userId?: string | null;
      partnerRosterId?: number;
      format?: string;
    };

    if (!body.leagueId?.trim() || body.partnerRosterId === undefined) {
      return NextResponse.json({ error: "Pick a team to trade with." }, { status: 400 });
    }

    const format = parseFormat(body.format);
    const ctx = await getAnalysis(body.leagueId.trim(), body.userId?.trim() || null);
    const result = suggestTrade(ctx, body.partnerRosterId, format);

    if (!result.ok) {
      return NextResponse.json({ found: false, reason: result.reason });
    }

    const { proposal } = result;
    const partner = ctx.snapshot.teams.find((t) => t.rosterId === body.partnerRosterId);
    const partnerTeamName = partner?.teamName ?? "that team";

    const commentary = await tradeCommentary({
      giveName: proposal.give.name,
      givePosition: proposal.give.position,
      giveStats: statLine(proposal.give),
      receiveName: proposal.receive.name,
      receivePosition: proposal.receive.position,
      receiveStats: statLine(proposal.receive),
      userNeed: groupLabel(proposal.userNeed),
      partnerNeed: groupLabel(proposal.partnerNeed),
      partnerTeamName,
      format,
      fairness: proposal.fairness,
    });

    return NextResponse.json({
      found: true,
      format,
      partnerTeamName,
      give: toCard(proposal.give, format),
      receive: toCard(proposal.receive, format),
      userNeed: groupLabel(proposal.userNeed),
      partnerNeed: groupLabel(proposal.partnerNeed),
      fairness: proposal.fairness,
      commentary,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
