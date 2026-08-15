"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  FORMAT_LABEL,
  saveSession,
  type LeagueSetting,
  type ScoringFormat,
  type Snapshot,
} from "@/lib/types";

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

  // The user's correction to the inferred format, if they made one.
  const [formatChoice, setFormatChoice] = useState<ScoringFormat | null>(null);

  async function loadLeague(
    leagueId: string,
    resolvedUserId: string | null,
    format: ScoringFormat | null = null,
  ) {
    setStatus("Reading rosters, scoring settings, and league rules…");
    const res = await fetch("/api/snapshot", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ leagueId, userId: resolvedUserId, format }),
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
    setFormatChoice(null);

    try {
      if (mode === "leagueId") {
        await loadLeague(value.trim(), null);
      } else {
        setStatus("Finding your leagues…");
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

  /** Re-score the league under a corrected format before continuing. */
  async function correctFormat(next: ScoringFormat) {
    if (!snapshot || busy) return;
    setFormatChoice(next);
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
      teams: snapshot.teams,
      confirmedFormat: formatChoice ?? snapshot.league.format,
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
          CourtIQ reads your league straight from Sleeper — rosters, scoring settings, and the
          rules that decide what a good move actually is.
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
              {busy ? "Importing…" : "Import"}
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
                        {l.season} season · {l.teamCount} teams
                      </span>
                    </span>
                    <span aria-hidden className="text-muted">
                      →
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
            onCorrectFormat={correctFormat}
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
 * Everything here was read from the league rather than chosen by the user, so
 * the screen asks "does this look right?" instead of offering settings. The
 * format is the one field with a correction control, because Sleeper publishes
 * no category-vs-points flag and our read of it is an inference.
 */
function ConfirmLeague({
  snapshot,
  busy,
  onCorrectFormat,
  onContinue,
}: {
  snapshot: Snapshot;
  busy: boolean;
  onCorrectFormat: (f: ScoringFormat) => void;
  onContinue: () => void;
}) {
  const { league, settings } = snapshot;

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
        {league.sportLabel} · {league.teamCount} teams · scoring against the {league.statsSeason}{" "}
        season
        {league.statsSeason !== league.season && " (the last one played)"}
      </p>

      {/* Format gets its own block: it is the one value we infer. */}
      <div className="mt-7 rounded-lg border border-edge bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-muted">Scoring format</p>
            <p className="mt-1 font-display text-2xl font-semibold text-teal">
              {FORMAT_LABEL[league.format]}
            </p>
          </div>

          {league.supportsCategories ? (
            <div className="text-right">
              <p className="text-xs text-muted">Not right?</p>
              <button
                onClick={() =>
                  onCorrectFormat(league.format === "category" ? "points" : "category")
                }
                disabled={busy}
                className="mt-1.5 rounded-md border border-edge px-3 py-1.5 text-sm text-ink transition hover:border-teal/60 disabled:opacity-40"
              >
                Switch to {FORMAT_LABEL[league.format === "category" ? "points" : "category"]}
              </button>
            </div>
          ) : (
            <p className="max-w-[16rem] text-right text-xs text-muted">
              {league.sportLabel} leagues are points-only.
            </p>
          )}
        </div>

        {league.formatInferred && league.supportsCategories && (
          <p className="mt-4 border-t border-edge pt-4 text-xs leading-relaxed text-muted">
            Sleeper does not publish a category-vs-points flag, so we read this from your
            league&apos;s per-stat scoring values. Worth a glance before you continue — every
            ranking depends on it.
          </p>
        )}
      </div>

      <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4">
        {[
          { label: "Teams", value: String(league.teamCount) },
          {
            label: "Starting slots",
            value: league.rosterSize ? String(league.rosterSize) : "—",
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

      {settings.length > 0 && (
        <div className="mt-8 border-t border-edge pt-7">
          <h3 className="font-display text-sm font-semibold uppercase tracking-[0.12em] text-muted">
            League rules we picked up
          </h3>
          <p className="mt-1.5 text-xs text-muted">
            These shape the advice — a pickup before the trade deadline is a different call than
            one after it.
          </p>
          <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {settings.map((s: LeagueSetting) => (
              <div key={s.key} className="flex items-baseline justify-between gap-4">
                <dt className="text-sm text-muted">{s.label}</dt>
                <dd className="nums text-sm font-medium">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {league.userTeamId === null && (
        <p className="mt-7 rounded-lg border border-edge bg-card px-5 py-4 text-sm text-muted">
          We could not tell which team is yours — import by username instead of league ID to
          unlock My Team and trade suggestions.
        </p>
      )}

      <button
        onClick={onContinue}
        disabled={busy}
        className="mt-7 w-full rounded-lg bg-orange px-7 py-4 font-display text-lg font-semibold uppercase tracking-wide text-[#1a0d06] transition hover:brightness-110 disabled:opacity-40 sm:w-auto"
      >
        Looks right — continue →
      </button>
    </section>
  );
}
