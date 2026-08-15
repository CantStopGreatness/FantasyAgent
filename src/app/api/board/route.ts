import { NextResponse } from "next/server";
import { getAnalysis } from "@/lib/engine/context-cache";
import { getSleepers, getTeamRoster, getWaiverRecommendations } from "@/lib/engine/recommend";
import { strengthsPhrase, statLine, toCard, weaknessPhrase } from "@/lib/engine/serialize";
import { rulesForPrompt } from "@/lib/engine/settings";
import { sleeperCommentary, waiverCommentary, type LeagueContext } from "@/lib/ai/persona";
import { errorResponse, parseOverrides } from "@/lib/api-helpers";
import type { AnalysisContext } from "@/lib/engine/recommend";

export const runtime = "nodejs";
// The persona call can take a few seconds; give the route room.
export const maxDuration = 60;

type Body = {
  leagueId?: string;
  userId?: string | null;
  format?: string | null;
  ruleOverrides?: Record<string, number | string>;
  scoringOverrides?: Record<string, number>;
  view?: "waivers" | "sleepers" | "roster";
  rosterId?: number;
};

/** The league's own rules, rendered for the analyst prompt. */
function leagueContext(ctx: AnalysisContext): LeagueContext {
  return {
    sportNoun: ctx.profile.noun,
    rules: rulesForPrompt(ctx.snapshot.rules, ctx.snapshot.currentWeek),
  };
}

/**
 * One endpoint for every ranked list in the app.
 *
 * The format is the league's, not a request-time preference — callers may pass
 * a confirmed override from the setup screen, but never an arbitrary choice.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    if (!body.leagueId?.trim()) {
      return NextResponse.json({ error: "Missing league." }, { status: 400 });
    }

    const ctx = await getAnalysis(
      body.leagueId.trim(),
      body.userId?.trim() || null,
      parseOverrides(body),
    );
    const format = ctx.snapshot.format;
    const view = body.view ?? "waivers";

    if (view === "roster") {
      const rosterId = body.rosterId ?? ctx.snapshot.userTeamId;
      if (rosterId === null || rosterId === undefined) {
        return NextResponse.json(
          { error: "We could not identify a team to show." },
          { status: 400 },
        );
      }
      const roster = getTeamRoster(ctx, rosterId, format);
      const team = ctx.snapshot.teams.find((t) => t.rosterId === rosterId);
      return NextResponse.json({
        view,
        format,
        team: team
          ? { rosterId: team.rosterId, teamName: team.teamName, ownerName: team.ownerName }
          : null,
        players: roster.map((r) => toCard(ctx.profile, r, format)),
        // A roster can hold players with no scoreable stats (rookies, two-way
        // deals). Say so rather than silently showing a short list.
        unscored: team ? team.playerIds.length - roster.length : 0,
      });
    }

    if (view === "sleepers") {
      const sleepers = getSleepers(ctx, format, 8);
      const top = sleepers[0];
      const commentary = top
        ? await sleeperCommentary(
            {
              name: top.name,
              position: top.position,
              team: top.team,
              reason: top.sleeperReason,
              statLine: statLine(ctx.profile, top),
              format,
            },
            leagueContext(ctx),
          )
        : null;

      return NextResponse.json({
        view,
        format,
        players: sleepers.map((s) => ({
          ...toCard(ctx.profile, s, format),
          reason: s.sleeperReason,
        })),
        commentary,
      });
    }

    const waivers = getWaiverRecommendations(ctx, format, 12);
    const top = waivers[0];
    const commentary = top
      ? await waiverCommentary(
          {
            name: top.name,
            position: top.position,
            team: top.team,
            format,
            rank: top.rank,
            statLine: statLine(ctx.profile, top),
            strengths: strengthsPhrase(top),
            weakness: weaknessPhrase(top),
            rankDelta: top.rankDelta,
            tags: top.tags.map((t) => t.label),
          },
          leagueContext(ctx),
        )
      : null;

    return NextResponse.json({
      view: "waivers",
      format,
      players: waivers.map((w) => toCard(ctx.profile, w, format)),
      commentary,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
