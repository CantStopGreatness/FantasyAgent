"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  EMPTY_OVERRIDES,
  LeagueRulesEditor,
  type Overrides,
} from "@/components/LeagueRulesEditor";
import { FORMAT_LABEL, saveSession, type Snapshot } from "@/lib/types";

type Mode = "username" | "leagueId";
type LeagueOption = { leagueId: string; name: string; season: string; teamCount: number };

export default function Setup() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("username");
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
    setStatus("Reading rosters, scoring settings, and league rulesÃ¢â‚¬Â¦");
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
        setStatus("Finding your leaguesÃ¢â‚¬Â¦");
        const res = await fetch("/api/leagues", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ username: value.trim() }),
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
    <main className="min-h-dvh">
      <header className="border-b border-edge">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <Link href="/" className="font-display text-xl font-bold tracking-wide">
            COURT<span className="text-orange">IQ</span>
          </Link>
          <span className="text-xs uppercase tracking-[0.2em] text-muted">Import</span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-14">
        <h1 className="font-display text-4xl font-bold uppercase tracking-tight sm:text-5xl">
          Connect your league
        </h1>
        <p className="mt-3 max-w-lg text-muted">
          CourtIQ reads your NBA league from Sleeper: rosters, scoring settings, and league
          context for the optional analyst explanation.
        </p>

        <form onSubmit={handleSubmit} className="mt-10">
          <div className="inline-flex rounded-lg border border-edge bg-panel p-1">
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
                className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                  mode === m ? "bg-card text-ink" : "text-muted hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={mode === "username" ? "e.g. yourhandle" : "e.g. 1234567890123456789"}
              autoComplete="off"
              spellCheck={false}
              className="flex-1 rounded-lg border border-edge bg-panel px-4 py-3.5 text-ink placeholder:text-muted/60 focus:border-teal focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || !value.trim()}
              className="rounded-lg bg-orange px-7 py-3.5 font-display text-base font-semibold uppercase tracking-wide text-[#1a0d06] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? "ImportingÃ¢â‚¬Â¦" : "Import"}
            </button>
          </div>
        </form>

        {status && (
          <div
            role="status"
            className="mt-8 flex items-center gap-3 rounded-lg border border-edge bg-panel px-5 py-4 text-sm text-muted"
          >
            <span className="h-2 w-2 animate-pulse rounded-full bg-teal" />
            {status}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mt-8 rounded-lg border border-red/40 bg-red/10 px-5 py-4 text-sm text-ink"
          >
            {error}
          </div>
        )}

        {leagues && !snapshot && (
          <section className="mt-10">
            <h2 className="font-display text-xl font-semibold uppercase tracking-wide">
              Pick a league
            </h2>
            <ul className="mt-4 space-y-2">
              {leagues.map((l) => (
                <li key={l.leagueId}>
                  <button
                    onClick={() => pickLeague(l.leagueId)}
                    disabled={busy}
                    className="flex w-full items-center justify-between rounded-lg border border-edge bg-panel px-5 py-4 text-left transition hover:border-teal/60 disabled:opacity-50"
                  >
                    <span>
                      <span className="block font-medium">{l.name}</span>
                      <span className="text-sm text-muted">
                        {l.season} season Ã‚Â· {l.teamCount} teams
                      </span>
                    </span>
                    <span aria-hidden className="text-muted">
                      Ã¢â€ â€™
                    </span>
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
    <section className="mt-10 rounded-xl border border-edge bg-panel p-7">
      <div className="flex items-center gap-2 text-sm text-green">
        <span className="h-1.5 w-1.5 rounded-full bg-green" />
        League imported
      </div>

      <h2 className="mt-3 font-display text-3xl font-bold uppercase tracking-tight">
        {league.name}
      </h2>
      <p className="mt-1.5 text-sm text-muted">
        {league.sportLabel} Ã‚Â· {league.teamCount} teams Ã‚Â· scoring against the {league.statsSeason}{" "}
        season
        {league.statsSeason !== league.season && " (the last one played)"}
      </p>

      <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4">
        {[
          { label: "Format", value: FORMAT_LABEL[league.format] },
          {
            label: "Starting slots",
            value: league.rosterSize ? String(league.rosterSize) : "Ã¢â‚¬â€",
          },
          { label: "Rostered players", value: String(league.rosteredCount) },
          { label: "With scoreable stats", value: String(league.scoredCount) },
        ].map((s) => (
          <div key={s.label}>
            <dt className="text-xs uppercase tracking-[0.12em] text-muted">{s.label}</dt>
            <dd className="nums mt-1.5 font-display text-2xl font-semibold text-teal">
              {s.value}
            </dd>
          </div>
        ))}
      </dl>

      {/* Everything editable lives behind one disclosure so importing a league
          does not open onto a wall of form fields. */}
      <div className="mt-7 border-t border-edge pt-6">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-4 text-left"
        >
          <span>
            <span className="font-display text-sm font-semibold uppercase tracking-[0.12em]">
              League rules &amp; scoring
            </span>
            <span className="mt-1 block text-xs text-muted">
              {setCount} rule{setCount === 1 ? "" : "s"} and {scoring.length} scoring value
              {scoring.length === 1 ? "" : "s"} read from Sleeper
              {editCount > 0 && ` Ã‚Â· ${editCount} edited`}
            </span>
          </span>
          <span className="shrink-0 whitespace-nowrap text-xs text-muted">
            {open ? "Hide" : "Review & edit"}{" "}
            <span aria-hidden className={open ? "inline-block rotate-180" : "inline-block"}>
              Ã¢â€“Â¾
            </span>
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
        <p className="mt-7 rounded-lg border border-edge bg-card px-5 py-4 text-sm text-muted">
          We could not tell which team is yours, import by username instead of league ID to
          unlock My Team and trade suggestions.
        </p>
      )}

      <button
        onClick={onContinue}
        disabled={busy}
        className="mt-7 w-full rounded-lg bg-orange px-7 py-4 font-display text-lg font-semibold uppercase tracking-wide text-[#1a0d06] transition hover:brightness-110 disabled:opacity-40 sm:w-auto"
      >
        Looks right, continue Ã¢â€ â€™
      </button>
    </section>
  );
}
