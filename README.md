# CourtIQ

League-aware NBA fantasy recommendations. CourtIQ reads your Sleeper league's
actual scoring format and re-ranks every waiver pickup, sleeper, and trade for
it — then explains the call in an analyst's voice.

The headline behaviour: **the same player ranks differently in 9-CAT and
Points, for the right reason.** Giannis Antetokounmpo is the 69th most valuable
player in 9-category scoring and the 5th most valuable in points, because his
free-throw shooting carries a −5.6 z-score at high volume. Flip the toggle and
the boards visibly reorder.

## Running it

```bash
npm install
npm run dev
```

Open the printed URL, enter a Sleeper username (or an NBA league ID), and go.

No API key is required to run the app. Add one to unlock live analyst
commentary:

```bash
cp .env.example .env.local   # then set ANTHROPIC_API_KEY
```

Without a key every callout falls back to a written line and is labelled
"offline read" in the UI, so the app never breaks on a missing or rate-limited
credential.

## Verifying

```bash
npm run verify         # scoring engine: TO inversion, format divergence
npm run verify:league  # full pipeline against a synthetic league
```

Both run against live Sleeper data (cached to `.cache/`). `verify` is the guard
on the demo-critical behaviour — it fails the build if the two formats stop
disagreeing.

## Data

Everything comes from the public Sleeper API. No key, no second provider.

| What | Endpoint |
| --- | --- |
| League, rosters, managers | `/v1/league/{id}`, `/rosters`, `/users` |
| Player dictionary | `/v1/players/nba` (2.4 MB — trimmed and cached for a day) |
| Season stat totals | `/v1/stats/nba/regular/{season}` |
| Late-season splits | `/v1/stats/nba/regular/{season}/{week}` |
| Add velocity | `/v1/players/nba/trending/add` |

Two things worth knowing about this data:

**Offseason.** Sleeper's current NBA season has no games played yet, so the
engine scores against the previous completed season and the UI says which
season the numbers come from.

**Weekly splits are not per-game.** A weekly file is a partial-week aggregate
covering an unknown number of games, with no `gp` field — summing all 25 weeks
recovers only ~30% of a player's season totals. Treating one file as one game
inflates every rate (a 16.8 MPG bench player reads as 37 MPG). So recent form
is expressed as a player's late-season output *per file* against their own
season-long output *per file*: the same unknown unit on both sides, reported as
a relative change rather than a fabricated per-game number.

## How the scoring works

**Points** — each per-game stat weighted by the league's own point values, read
straight from Sleeper's `scoring_settings`.

**9-CAT** — a z-score per category against a fantasy-relevant player pool
(≥15 GP, ≥14 MPG), summed. Two details matter:

- **Turnovers are inverted** so fewer turnovers scores positively.
- **FG% and FT% are volume-weighted**, scored as the swing a player applies to
  the pool baseline rather than as a raw percentage — otherwise a bench big
  shooting 70% on three attempts outranks a starter shooting 52% on twenty.

The normalization pool matters more than it looks: z-scores against all ~1800
players who logged a minute would drag the means toward deep-bench production
and inflate everyone. Filtering to real contributors keeps a replacement-level
pickup near zero.

## Trades

Selection is deterministic, so the same league always yields the same trade and
the reasoning is explainable on stage:

1. Score each roster's guard / forward / center groups on their top three.
2. Find each side's weakest group.
3. Require the needs to be complementary — I'm thin where they're deep, and
   vice versa — otherwise report no trade rather than invent one.
4. From each side's surplus, skip the best player at that position (nobody
   trades him) and pick the closest-value pair.

The model writes the pitch. It never picks the trade.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind v4 · Anthropic API (`claude-opus-5`)
