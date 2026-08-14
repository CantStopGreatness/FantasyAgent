import { NextResponse } from "next/server";
import { getAnalysis } from "@/lib/nba/context-cache";
import { errorResponse } from "@/lib/api-helpers";

export const runtime = "nodejs";

/**
 * Load a league and report what we found — the import confirmation screen's
 * data, plus everything the dashboard needs to render its top bar and tabs.
 */
export async function POST(request: Request) {
  try {
    const { leagueId, userId } = (await request.json()) as {
      leagueId?: string;
      userId?: string | null;
    };
    if (!leagueId?.trim()) {
      return NextResponse.json({ error: "Enter a league ID." }, { status: 400 });
    }

    const ctx = await getAnalysis(leagueId.trim(), userId?.trim() || null);
    const { snapshot } = ctx;

    // How many rostered players we could actually score — an honest signal
    // that the import worked, rather than a raw roster count.
    const scoredCount = snapshot.rosteredIds.filter((id) => ctx.rates.has(id)).length;

    return NextResponse.json({
      league: {
        leagueId: snapshot.leagueId,
        name: snapshot.name,
        season: snapshot.season,
        statsSeason: snapshot.statsSeason,
        teamCount: snapshot.teamCount,
        detectedFormat: snapshot.detectedFormat,
        userTeamId: snapshot.userTeamId,
        rosteredCount: snapshot.rosteredIds.length,
        scoredCount,
      },
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
