"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { DribbleLoader } from "@/components/PixelScenes";
import { LeagueBadge } from "@/components/LeagueBadge";
import { PersonaCallout } from "@/components/PersonaCallout";
import { HeroCard, PlayerList } from "@/components/PlayerCards";
import { TradePanel } from "@/components/TradePanel";
import type { Overrides } from "@/components/LeagueRulesEditor";
import { useSession } from "@/lib/useSession";
import { clearSession, saveSession, type BoardResponse, type Session } from "@/lib/types";

type Tab = "waivers" | "sleepers" | "team" | "trades";

const TABS: { id: Tab; label: string }[] = [
  { id: "waivers", label: "Waiver Wire" },
  { id: "sleepers", label: "Sleepers" },
  { id: "team", label: "My Team" },
  { id: "trades", label: "Trades" },
];

export default function Dashboard() {
  const router = useRouter();
  const session = useSession();
  const [tab, setTab] = useState<Tab>("waivers");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Boards are a pure function of the view, so hold them all and derive the
  // visible one. Keeping them in state rather than a ref lets the fetch effect
  // bail out when the data is already here, instead of re-pushing it into
  // state on every tab switch.
  const [boards, setBoards] = useState<Record<string, BoardResponse>>({});
  const activeView: "waivers" | "sleepers" | "roster" =
    tab === "team" ? "roster" : tab === "sleepers" ? "sleepers" : "waivers";
  const board = boards[activeView] ?? null;

  // A visitor without an imported league belongs on /setup. useSession reports
  // null on the first hydration pass too, so wait a tick before deciding.
  const [checkedStorage, setCheckedStorage] = useState(false);
  useEffect(() => {
    if (session) return;
    const id = setTimeout(() => setCheckedStorage(true), 0);
    return () => clearTimeout(id);
  }, [session]);

  useEffect(() => {
    if (checkedStorage && !session) router.replace("/setup");
  }, [checkedStorage, session, router]);

  /**
   * Apply a settings correction made from the top bar.
   *
   * Supported scoring edits change the rankings, so the cached boards are dropped and
   * the league is re-read rather than the display simply being relabelled.
   */
  const applyOverrides = useCallback(
    async (next: Overrides) => {
      if (!session) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/snapshot", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            leagueId: session.leagueId,
            userId: session.userId,
            format: next.format,
            ruleOverrides: next.rules,
            scoringOverrides: next.scoring,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not apply those settings.");

        // A supported scoring correction re-scores everything, so every held board is stale.
        setBoards({});
        saveSession({
          ...session,
          league: data.league,
          settings: data.settings,
          scoring: data.scoring,
          confirmedFormat: next.format ?? data.league.format,
          ruleOverrides: next.rules,
          scoringOverrides: next.scoring,
        });
        // useSession reads localStorage through an external store. The storage
        // event only fires for other tabs, so nudge this one.
        window.dispatchEvent(new StorageEvent("storage", { key: "courtiq.session" }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setLoading(false);
      }
    },
    [session],
  );

  const fetchBoard = useCallback(
    async (view: "waivers" | "sleepers" | "roster") => {
      if (!session) return;

      // Demo and live leagues both use the same API and deterministic engine.
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/board", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            leagueId: session.leagueId,
            userId: session.userId,
            format: session.confirmedFormat,
            ruleOverrides: session.ruleOverrides,
            scoringOverrides: session.scoringOverrides,
            view,
            rosterId: view === "roster" ? session.league.userTeamId : undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not load recommendations.");
        setBoards((b) => ({ ...b, [view]: data }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setLoading(false);
      }
    },
    [session],
  );

  useEffect(() => {
    if (!session || tab === "trades") return;
    // Already loaded; nothing to do and nothing to write into state.
    if (boards[activeView]) return;
    // The only synchronous state write left inside fetchBoard is the loading
    // flag that marks the request starting, which is the intended pattern for
    // fetching in an effect. Results land after an await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchBoard(activeView);
  }, [session, tab, activeView, boards, fetchBoard]);

  if (!session) {
    return (
      <main className="turf grid min-h-dvh place-items-center">
        <p className="font-display text-bone">Loading your league...</p>
      </main>
    );
  }

  const { league } = session;

  return (
    <main className="turf min-h-dvh pb-16">
      {/* The scoreboard: league identity and rules, stamped across the top. */}
      <header className="strip sticky top-0 z-20 border-b-[3px] border-ink">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-3 px-5 py-3 sm:px-6">
          <Link href="/" className="shrink-0 font-display text-xl text-bone">
            COURT<span className="text-gold">IQ</span>
          </Link>

          <div className="order-4 flex min-w-0 basis-full items-baseline gap-2 sm:order-none sm:block sm:basis-auto sm:flex-1">
            <p className="min-w-0 flex-1 truncate font-display text-sm leading-tight">
              {league.name}
            </p>
            <p className="nums shrink-0 text-xs text-bone-3">
              {league.teamCount} teams / {league.statsSeason} stats
            </p>
          </div>

          <LeagueBadge session={session} busy={loading} onOverrides={applyOverrides} />

          <button
            onClick={() => {
              clearSession();
              router.push("/setup");
            }}
            className="text-xs text-bone-3 underline-offset-4 hover:text-gold hover:underline"
          >
            Switch league
          </button>
        </div>

        <nav className="mx-auto max-w-5xl px-3 sm:px-6">
          <ul className="flex gap-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TABS.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => setTab(t.id)}
                  aria-current={tab === t.id ? "page" : undefined}
                  className={`whitespace-nowrap border-x-[3px] border-t-[3px] px-3 py-2.5 font-display text-xs transition sm:px-4 sm:text-sm ${
                    tab === t.id
                      ? "border-ink bg-bone text-ink"
                      : "border-transparent text-bone-3 hover:text-gold"
                  }`}
                >
                  {t.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-6">
        {error && (
          <div
            role="alert"
            className="card mb-6 flex items-start gap-3 border-whistle bg-whistle px-5 py-4 text-sm text-bone"
          >
            <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {tab === "trades" ? (
          <TradePanel session={session} />
        ) : (
          <BoardView tab={tab} board={board} loading={loading} session={session} />
        )}
      </div>
    </main>
  );
}

function BoardView({
  tab,
  board,
  loading,
  session,
}: {
  tab: Tab;
  board: BoardResponse | null;
  loading: boolean;
  session: Session;
}) {
  const { league } = session;
  const formatWord = league.format === "category" ? "category" : "points";

  const heading =
    tab === "waivers"
      ? "Best available"
      : tab === "sleepers"
        ? "Trending up"
        : (board?.team?.teamName ?? "My team");

  const blurb =
    tab === "waivers"
      ? `Unrostered players, ranked for your league's ${formatWord} scoring.`
      : tab === "sleepers"
        ? "Available players surfaced by recent form, Sleeper add activity, and per-36 output."
        : "Your roster, scored under the active scoring setup.";

  if (tab === "team" && league.userTeamId === null) {
    return (
      <EmptyState
        title="We don't know which team is yours"
        body="Import your league with your Sleeper username instead of a league ID and CourtIQ can pick out your roster."
      />
    );
  }

  return (
    <div className="space-y-8">
      <div className="on-field">
        {session.leagueId === "demo" && (
          <p className="mb-3 text-xs uppercase tracking-[0.12em] text-bone-3">
            Frozen synthetic sample - not current player, team, injury, schedule, or ownership
            information.
          </p>
        )}
        <h1 className="font-display text-3xl text-chalk sm:text-4xl">{heading}</h1>
        <p className="mt-1.5 text-sm text-bone-2">{blurb}</p>
      </div>

      {loading && !board ? (
        <BoardSkeleton />
      ) : !board || board.players.length === 0 ? (
        <EmptyState
          title="Nothing to show here"
          body={
            tab === "waivers"
              ? "Every fantasy-relevant player in this league is already rostered - a good problem to have."
              : "We could not score enough players for this view."
          }
        />
      ) : (
        <>
          {tab !== "team" && (
            <PersonaCallout commentary={board.commentary ?? null} loading={loading} />
          )}

          {tab === "waivers" && (
            <HeroCard card={board.players[0]} format={league.format} label="Top pickup" />
          )}

          <PlayerList
            cards={tab === "waivers" ? board.players.slice(1) : board.players}
            format={league.format}
          />

          {board.unscored ? (
            <p className="text-xs text-bone-2">
              {board.unscored} player{board.unscored === 1 ? "" : "s"} on this roster had no
              scoreable stats for {league.statsSeason} and{" "}
              {board.unscored === 1 ? "is" : "are"} not listed.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="card flex items-center px-5 py-4">
        <DribbleLoader label="Reading the board…" />
      </div>
      <div className="card h-36 animate-pulse bg-bone-2" />
      <div className="card overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse odd:bg-bone even:bg-bone-2" />
        ))}
      </div>
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="card px-8 py-14 text-center">
      <h2 className="font-display text-xl">{title}</h2>
      <p className="mx-auto mt-2.5 max-w-md text-sm leading-relaxed text-ink-2">{body}</p>
    </div>
  );
}
