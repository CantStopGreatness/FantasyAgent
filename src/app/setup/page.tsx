"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import {
  EMPTY_OVERRIDES,
  LeagueRulesEditor,
  type Overrides,
} from "@/components/LeagueRulesEditor";
import { FORMAT_LABEL, saveSession, type Snapshot } from "@/lib/types";

type Mode = "username" | "leagueId";
type SportChoice = "nba" | "nfl" | "soccer";
type LeagueOption = { leagueId: string; name: string; season: string; teamCount: number };

export default function Setup() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("username");
  const [sport, setSport] = useState<SportChoice>("nba");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [leagues, setLeagues] = useState<LeagueOption[] | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  // Every correction the user makes on the confirm screen.
  const [overrides, setOverrides] = useState<Overrides>(EMPTY_OVERRIDES);

  async function loadLeague(
    leagueId: string,
    resolvedUserId: string | null,
    o: Overrides = EMPTY_OVERRIDES,
  ) {
    setStatus("Reading rosters, scoring settings, and league rules...");
    const res = await fetch("/api/snapshot", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        leagueId,
        userId: resolvedUserId,
        format: o.format,
        ruleOverrides: o.rules,
        scoringOverrides: o.scoring,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Could not load that league.");
    setSnapshot(data as Snapshot);
    setStatus(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim() || busy) return;

    setBusy(true);
    setError(null);
    setLeagues(null);
    setSnapshot(null);
    setOverrides(EMPTY_OVERRIDES);

    try {
      if (mode === "leagueId") {
        await loadLeague(value.trim(), null);
      } else {
        setStatus("Finding your leagues...");
        const res = await fetch("/api/leagues", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ username: value.trim(), sport }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not find that user.");

        setUserId(data.user.userId);
        if (!data.leagues.length) {
          throw new Error(
            `${data.user.displayName} has no leagues on Sleeper for ${data.season}. Try importing by league ID instead.`,
          );
        }
        if (data.leagues.length === 1) {
          await loadLeague(data.leagues[0].leagueId, data.user.userId);
        } else {
          setLeagues(data.leagues);
          setStatus(null);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  async function pickLeague(leagueId: string) {
    setBusy(true);
    setError(null);
    try {
      await loadLeague(leagueId, userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  /**
   * Re-read the league under the user's corrections.
   *
   * Supported scoring edits change the rankings, so this round-trips rather than just
   * updating the display.
   */
  async function applyOverrides(next: Overrides) {
    setOverrides(next);
    if (!snapshot || busy) return;
    setBusy(true);
    setError(null);
    try {
      await loadLeague(snapshot.league.leagueId, userId, next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  function goToDashboard() {
    if (!snapshot) return;
    saveSession({
      leagueId: snapshot.league.leagueId,
      userId,
      league: snapshot.league,
      settings: snapshot.settings,
      scoring: snapshot.scoring,
      teams: snapshot.teams,
      confirmedFormat: overrides.format ?? snapshot.league.format,
      ruleOverrides: overrides.rules,
      scoringOverrides: overrides.scoring,
    });
    router.push("/app");
  }

  return (
    <main className="turf min-h-dvh pb-16">
      <header className="strip border-b-[3px] border-ink">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3 sm:px-6">
          <Link href="/" className="font-display text-xl text-bone">
            COURT<span className="text-gold">IQ</span>
          </Link>
          <span className="font-display text-sm text-bone-3">IMPORT</span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 py-10 sm:px-6">
        <h1 className="on-field font-display text-4xl text-chalk sm:text-5xl">
          Connect your league
        </h1>
        <p className="on-field mt-3 max-w-lg text-bone-2">
          CourtIQ reads your selected Sleeper league: rosters, scoring settings, and league
          context for the optional analyst explanation.
        </p>

        <div className="mt-8">
          <p className="on-field text-xs uppercase tracking-[0.15em] text-bone-3">Sport</p>
          <div className="mt-2 inline-flex flex-wrap border-[3px] border-ink bg-bone">
            {([
              ["nba", "NBA"],
              ["nfl", "NFL"],
              ["soccer", "Soccer  Coming soon"],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                disabled={id === "soccer"}
                onClick={() => setSport(id)}
                aria-pressed={sport === id}
                className={`px-4 py-2 font-display text-sm transition ${sport === id ? "bg-ink text-bone" : "text-ink hover:bg-gold"} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {label}
              </button>
            ))}
          </div>
          {sport === "soccer" && (
            <p className="mt-2 text-sm text-bone-2">Soccer league import is coming soon; CourtIQ does not have a live soccer data provider yet.</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="mt-10">
          <div className="inline-flex border-[3px] border-ink bg-bone">
            {(
              [
                ["username", "Sleeper username"],
                ["leagueId", "League ID"],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                aria-pressed={mode === m}
                className={`px-4 py-2 font-display text-sm transition ${
                  mode === m ? "bg-ink text-bone" : "text-ink hover:bg-gold"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <label htmlFor="league-lookup" className="sr-only">
              {mode === "username" ? "Sleeper username" : "Sleeper league ID"}
            </label>
            <input
              id="league-lookup"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={mode === "username" ? "e.g. yourhandle" : "e.g. 1234567890123456789"}
              autoComplete="off"
              spellCheck={false}
              className="flex-1 border-[3px] border-ink bg-bone px-4 py-3.5 text-ink placeholder:text-ink-2/60 focus:bg-chalk focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || !value.trim()}
              className="border-[3px] border-ink bg-flag px-7 py-3.5 font-display text-base text-ink transition hover:bg-gold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Importing..." : "Import"}
            </button>
          </div>
        </form>

        {status && (
          <div
              role="status"
            className="card mt-8 flex items-center gap-3 px-5 py-4 text-sm text-ink-2"
          >
            <span className="h-2.5 w-2.5 animate-pulse bg-flag" />
            {status}
          </div>
        )}

        {error && (
          <div
              role="alert"
            className="card mt-8 border-whistle bg-whistle px-5 py-4 text-sm text-bone"
          >
            {error}
          </div>
        )}

        {leagues && !snapshot && (
          <section className="mt-10">
            <h2 className="on-field font-display text-xl text-chalk">
              Pick a league
            </h2>
            <ul className="mt-4 space-y-2">
              {leagues.map((l) => (
                <li key={l.leagueId}>
                  <button
                    onClick={() => pickLeague(l.leagueId)}
                    disabled={busy}
                    className="card flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-gold disabled:opacity-50"
                  >
                    <span>
                      <span className="block font-display text-base">{l.name}</span>
                      <span className="text-sm text-ink-2">
                        {l.season} season / {l.teamCount} teams
                      </span>
                    </span>
                    <Icon name="arrow-right" className="h-4 w-4 shrink-0 text-ink-2" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {snapshot && (
          <ConfirmLeague
            snapshot={snapshot}
            busy={busy}
            overrides={overrides}
            onOverrides={applyOverrides}
            onContinue={goToDashboard}
          />
        )}
      </div>
    </main>
  );
}

/**
 * Confirm-and-correct.
 *
 * Everything on this screen was read from the league rather than chosen, so it
 * asks "does this look right?" The headline numbers stay visible; the full
 * editable rule and scoring lists sit behind a disclosure, which keeps the
 * screen calm when you are importing one of several leagues.
 */
function ConfirmLeague({
  snapshot,
  busy,
  overrides,
  onOverrides,
  onContinue,
}: {
  snapshot: Snapshot;
  busy: boolean;
  overrides: Overrides;
  onOverrides: (next: Overrides) => void;
  onContinue: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { league, settings, scoring } = snapshot;
  const setCount = settings.filter((s) => s.value !== null).length;
  const editCount =
    (overrides.format ? 1 : 0) +
    Object.keys(overrides.rules).length +
    Object.keys(overrides.scoring).length;

  return (
    <section className="card deal mt-10">
      <div className="strip flex items-center gap-2 px-5 py-2.5">
        <Icon name="check" className="h-3.5 w-3.5 text-gold" />
        <span className="font-display text-sm">LEAGUE IMPORTED</span>
      </div>

      <div className="px-5 pt-5 sm:px-6">
        <h2 className="font-display text-3xl leading-none">{league.name}</h2>
        <p className="mt-2 text-sm text-ink-2">
          {league.sportLabel} / {league.teamCount} teams / scoring against the {league.statsSeason}{" "}
        season
        {league.statsSeason !== league.season && " (the last one played)"}
        </p>

      <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4">
        {[
          { label: "Format", value: FORMAT_LABEL[league.format] },
          {
            label: "Starting slots",
            value: league.rosterSize ? String(league.rosterSize) : "—",
          },
          { label: "Rostered players", value: String(league.rosteredCount) },
          { label: "With scoreable stats", value: String(league.scoredCount) },
        ].map((s) => (
          <div key={s.label}>
            <dt className="text-xs text-ink-2">{s.label}</dt>
            <dd className="nums mt-1 font-display text-2xl">
              {s.value}
            </dd>
          </div>
        ))}
      </dl>

      {/* Everything editable lives behind one disclosure so importing a league
          does not open onto a wall of form fields. */}
      <div className="mt-7 border-t-[3px] border-ink pt-6">
        <button
              type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-4 text-left"
        >
          <span>
            <span className="font-display text-sm">
              League rules &amp; scoring
            </span>
            <span className="mt-1 block text-xs text-ink-2">
              {setCount} rule{setCount === 1 ? "" : "s"} and {scoring.length} scoring value
              {scoring.length === 1 ? "" : "s"} read from Sleeper
              {editCount > 0 && ` / ${editCount} edited`}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs text-ink-2">
            {open ? "Hide" : "Review & edit"}
            <Icon
              name="chevron-down"
              className={`h-2.5 w-2.5 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </span>
        </button>

        {open && (
          <div className="mt-6">
            <LeagueRulesEditor
              format={league.format}
              formatInferred={league.formatInferred}
              supportsCategories={league.supportsCategories}
              settings={settings}
              scoring={scoring}
              overrides={overrides}
              busy={busy}
              onChange={onOverrides}
              onReset={() => onOverrides(EMPTY_OVERRIDES)}
            />
          </div>
        )}
      </div>

      {league.userTeamId === null && (
        <p className="mt-7 border-[3px] border-ink bg-bone-2 px-5 py-4 text-sm text-ink-2">
          We could not tell which team is yours, import by username instead of league ID to
          unlock My Team and trade suggestions.
        </p>
      )}

      <button
        onClick={onContinue}
        disabled={busy}
        className="mt-7 mb-6 inline-flex w-full items-center justify-center gap-2.5 border-[3px] border-ink bg-flag px-7 py-4 font-display text-lg text-ink transition hover:bg-gold disabled:opacity-50 sm:w-auto"
      >
        Looks right, continue
        <Icon name="arrow-right" className="h-4 w-4" />
      </button>
      </div>
    </section>
  );
}
