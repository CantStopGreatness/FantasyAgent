"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { FormatToggle } from "@/components/FormatToggle";
import { PersonaCallout } from "@/components/PersonaCallout";
import { HeroCard, PlayerList } from "@/components/PlayerCards";
import { TradePanel } from "@/components/TradePanel";
import {
  clearSession,
  loadSession,
  type BoardResponse,
  type ScoringFormat,
  type Session,
} from "@/lib/types";

type Tab = "waivers" | "sleepers" | "team" | "trades";

const TABS: { id: Tab; label: string }[] = [
  { id: "waivers", label: "Waiver Wire" },
  { id: "sleepers", label: "Sleepers" },
  { id: "team", label: "My Team" },
  { id: "trades", label: "Trades" },
];

export default function Dashboard() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [format, setFormat] = useState<ScoringFormat>("category");
  const [tab, setTab] = useState<Tab>("waivers");

  const [board, setBoard] = useState<BoardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Boards are pure functions of (view, format) — hold them so flipping the
  // toggle back and forth is instant rather than a fresh round trip.
  const cache = useRef(new Map<string, BoardResponse>());

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      router.replace("/setup");
      return;
    }
    setSession(s);
    setFormat(s.league.detectedFormat);
  }, [router]);

  const fetchBoard = useCallback(
    async (view: "waivers" | "sleepers" | "roster", fmt: ScoringFormat) => {
      if (!session) return;
      const key = `${view}:${fmt}`;
      const cached = cache.current.get(key);
      if (cached) {
        setBoard(cached);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/board", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            leagueId: session.leagueId,
            userId: session.userId,
            format: fmt,
            view,
            rosterId: view === "roster" ? session.league.userTeamId : undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not load recommendations.");
        cache.current.set(key, data);
        setBoard(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setBoard(null);
      } finally {
        setLoading(false);
      }
    },
    [session],
  );

  useEffect(() => {
    if (!session || tab === "trades") return;
    const view = tab === "team" ? "roster" : tab;
    void fetchBoard(view, format);
  }, [session, tab, format, fetchBoard]);

  if (!session) {
    return (
      <main className="grid min-h-dvh place-items-center">
        <p className="text-muted">Loading your league…</p>
      </main>
    );
  }

  const { league } = session;

  return (
    <main className="min-h-dvh">
      {/* Slim top bar — league settings live here as a badge, not a sidebar. */}
      <header className="sticky top-0 z-20 border-b border-edge bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-3 px-6 py-4">
          <Link href="/" className="font-display text-xl font-bold tracking-wide">
            COURT<span className="text-orange">IQ</span>
          </Link>

          <span aria-hidden className="hidden h-5 w-px bg-edge sm:block" />

          <div className="min-w-0 flex-1">
            <p className="truncate font-medium leading-tight">{league.name}</p>
            <p className="text-xs text-muted">
              {league.teamCount} teams · {league.statsSeason} stats
            </p>
          </div>

          <FormatToggle value={format} onChange={setFormat} disabled={loading} />

          <button
            onClick={() => {
              clearSession();
              router.push("/setup");
            }}
            className="text-xs text-muted underline-offset-4 hover:text-ink hover:underline"
          >
            Switch league
          </button>
        </div>

        <nav className="mx-auto max-w-5xl px-6">
          <ul className="-mb-px flex gap-1 overflow-x-auto">
            {TABS.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => setTab(t.id)}
                  className={`whitespace-nowrap border-b-2 px-4 py-3 font-display text-sm font-semibold uppercase tracking-wide transition ${
                    tab === t.id
                      ? "border-orange text-ink"
                      : "border-transparent text-muted hover:text-ink"
                  }`}
                >
                  {t.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-10">
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red/40 bg-red/10 px-6 py-5 text-sm"
          >
            {error}
          </div>
        )}

        {tab === "trades" ? (
          <TradePanel session={session} format={format} />
        ) : (
          <BoardView tab={tab} board={board} loading={loading} format={format} league={league} />
        )}
      </div>
    </main>
  );
}

function BoardView({
  tab,
  board,
  loading,
  format,
  league,
}: {
  tab: Tab;
  board: BoardResponse | null;
  loading: boolean;
  format: ScoringFormat;
  league: Session["league"];
}) {
  const heading =
    tab === "waivers"
      ? "Best available"
      : tab === "sleepers"
        ? "Trending up"
        : (board?.team?.teamName ?? "My team");

  const blurb =
    tab === "waivers"
      ? `Unrostered players ranked for ${format === "category" ? "9-category" : "points"} scoring.`
      : tab === "sleepers"
        ? "Under-owned players whose role is growing."
        : "Your roster, scored under the active format.";

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
      <div>
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight">{heading}</h1>
        <p className="mt-1.5 text-sm text-muted">{blurb}</p>
      </div>

      {loading && !board ? (
        <BoardSkeleton />
      ) : !board || board.players.length === 0 ? (
        <EmptyState
          title="Nothing to show here"
          body={
            tab === "waivers"
              ? "Every fantasy-relevant player in this league is already rostered — a good problem to have."
              : "We could not score enough players for this view."
          }
        />
      ) : (
        <>
          {tab !== "team" && (
            <PersonaCallout commentary={board.commentary ?? null} loading={loading} />
          )}

          {tab === "waivers" && (
            <HeroCard card={board.players[0]} format={format} label="Top pickup" />
          )}

          <PlayerList
            cards={tab === "waivers" ? board.players.slice(1) : board.players}
            format={format}
          />

          {board.unscored ? (
            <p className="text-xs text-muted">
              {board.unscored} player{board.unscored === 1 ? "" : "s"} on this roster had no
              scoreable stats for {league.statsSeason} and {board.unscored === 1 ? "is" : "are"} not
              listed.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div className="space-y-8" aria-hidden>
      <div className="h-28 animate-pulse rounded-xl border border-edge bg-panel" />
      <div className="h-36 animate-pulse rounded-xl border border-edge bg-card" />
      <div className="space-y-px overflow-hidden rounded-xl border border-edge">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse bg-panel" />
        ))}
      </div>
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-edge px-8 py-14 text-center">
      <h2 className="font-display text-xl font-semibold uppercase tracking-wide">{title}</h2>
      <p className="mx-auto mt-2.5 max-w-md text-sm leading-relaxed text-muted">{body}</p>
    </div>
  );
}
