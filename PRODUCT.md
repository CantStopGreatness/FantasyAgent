# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Fantasy basketball managers who run their league on Sleeper. They arrive with a
specific decision in hand — who to pick up off the wire, whether a trade is
worth making, who on their bench is about to matter — and they want an answer
that accounts for *their* league, not a generic top-200 ranking.

Near-term the surface is also shown to hackathon judges (Sports track), who
must understand what the product does and why it is different within seconds of
seeing it.

## Product Purpose

CourtIQ reads a Sleeper league and ranks every available player, sleeper, and
trade against that league's own rules, then explains each call in an analyst's
voice. Success is a manager trusting a recommendation enough to act on it —
and being able to see *why* it was made.

## Positioning

Most fantasy advice ignores how a league actually scores. CourtIQ reads the
league's real scoring format and settings — category vs points, per-stat point
values, playoff week, trade deadline, waiver type — and ranks against them. The
scoring format is read from the league, never chosen by the user, because a
league has exactly one.

The mechanism a competitor could not copy-paste: rankings are deterministic and
explainable, and every card carries its cross-format rank so the reasoning is
visible. Giannis Antetokounmpo is 69th under category scoring and 5th under
points, because his free-throw shooting carries a −5.6 z-score at high volume.

## Operating Context

Managers check in around waiver runs, before a trade deadline, and during a
playoff push — moments where league rules change what a good move is. They come
from Sleeper and think in Sleeper's vocabulary: rosters, the wire, FAAB,
matchups.

The app runs locally for the hackathon demo; port 3000 was occupied, so it
serves on 3001.

## Capabilities and Constraints

- Four views: Waiver Wire, Sleepers, My Team, Trades.
- Import by Sleeper username or league ID; setup confirms the rules that were
  read and lets the user correct any of them.
- Trades work three ways: no conditions (positional imbalance), a stated goal
  ("I want more rebounds"), or a named target player, plus protected players.
- Trade selection is deterministic. The model narrates; it never ranks.
- NBA is the only implemented sport, but the engine is sport-agnostic by design
  (`src/lib/sports/`) and NHL/MLB/NFL are intended later. Copy must not read as
  NBA-only.
- Data comes exclusively from the public Sleeper API. No key required.
- Sleeper does not document its league `settings` object and publishes no
  category-vs-points flag, so format is inferred and then confirmed by the user.
- Analyst commentary requires `ANTHROPIC_API_KEY`; without it every callout
  falls back to written copy labelled "offline read".
- A demo mode (`leagueId === "demo"`) serves pre-authored sample data.

## Brand Commitments

- Name and wordmark: **CourtIQ**, styled COURT + IQ.
- The user has pinned the aesthetic direction for the redesign: retro, drawing
  on Retro Bowl and arcade games.

## Evidence on Hand

- A real validated Sleeper league: 8 teams, points scoring, `1394097824156631040`.
- Real season statistics for ~1800 players, cached in `.cache/`.
- Two verification suites (`npm run verify`, `npm run verify:league`) covering
  23 checks against live data.
- No customers, benchmarks, pricing, or testimonials exist. None may be invented.

## Product Principles

1. The league decides, not the user. Scoring format and rules are read from
   Sleeper; the user confirms and corrects, never picks from preferences.
2. Show the reasoning, not just the ranking. Every recommendation carries the
   number that produced it.
3. Deterministic first, narrated second. The engine picks; the model explains.
4. Never invent a number. Missing data renders as absent, never as a default.
5. Sport-agnostic bones. Nothing above the sport profile assumes basketball.

## Accessibility & Inclusion

Dense ranked data is the core content; it must stay legible and scannable.
Keyboard focus states and semantic structure are already in place and must
survive any visual change.
