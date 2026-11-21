# CLAUDE.md — Baker's Dozen

A co-opetition party game for 1–4 bakers (README.md). Browser game (Vite + TypeScript, no framework): DOM + SVG
screens on a fixed 1440×810 stage scaled to the window, canvas mini games. Online up to 4 through **Shoallhell's
server** (`C:\dev\Shoallhell\server`, shared accounts, game id `bd`). Hosted at
`https://josephjackman.com/games/bakersdozen/`.

## Read first
1. `Baker's Dozen — Design Handoff.md` — the owner's spec; mockups at https://claude.ai/artifact/4PTcW2ZNZvTBQyRF7y4DM6
2. `docs/DESIGN.md` — the game as built (rules, numbers, netcode)
3. `docs/DECISIONS.md` — why things are the way they are

## How we work
- Windows 11 + PowerShell 5.1 for anything given to the owner (chain with `;`).
- Commit/push only when asked.

## Rules that are easy to break
- `MatchState` stays plain JSON (no Maps/Sets/classes): the host sends it whole and keeps it in sessionStorage.
- No `Math.random()` in `src/game/rules.ts`, `flow.ts`, `oven.ts`, `ai.ts`: use the match's seeded `Rng`.
- Only the host runs rules. Guests send intents (`GuestMsg` in `src/game/match.ts`) and draw snapshots.
- Balance numbers live in `BAL` (`src/game/data.ts`); after changing them run `npm run balance` and keep
  `tests/balance.test.ts` green (survival and per-baker targets are documented in docs/BALANCE.md).
- Every mini game must pass `tests/mini.test.ts` (a perfect bot scores high; idle, mashing, scribbling don't pay).
- Canvas: no `filter` / `shadowBlur`; backgrounds are pre-rendered; no per-frame gradients.
- UI rule from the handoff: no narration during play (labels, numbers, icons only); touch targets ≥ 44 px.

## Commands
```powershell
npm run dev                      # Shoallhell server :3031 (from ..\Shoallhell) + Vite :5176
npm run typecheck; npm test
npm run build
npm run balance                  # prints the balance report
```
Dev: `?fast=0.3` (faster clocks), `?mini=proof` (one mini game alone), `?slot=2` (second sign-in).
