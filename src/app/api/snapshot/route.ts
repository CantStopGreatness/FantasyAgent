import { NextResponse } from "next/server";
import { getAnalysis } from "@/lib/engine/context-cache";
import { errorResponse, parseOverrides } from "@/lib/api-helpers";

export const runtime = "nodejs";

/**
 * Load a league and report everything we read from it.
 *
 * This backs the setup screen's confirm-and-correct step, so it returns the
 * parsed rules alongside the raw settings object — the raw copy is what makes
 * a mis-labelled field diagnosable against a real league.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      leagueId?: string;
      userId?: string | null;
      format?: string | null;
      ruleOverrides?: Record<string, number | string>;
      scoringOverrides?: Record<string, number>;
    };
    const { leagueId, userId } = body;
    if (!leagueId?.trim()) {
      return NextResponse.json({ error: "Enter a league ID." }, { status: 400 });
    }

    const ctx = await getAnalysis(leagueId.trim(), userId?.trim() || null, parseOverrides(body));
    const { snapshot } = ctx;

    // How many rostered players we could actually score — an honest signal
    // that the import worked, rather than a raw roster count.
    const scoredCount = snapshot.rosteredIds.filter((id) => ctx.rates.has(id)).length;

    return NextResponse.json({
      league: {
        leagueId: snapshot.leagueId,
        name: snapshot.name,
        season: snapshot.season,
        sport: snapshot.sport,
        sportLabel: ctx.profile.label,
        statsSeason: snapshot.statsSeason,
        currentWeek: snapshot.currentWeek,
        teamCount: snapshot.teamCount,
        format: snapshot.format,
        formatInferred: snapshot.rules.formatInferred,
        supportsCategories: ctx.profile.supportsCategories,
        rosterSize: snapshot.rules.rosterSize,
        userTeamId: snapshot.userTeamId,
        rosteredCount: snapshot.rosteredIds.length,
        scoredCount,
      },
      settings: snapshot.rules.settings,
      scoring: snapshot.rules.scoring,
      // Every key Sleeper actually sent. Undocumented object, so keep the
      // unfiltered copy available for reconciling the label table.
      rawSettings: snapshot.rules.raw,
      teams: snapshot.teams.map((t) => ({
        rosterId: t.rosterId,
        teamName: t.teamName,
        ownerName: t.ownerName,
        playerCount: t.playerIds.length,
        isUserTeam: t.isUserTeam,
      })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
