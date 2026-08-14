"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PersonaCallout } from "./PersonaCallout";
import { PlayerList } from "./PlayerCards";
import type { BoardResponse, ScoringFormat, Session, TradeResponse } from "@/lib/types";

const FAIRNESS_COPY: Record<string, { label: string; className: string }> = {
  even: { label: "Even value", className: "text-green" },
  "you-gain-value": { label: "Leans your way", className: "text-green" },
  "you-give-up-value": { label: "You give up a little value", className: "text-orange" },
};

export function TradePanel({ session, format }: { session: Session; format: ScoringFormat }) {
  const opponents = session.teams.filter((t) => !t.isUserTeam);
  const [selected, setSelected] = useState<number | null>(opponents[0]?.rosterId ?? null);

  const [roster, setRoster] = useState<BoardResponse | null>(null);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [trade, setTrade] = useState<TradeResponse | null>(null);
  const [tradeLoading, setTradeLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rosterCache = useRef(new Map<string, BoardResponse>());

  const loadRoster = useCallback(
    async (rosterId: number, fmt: ScoringFormat) => {
      const key = `${rosterId}:${fmt}`;
      const cached = rosterCache.current.get(key);
      if (cached) {
        setRoster(cached);
        return;
      }
      setRosterLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/board", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            leagueId: session.leagueId,
            userId: session.userId,
            format: fmt,
            view: "roster",
            rosterId,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not load that roster.");
        rosterCache.current.set(key, data);
        setRoster(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setRoster(null);
      } finally {
        setRosterLoading(false);
      }
    },
    [session],
  );

  // Selecting a team or flipping format invalidates any suggestion on screen.
  useEffect(() => {
    setTrade(null);
    if (selected !== null) void loadRoster(selected, format);
  }, [selected, format, loadRoster]);

  async function suggestTrade() {
    if (selected === null || tradeLoading) return;
    setTradeLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/trade", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          leagueId: session.leagueId,
          userId: session.userId,
          partnerRosterId: selected,
          format,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not build a trade.");
      setTrade(data as TradeResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setTradeLoading(false);
    }
  }

  if (session.league.userTeamId === null) {
    return (
      <div className="rounded-xl border border-dashed border-edge px-8 py-14 text-center">
        <h2 className="font-display text-xl font-semibold uppercase tracking-wide">
          Trades need to know your team
        </h2>
        <p className="mx-auto mt-2.5 max-w-md text-sm leading-relaxed text-muted">
          Re-import this league with your Sleeper username and CourtIQ can compare your roster
          against every other team.
        </p>
      </div>
    );
  }

  const selectedTeam = opponents.find((t) => t.rosterId === selected);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight">Trade desk</h1>
        <p className="mt-1.5 text-sm text-muted">
          Pick a team, read their roster, and let CourtIQ find the imbalance.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {opponents.map((t) => (
          <button
            key={t.rosterId}
            onClick={() => setSelected(t.rosterId)}
            className={`shrink-0 rounded-lg border px-4 py-2.5 text-left transition ${
              selected === t.rosterId
                ? "border-teal bg-teal/10"
                : "border-edge bg-panel hover:border-muted/40"
            }`}
          >
            <span className="block max-w-[11rem] truncate text-sm font-medium">{t.teamName}</span>
            <span className="block text-xs text-muted">{t.playerCount} players</span>
          </button>
        ))}
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red/40 bg-red/10 px-6 py-5 text-sm">
          {error}
        </div>
      )}

      {selectedTeam && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="font-display text-xl font-semibold uppercase tracking-wide">
              {selectedTeam.teamName}
            </h2>
            <button
              onClick={suggestTrade}
              disabled={tradeLoading || rosterLoading}
              className="rounded-lg bg-orange px-6 py-3 font-display text-sm font-semibold uppercase tracking-wide text-[#1a0d06] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {tradeLoading ? "Working the phones…" : "Suggest a trade"}
            </button>
          </div>

          {trade && (
            <div className="space-y-6">
              {trade.found ? (
                <>
                  <div className="rounded-xl border border-edge bg-card p-6 sm:p-7">
                    <div className="grid gap-5 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                      <TradeSide
                        label="You send"
                        name={trade.give.name}
                        meta={`${trade.give.position} · ${trade.give.team}`}
                        stats={trade.give.statLine}
                        score={trade.give.scoreLabel}
                      />
                      <div
                        aria-hidden
                        className="grid place-items-center font-display text-2xl text-muted"
                      >
                        <span className="hidden sm:block">⇄</span>
                        <span className="sm:hidden">↓</span>
                      </div>
                      <TradeSide
                        label="You get"
                        name={trade.receive.name}
                        meta={`${trade.receive.position} · ${trade.receive.team}`}
                        stats={trade.receive.statLine}
                        score={trade.receive.scoreLabel}
                        highlight
                      />
                    </div>

                    <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-edge pt-5 text-xs text-muted">
                      <span>
                        You&apos;re thin at{" "}
                        <span className="text-ink">{trade.userNeed}</span>
                      </span>
                      <span>
                        They&apos;re thin at{" "}
                        <span className="text-ink">{trade.partnerNeed}</span>
                      </span>
                      <span className={FAIRNESS_COPY[trade.fairness]?.className}>
                        {FAIRNESS_COPY[trade.fairness]?.label}
                      </span>
                    </div>
                  </div>

                  <PersonaCallout commentary={trade.commentary} />
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-edge px-8 py-12 text-center">
                  <h3 className="font-display text-lg font-semibold uppercase tracking-wide">
                    No trade worth making
                  </h3>
                  <p className="mx-auto mt-2.5 max-w-md text-sm leading-relaxed text-muted">
                    {trade.reason}
                  </p>
                </div>
              )}
            </div>
          )}

          {rosterLoading ? (
            <div className="h-64 animate-pulse rounded-xl border border-edge bg-panel" />
          ) : roster && roster.players.length > 0 ? (
            <PlayerList cards={roster.players} format={format} />
          ) : null}
        </>
      )}
    </div>
  );
}

function TradeSide({
  label,
  name,
  meta,
  stats,
  score,
  highlight,
}: {
  label: string;
  name: string;
  meta: string;
  stats: string;
  score: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p
        className={`text-xs uppercase tracking-[0.15em] ${highlight ? "text-teal" : "text-muted"}`}
      >
        {label}
      </p>
      <p className="mt-2 font-display text-2xl font-bold uppercase tracking-tight">{name}</p>
      <p className="mt-1 text-sm text-muted">{meta}</p>
      <p className="nums mt-3 text-xs text-muted">{stats}</p>
      <p className="nums mt-2 font-display text-lg font-semibold text-teal">{score}</p>
    </div>
  );
}
