"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PersonaCallout } from "./PersonaCallout";
import { PlayerList } from "./PlayerCards";
import { TradeConditions } from "./TradeConditions";
import {
  EMPTY_INTENT,
  type BoardResponse,
  type ScoringFormat,
  type Session,
  type TradeIntent,
  type TradeResponse,
} from "@/lib/types";

const FAIRNESS_COPY: Record<string, { label: string; className: string }> = {
  even: { label: "Even value", className: "text-green" },
  "you-gain-value": { label: "Leans your way", className: "text-green" },
  "you-give-up-value": { label: "You give up a little value", className: "text-orange" },
  "worth-the-overpay": { label: "Overpay worth making", className: "text-teal" },
};

export function TradePanel({ session }: { session: Session }) {
  const format = session.league.format;
  const opponents = session.teams.filter((t) => !t.isUserTeam);
  const analysisKey = JSON.stringify({
    format,
    rules: Object.entries(session.ruleOverrides).sort(),
    scoring: Object.entries(session.scoringOverrides).sort(),
  });
  const [selected, setSelected] = useState<number | null>(opponents[0]?.rosterId ?? null);

  const [roster, setRoster] = useState<BoardResponse | null>(null);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [tradeLoading, setTradeLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [intent, setIntent] = useState<TradeIntent>(EMPTY_INTENT);
  const [myRoster, setMyRoster] = useState<BoardResponse | null>(null);

  // A suggestion is only valid for the team, format, and conditions it was
  // built for. Tagging it with that key retires it automatically when any of
  // them change, rather than clearing it from an effect — change what you
  // asked for and the deal on screen no longer answers the question.
  const [suggestion, setSuggestion] = useState<{ key: string; data: TradeResponse } | null>(null);
  const tradeKey = `${selected}:${analysisKey}:${JSON.stringify(intent)}`;
  const trade = suggestion?.key === tradeKey ? suggestion.data : null;

  const rosterCache = useRef(new Map<string, BoardResponse>());
  const activeRosterKey = useRef("");

  const loadRoster = useCallback(
    async (rosterId: number, fmt: ScoringFormat) => {
      const key = `${rosterId}:${fmt}:${analysisKey}`;
      activeRosterKey.current = key;
      const cached = rosterCache.current.get(key);
      if (cached) {
        setRoster(cached);
        return;
      }

      // Every selected roster comes from the same board API as live mode.
      setRosterLoading(true);
      setRoster(null);
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
            view: "roster",
            rosterId,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not load that roster.");
        if (data.team?.rosterId !== rosterId) {
          throw new Error("The selected team did not match the returned roster.");
        }
        rosterCache.current.set(key, data);
        if (activeRosterKey.current === key) setRoster(data);
      } catch (err) {
        if (activeRosterKey.current === key) {
          setError(err instanceof Error ? err.message : "Something went wrong.");
          setRoster(null);
        }
      } finally {
        if (activeRosterKey.current === key) setRosterLoading(false);
      }
    },
    [analysisKey, session],
  );

  useEffect(() => {
    if (selected !== null) void loadRoster(selected, format);
  }, [selected, format, loadRoster]);

  // The manager's own roster backs the "off the table" list.
  useEffect(() => {
    if (session.league.userTeamId === null) return;
    let cancelled = false;
    void (async () => {
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
            view: "roster",
            rosterId: session.league.userTeamId,
          }),
        });
        const data = await res.json();
        if (res.ok && !cancelled) setMyRoster(data);
      } catch {
        // Protect list is a convenience; its absence must not block trading.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [analysisKey, session]);

  function selectPartner(rosterId: number) {
    if (rosterId === selected) return;
    setSelected(rosterId);
    // A named target belongs to one opponent. Preserve category/protection
    // conditions across teams, but never carry an old team's player forward.
    setIntent((current) => ({ ...current, targetPlayerId: null }));
    setError(null);
  }

  async function suggestTrade() {
    if (selected === null || tradeLoading) return;

    // The deterministic trade route owns partner selection and player ownership.
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
          format: session.confirmedFormat,
          ruleOverrides: session.ruleOverrides,
          scoringOverrides: session.scoringOverrides,
          intent,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not build a trade.");
      const expectedPartner = session.teams.find((team) => team.rosterId === selected);
      if (data.found) {
        if (data.partnerTeamName !== expectedPartner?.teamName) {
          throw new Error("The selected team did not match the returned trade.");
        }
        if (!roster?.players.some((player) => player.playerId === data.receive.playerId)) {
          throw new Error("The trade target was not on the displayed partner roster.");
        }
        if (
          myRoster &&
          !myRoster.players.some((player) => player.playerId === data.give.playerId)
        ) {
          throw new Error("The trade offer was not on your roster.");
        }
      }
      setSuggestion({ key: tradeKey, data: data as TradeResponse });
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
          Pick a team and compare deterministic position-group depth.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {opponents.map((t) => (
          <button
            key={t.rosterId}
            onClick={() => selectPartner(t.rosterId)}
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
          <TradeConditions
            intent={intent}
            onChange={setIntent}
            partnerRoster={roster?.players ?? []}
            partnerTeamName={selectedTeam.teamName}
            myRoster={myRoster?.players ?? []}
            disabled={tradeLoading || rosterLoading}
          />

          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="font-display text-xl font-semibold uppercase tracking-wide">
              {selectedTeam.teamName}
            </h2>
            <button
              onClick={suggestTrade}
              disabled={tradeLoading || rosterLoading || !roster}
              className="rounded-lg bg-orange px-6 py-3 font-display text-sm font-semibold uppercase tracking-wide text-[#1a0d06] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {tradeLoading
                ? "Working the phones…"
                : intent.wantCategories.length || intent.targetPlayerId
                  ? "Find that trade"
                  : "Suggest a trade"}
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
                        meta={`${trade.give.position} / ${trade.give.team}`}
                        stats={trade.give.statLine}
                        score={trade.give.scoreLabel}
                      />
                      <div
                        aria-hidden
                        className="grid place-items-center font-display text-2xl text-muted"
                      >
                        <span className="hidden sm:block">&harr;</span>
                        <span className="sm:hidden">&darr;</span>
                      </div>
                      <TradeSide
                        label="You get"
                        name={trade.receive.name}
                        meta={`${trade.receive.position} / ${trade.receive.team}`}
                        stats={trade.receive.statLine}
                        score={trade.receive.scoreLabel}
                        highlight
                      />
                    </div>

                    {/* What the manager asked for, and whether it landed. */}
                    {trade.goalDelta.length > 0 && (
                      <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-edge pt-5">
                        <span className="text-xs uppercase tracking-[0.12em] text-muted">
                          You asked for
                        </span>
                        {trade.goalDelta.map((g) => (
                          <span
                            key={g.key}
                            className={`nums rounded-md px-2 py-0.5 text-xs font-medium ${
                              g.delta >= 0 ? "bg-green/10 text-green" : "bg-red/10 text-red"
                            }`}
                          >
                            {g.label} {g.delta >= 0 ? "+" : ""}
                            {g.delta.toFixed(1)} z
                          </span>
                        ))}
                      </div>
                    )}

                    <div
                      className={`flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted ${
                        trade.goalDelta.length > 0
                          ? "mt-4"
                          : "mt-6 border-t border-edge pt-5"
                      }`}
                    >
                      {trade.userNeed && trade.partnerNeed && (
                        <>
                          <span>
                            You&apos;re thin at <span className="text-ink">{trade.userNeed}</span>
                          </span>
                          <span>
                            They&apos;re thin at{" "}
                            <span className="text-ink">{trade.partnerNeed}</span>
                          </span>
                        </>
                      )}
                      <span className={FAIRNESS_COPY[trade.fairness]?.className}>
                        {FAIRNESS_COPY[trade.fairness]?.label ?? trade.fairness}
                      </span>
                    </div>

                    <p className="mt-4 border-t border-edge pt-4 text-xs leading-relaxed text-muted">
                      {trade.rationale}
                    </p>
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
