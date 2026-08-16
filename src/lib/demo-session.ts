import type { Session, Snapshot } from "@/lib/types";

type DemoSnapshot = Snapshot & { error?: string };

/**
 * Enter the frozen demo through the same snapshot API and deterministic engine
 * used by an imported league. This helper persists no pre-built boards or
 * trades; every dashboard view still requests its result from the API.
 */
export async function loadDemoSession(): Promise<Session> {
  const response = await fetch("/api/snapshot", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ leagueId: "demo", userId: "demo-user" }),
  });
  const snapshot = (await response.json()) as DemoSnapshot;
  if (!response.ok) throw new Error(snapshot.error ?? "Could not load the demo.");

  return {
    leagueId: snapshot.league.leagueId,
    userId: "demo-user",
    league: snapshot.league,
    settings: snapshot.settings,
    scoring: snapshot.scoring,
    teams: snapshot.teams,
    confirmedFormat: snapshot.league.format,
    ruleOverrides: {},
    scoringOverrides: {},
  };
}
