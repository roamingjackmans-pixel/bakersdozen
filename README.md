# Baker's Dozen

A co-opetition party game for 1–4 bakers. Rival bakers share one bakery overnight: every order needs the team to
fill a shared tray of 12, and everyone loses if the bakery fails the King's Inspector at dawn. If it survives, the
baker with the most Reputation (★) wins. The 13th "insurance loaf" protects everyone and costs whoever bakes it.

Set in the Dungeon Joe universe: Joe (with his parry) and Stephanie are playable, the Sheriff from Geode Gobbler
comes in for his pretzels, and there is a hearth somewhere in the back of the bakery.

**Play:** https://josephjackman.com/games/bakersdozen/ — mouse, keyboard or touch (phones: turn sideways).

## How it plays

- **A night** is 7 or 13 orders. Each order: the order card flips (customer, item, Rush, the Inspector's twist),
  everyone plays the same mini game at once (rivals' progress in the corner), the tally fills the shared tray, one
  baker may bake the 13th loaf, and the peddler's cart sells buffs for Tips. The window is the clock: midnight to
  sunrise, the Inspector's lantern walking up the road.
- **Six mini games:** Knead (tap on the beat), Proof (hold to rise, let go before it collapses), Shared Oven (load,
  pull golden trays, rescue a rival's or let it burn), Decorate (trace the line), Scale (pour to the gram), Rush Order
  (remember the recipe). The last order, Dawn, runs every station at once in the Shared Oven.
- **The 13th loaf:** after the count, anyone with Saffron can bake it (+5 ★); it covers an order one short. Never bake
  one and you lose half your ★ at dawn. Three short orders crack three seals and the bakery closes.
- **Six bakers**, each with one perk and one weakness: Stephanie (sees the next order), Joe (parry: a perfectly timed
  pull scores double), Pip (20% off at the market), Florentine (clean lines score extra), Wick (cheap sabotage, but
  he can get caught), Nonna Bea (recipes stay up longer).
- **Styles:** Co-opetition (shared tray, most ★ wins) · Co-op (one team score, medals) · Free-for-all (your own
  tray and seals; last bakeries standing) · 2v2 Rival Bakeries. **Lengths:** Quick Shift (7, ~12 min), Full Dozen
  (13, ~25 min), Long Night (13 with two games each, ~35 min).
- **Fourteen modifiers**, tame (Midnight Rush, Strict Inspector, Saffron Shortage, Generous Patrons, Rare Cart,
  Double Shift, Picky Customers) and chaotic (Flour Storm, Mirror Kitchen, Haunted Bakery, Sabotage Night, Swap Shop,
  Lights Out, Tiny Kitchen).
- **Solo** against AI rivals (Easy / Normal / Hard), a **13-night campaign** where the Inspector gets stricter every
  night, and a **daily challenge** (the same seeded Quick Shift for everyone, with your friends' scores).
- **Online** with up to 3 friends: open a lobby, invite from your friends list or share the 4-digit code; empty seats
  are AI rivals. If someone drops, an AI stands in until they're back; refreshing puts you straight back in.
- **Progress:** 12 achievements (some secret), cosmetics (aprons, rolling pins, hat badges), lifetime stats.

## Accounts

Same accounts and friends as **Shoallhell** and **Smash Your Bros**: Baker's Dozen talks to Shoallhell's server for
sign-in, its own save file, friends, lobbies, invites and the online relay. "Play offline" keeps progress in the
browser.

## Run it locally

Needs Node 22+ and the Shoallhell repo next to this one (for the server). PowerShell:

```powershell
cd C:\dev\BakersDozen; npm install
npm run dev        # Shoallhell's server on :3031 + the game on http://localhost:5176/games/bakersdozen/
npm run typecheck; npm test
npm run build
```

`npm test` plays hundreds of AI nights in every style and modifier, runs bots through every mini game (perfect,
idle, mashing, scribbling), holds the balance targets, and (with ..\Shoallhell present) runs a full online night
through the real server. `npm run balance` prints the balance report (docs/BALANCE.md).

Dev shortcuts: `?fast=0.3` runs every clock at 30% speed; `?mini=decorate&baker=florentine&mods=mirror` plays one
mini game on its own (`knead`, `proof`, `decorate`, `scale`, `rush`); `?slot=2` keeps a second sign-in for testing
two accounts in two tabs.

## How it's built

- `src/game/` — the rules (plain-JSON state, seeded RNG), the night's phase machine, the Shared Oven, AI rivals, the
  host/client match controllers, profiles and achievements.
- `src/mini/` — the six mini games on a canvas, and the runner that layers modifiers and sabotage over them.
- `src/ui/` — every screen (DOM + SVG, from the mockups), `src/render/` — the storybook art, `src/audio/` — synthesized
  sound and music, `src/net/` — accounts and the socket to Shoallhell's server.
- Design and history: `docs/DESIGN.md`, `docs/DECISIONS.md`, `docs/BALANCE.md`.

## Deploying

Push to `main` → `.github/workflows/ready.yml` type-checks, tests and builds into `site/` on the `ready` branch → the
`games` repo publishes it at `/games/bakersdozen/` (add `{ "folder": "bakersdozen", "repo": "bakersdozen",
"publish": "site" }` to its `deploy/library.json`). The server side ships with Shoallhell (`fly deploy` in
C:\dev\Shoallhell).
