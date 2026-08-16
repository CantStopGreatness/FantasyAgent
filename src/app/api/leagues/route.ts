import { NextResponse } from "next/server";
import { findLeaguesForUsername } from "@/lib/engine/league";
import { errorResponse } from "@/lib/api-helpers";

export const runtime = "nodejs";

/** Resolve a Sleeper username to the leagues they manage. */
export async function POST(request: Request) {
  try {
    const { username, sport } = (await request.json()) as { username?: string; sport?: string };
    if (!username?.trim()) {
      return NextResponse.json({ error: "Enter a Sleeper username." }, { status: 400 });
    }

    const { user, leagues, season } = await findLeaguesForUsername(username, sport);

    return NextResponse.json({
      user,
      season,
      leagues: leagues.map((l) => ({
        leagueId: l.league_id,
        name: l.name,
        season: l.season,
        teamCount: l.total_rosters,
      })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
