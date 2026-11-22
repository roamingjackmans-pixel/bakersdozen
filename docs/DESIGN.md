# Baker's Dozen — the game as built

The owner's spec is `Baker's Dozen — Design Handoff.md`; this is what the code does. Numbers live in `BAL`
(`src/game/data.ts`) and are explained in `docs/BALANCE.md`. Where this file and the code disagree, the code wins and
this file needs fixing.

## A night

`src/game/flow.ts` (class `Night`) runs the clock on the host:

| Phase | Length | What happens |
| --- | --- | --- |
| reveal | 8 s (10 s first order; 3 s between chained games) | the order card flips: customer, item, games, Rush, twist |
| play | 3 s countdown + 50 s (orders 1–4), 58 s (5–12), 38 s each for a two-game chain, 50 s each on Long Night, 80 s Dawn; Rush ×0.75, Midnight Rush ×0.75 | everyone plays the same game at once; results go to the host; AI results are decided at the start and acted out in the corner |
| tally | 4.5 s count · up to 6 s for the 13th loaf · 3.5 s verdict | loaves fill the tray; the Apprentice adds one; Saffron Shipments land; Best in Show; then the 13th-loaf call, then fill or fine |
| market | 20 s (ends early when every person is done) | the peddler's cart; skipped after a Market Closed twist and after the last order |
| dawncheck | 7 s | the Inspector's verdict |
| over | — | results, profile, achievements |

A night ends early when the shared bakery closes (three cracked seals), or in free-for-all / 2v2 when one bakery is
left standing.

**Orders** (`makeOrders`): orders 1–4 teach four different games (always including the Shared Oven); from order 5 a
twist is drawn with probability 55% (campaign: 25% + 5.5% a night; daily: 65%), and some orders chain two games. The
last order is Dawn. The Sheriff comes by every few orders.

**Twists:** Rush, Double Bake, Short Weight (plain bakes put nothing on the tray), Spot Check (tray needs 13), Market
Closed, Saffron Shipment, Inspector's Watch (sabotage caught half the time, −2 ★), Generous Tips, Best in Show (+3 ★),
Blackout (candlelight only), Royal Taster (★ ×1.5), No Insurance (no 13th loaf).

## Scoring one game

A game reports a quality `q` in 0..1 (`src/mini/*.ts`). The host turns it into (`scoreResult` in `rules.ts`):

- **Tray loaves:** `q^0.5 × (need ÷ bakers on that tray) × 1.25` (halved for each game of a chain; ×(1 + 4.5% per
  chaotic modifier)). Shares add up exactly and the tray shows the rounded total. Under the flop line (q < 0.18;
  Picky +0.14; Short Weight 0.5) a bake adds nothing.
- **★:** `q × 6 × game weight` (Decorate 1.3, Oven 1.1, Dawn 1.6, others 1) × Rush 1.3 × Royal Taster 1.5 × Midnight
  1.25 × Picky 1.5 × chain 0.62; Florentine ×1.1 in Decorate at q ≥ 0.82; Secret Family Recipe ×2 once.
- **Tips:** `1 + 4q` (×0.6 in a chain, ×2 Generous Patrons / Generous Tips); Florentine −1 on plain bakes; +1 per
  oven rescue.
- **Saffron:** a Perfect (q ≥ 0.9) drops one 55% of the time (25% with Saffron Shortage). Everyone starts with 1.
- **Grades:** Perfect ≥ 0.9, Great ≥ 0.75, Good ≥ 0.5, Plain ≥ flop line, Flop.

Skill (1–5, baseline 3) makes a game ~12% easier per point (wider windows, longer looks), never a flat bonus.

## The 13th loaf, fines, the end

- After the count, anyone with Saffron may ask to bake the 13th loaf (6 s). One per bakery per order: whoever has
  baked the fewest gets it, then the one with fewer ★. It costs 1 Saffron and pays +5 ★; it covers an order one short.
- A short order uses a Bribe if the bakery has one, else cracks a seal. Seals: 3 (2 with Strict Inspector, and on
  campaign nights 11–13).
- At dawn: never baked a 13th loaf → half your ★ (not in co-op). Your bakery bought a team buff and you never chipped
  in → −3 ★ (not in free-for-all).
- Winner: co-opetition, most ★ if the bakery survived (if not, everyone loses); co-op, a medal by ★ per baker per
  order (bronze for surviving, silver 3.6, gold 4.6); free-for-all, survivors by ★, then closed bakeries by how long
  they lasted; 2v2, the surviving team, then the higher team total.

## The market

Three cart items (four with Rare Cart) from the personal and team buffs, plus rare ones from 35% of the night on,
plus Saffron (7 Tips) every time. A bakery with one seal left always sees a Bribe. Personal buffs last the night;
team buffs are pooled per bakery (anyone chips in; the first chip earns +1 ★; unfinished pools are refunded); rare
buffs have one copy. Catch-up: last place in ★ pays 25% less; Pip pays 20% less; Wick pays half for sabotage.

| Buff | Price | Effect in the code |
| --- | --- | --- |
| Sharp Memory | 6 | Rush Order recipe +2 s |
| Steady Hands | 6 | Decorate margin ×1.35 |
| Metronome | 5 | Knead timing windows ×1.25 and a louder beat |
| Baker's Nose | 5 | Proof shimmer from 13% below the peak |
| Calibrated Scale | 5 | a green zone around the target and a needle half as wobbly |
| Extra Oven Slot | 12 (pooled) | +1 oven slot for the night |
| Apprentice | 14 (pooled) | +1 tray loaf at each of the next 3 tallies |
| Bribe the Inspector | 18 (pooled) | cancels the next fine |
| Secret Family Recipe | 11 | doubles ★ from your next game of a type you pick |
| Salt Shaker | 9 | the rival's next game is "salted" (each game has its own scramble) |
| Flour Cloud | 7 | a 3 s flour burst over the rival's next game |

Team buffs cost 55% in free-for-all (they're yours alone) and 75% in 2v2. Sabotage can't target teammates or a closed
bakery. Wick has a 12% chance to be caught (−2 ★); Inspector's Watch makes it 50% for anyone; Sabotage Night gives
everyone a free shaker and cloud each order and nobody is caught.

## The mini games (`src/mini/`)

| Game | Input | q | Skill makes it easier by | Salted |
| --- | --- | --- | --- | --- |
| Knead | tap / Space as each ring meets the dough | (perfect + 0.6 good) ÷ (beats + 0.6 × stray taps) | wider windows (±50 / ±115 ms at skill 3) | some beats land off the grid |
| Proof | hold to rise, release | mean of rise ÷ peak (collapse = 0) × pace | longer tremble before the peak | the rise stutters |
| Shared Oven | tap slot to load, tap tray to pull | grades of your trays (perfect 1, golden 0.82, dark 0.45) | wider golden window, longer smoke | — |
| Decorate | drag the piping bag | coverage × (1 − 1.4 off-line ink) × precision × pace | wider margin | the guide drifts |
| Scale | hold to pour, Weigh | closeness to the target (±22%) × pace | steadier needle | a digit of the target smudges |
| Rush Order | tap / 1-8 in order | items right ÷ items shown (longer recipes count more) | longer look | the shelves shuffle after the look |

The Shared Oven is the one real-time shared game: the host runs it (`src/game/oven.ts`); every screen draws the same
trays from start times on the host clock. Pulls are judged at the moment the player tapped (converted to host time,
up to 260 ms back). Perfect zone ±240 ms; Joe's parry ±70 ms. Burnt trays take a loaf off the owner's tray. Dawn adds
a prep board (knead 3 taps before a tray can go in), 6 trays each, 2 extra slots and golden trays worth ×1.6.
AI rivals pull and reload in the same tick, so an AI leaves a slot it has just freed to a player who is waiting with
fewer trays in, for up to 2.5 s (`aiOven`, `HUMAN_GRACE_MS`; `tests/oven.test.ts`). With no players waiting, AI play is
unchanged.

**Where to tap, without sound or words** (`cue()` in `src/mini/common.ts`, `src/mini/demos.ts`). A white glove
shows the move on the very spot, with a one-word label: TAP, HOLD, DRAG, LET GO, LOAD.
- *Before playing:* each game has a looping demo of the move (the glove acting at the right moment over the game's own
  scenery). It plays beside the order card ("How to play") and over the dimmed game during the 3-2-1, under a bar
  with the game's name, its rule and the count.
- *While playing:* the glove comes back where it helps. Knead taps along with the first four beats (and after four
  misses in a row); Proof shows HOLD on the dough, then "let go to bake" on the first two; Decorate drags from the
  green dot until you start (or after 3 s idle, from where you stopped); Scale holds the sack, then taps Weigh once
  there's flour in; the Oven taps a free slot (LOAD) until you've loaded two; at Dawn it taps the prep board.
  Labels name the part you're in: Rush Order's REMEMBER / TAP THEM IN ORDER (the next spot glows), the Oven's PULL
  over your golden tray and SAVE over a rival's smoking one.
- *The beat, seen:* Knead's rings stay solid all the way in (the next one bold), the gold target ring flashes at the
  moment to tap, and the board's edge pulses on every drum beat. Decorate's line has arrows showing its way round;
  Scale's dial has a red target mark; Proof's ruler is shaded from 50% up, where doughs start to give.
- In-game gloves are off during the 3-2-1 (`cueGate`), so only the demo shows then.

Modifiers layer over every game in `src/mini/runner.ts`: Flour Storm (drifting clouds), Mirror Kitchen (input
mirrored, a cursor shows where your hand is), Haunted (a ghost drifts by; oven timers wobble), Swap Shop (halfway the
game becomes another; q is the average), Lights Out / Blackout (a candle-lit circle around the pointer), Tiny Kitchen
(targets 30% smaller). The Sheriff's orders sometimes hide a geode sparkle (Something Shiny).

## Online (`src/game/match.ts`, `src/ui/lobby.ts`, `src/ui/night.ts`)

- The lobby host's browser runs the `Night`; the server only relays (`host:msg` to the room, `guest:msg` to the host).
- The host sends the whole `MatchState` when it changes (≥ 80 ms apart), the oven when it changes (≥ 60 ms, and
  every 500 ms), and everyone's live progress 4× a second. Each guest measures its clock offset with pings (best of
  the fastest round trips) and starts each game from the host's phase start.
- The host ticks from a Worker timer, so a host in a background tab keeps the night moving.
- A guest who drops is played by an AI stand-in until they rejoin; one who leaves for good becomes an AI rival.
- Refreshing: the host keeps the state in sessionStorage and reclaims the room (the server holds it 3 minutes); a
  guest rejoins with the same code. Solo nights resume the same way.
- Results arriving after the deadline (+3 s) are dropped and an AI fills in at 85%.

## Progress (`src/game/profile.ts`)

Saved to the account (`/bd/me`, `/bd/profile` on Shoallhell's server) or the browser offline: tutorial flag,
achievements with counters, wins per baker, lifetime numbers, cosmetics, campaign, daily bests, settings, the last 10
nights. The daily board posts your best score for the day to `/bd/daily` and shows you and your friends.

Campaign: 13 nights of Quick Shifts (night 13 a Full Dozen), co-opetition against three AI rivals; AI level 1 for
nights 1–4, 2 for 5–9, 3 after; twists more likely every night; no starting Saffron from night 8; two seals from
night 11. Surviving a night adds its recipe to the book.

Daily: a Quick Shift seeded by the date, two modifiers from the seed, the same AI rivals for everyone; score = ★ at
dawn + 25 if the bakery survived.
