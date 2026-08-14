"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveSession, type Snapshot } from "@/lib/types";

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

  async function loadLeague(leagueId: string, resolvedUserId: string | null) {
    setStatus("Reading rosters and scoring settings…");
    const res = await fetch("/api/snapshot", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ leagueId, userId: resolvedUserId }),
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
            `${data.user.displayName} has no NBA leagues on Sleeper for ${data.season}. Try importing by league ID instead.`,
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

  function goToDashboard() {
    if (!snapshot) return;
    saveSession({
      leagueId: snapshot.league.leagueId,
      userId,
      league: snapshot.league,
      teams: snapshot.teams,
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
          CourtIQ reads your league straight from Sleeper — rosters, scoring settings, and every
          player still on the wire.
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
          <section className="mt-10 rounded-xl border border-edge bg-panel p-7">
            <div className="flex items-center gap-2 text-sm text-green">
              <span className="h-1.5 w-1.5 rounded-full bg-green" />
              League imported
            </div>

            <h2 className="mt-3 font-display text-3xl font-bold uppercase tracking-tight">
              {snapshot.league.name}
            </h2>

            <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4">
              {[
                { label: "Teams", value: String(snapshot.league.teamCount) },
                {
                  label: "Format detected",
                  value: snapshot.league.detectedFormat === "category" ? "9-CAT" : "Points",
                },
                { label: "Rostered players", value: String(snapshot.league.rosteredCount) },
                { label: "With scoreable stats", value: String(snapshot.league.scoredCount) },
              ].map((s) => (
                <div key={s.label}>
                  <dt className="text-xs uppercase tracking-[0.12em] text-muted">{s.label}</dt>
                  <dd className="nums mt-1.5 font-display text-2xl font-semibold text-teal">
                    {s.value}
                  </dd>
                </div>
              ))}
            </dl>

            <p className="mt-7 text-sm leading-relaxed text-muted">
              Scoring against the {snapshot.league.statsSeason} season
              {snapshot.league.statsSeason !== snapshot.league.season && " (the last one played)"}.
              {snapshot.league.userTeamId === null &&
                " We could not tell which team is yours — import by username to unlock trade suggestions."}
            </p>

            <button
              onClick={goToDashboard}
              className="mt-7 w-full rounded-lg bg-orange px-7 py-4 font-display text-lg font-semibold uppercase tracking-wide text-[#1a0d06] transition hover:brightness-110 sm:w-auto"
            >
              Continue to dashboard →
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
