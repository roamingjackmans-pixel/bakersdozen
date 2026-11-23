# Balance

`npm run balance` plays 400 AI nights per row (four AI bakers, every baker rotated through every seat) and prints
these tables; `tests/balance.test.ts` holds the targets on every `npm test`. Numbers live in `BAL`
(`src/game/data.ts`).

## Targets and where they landed (2026-11-22, nine mini games)

| Row | Survival | Fines / night | Minutes |
| --- | --- | --- | --- |
| Co-opetition, Full Dozen, AI Easy | 81% | 1.6 | 19 |
| Co-opetition, Full Dozen, AI Normal | 97% | 0.86 | 20 |
| Co-opetition, Full Dozen, AI Hard | 100% | 0.1 | 21 |
| Co-op, Normal | 100% | 0.6 | 21 |
| Free-for-all, Normal (each bakery) | 79% | 1.6 per bakery | 20 |
| 2v2, Normal (each bakery) | 95% | 1.1 per bakery | 20 |
| Strict Inspector, Normal | 89% | 0.7 | 20 |
| Every chaotic modifier at once | 76% | 1.8 | 19 |
| Quick Shift / Long Night, Normal | 100% / 98% | 0.4 / 0.6 | 10 / 31 |

With the three new games (D35–D37) the Normal row matches the last six-game commit (97%, 0.81) within noise;
free-for-all bakeries lose a few points (85% → 79%) because a cook alone in All Hands can't share the steps out as a
table of four can.

Minutes are AI nights (the market runs its full 20 s, every mini game its full clock); the Shared Oven and Dawn
close once their trays are out, about a minute off a night. With people, a game also ends once everyone has met its
objective, and the market once everyone presses Done, so a Full Dozen is ~15–25 min. The mini game length (lobby:
35 / 50 / 70 s) scales the five solo games' clocks and their objectives together, so it changes how long a night
runs, not the balance.

**Bumper batch** (`bumperAt` 3, `bumperMax` 3): a tray 3+ loaves over the order pays everyone on it +1..+3 ★. It's
★ only, so survival and fines don't move, and everyone on a shared tray gets the same bonus, so it doesn't change who
wins in co-opetition. It's earned: a perfect solo game makes 15 of 12 (+3), so a table needs to bake near-perfectly.
At Normal AI, orders end on average about level (solo games) or 1–2 over (the Shared Oven and Dawn, at any table
size), and 0–3% of orders pay it; Hard and solo tables earn it more often. The every-chaos row earns it most
(average ★ +10 a night): chaos nights add loaves to make up for harder games, which AI rivals don't feel.

**Oven loaves** (D34): each oven tray used to round up to a whole loaf, so four bakers' 16 trays made 16 on a 12-loaf
order, Dawn's 24 made ~25, and an oven in a chain wasn't halved like other chained games (+8 over), whatever the
table did. Trays now hold their exact share. Survival and fines held (the 13th loaf covers Dawn's new near-misses);
average ★ came back to where they were before the bumper batch.

The design goals: a Normal table usually survives but loses about one seal a night (the 13th loaf and the Bribe
matter); a casual table (Easy) survives most nights; nobody should be able to coast at Hard either, which is why
Strict Inspector and the campaign's late nights exist.

## Bakers

Win rate per seat (25% is even) and average ★ in four-baker co-opetition, Full Dozen, AI Normal:

| Baker | Win rate | Avg ★ |
| --- | --- | --- |
| Stephanie | 24% | 75 |
| Joe | 31% | 76 |
| Pip | 21% | 74 |
| Florentine | 25% | 76 |
| Wick | 18% | 73 |
| Nonna Bea | 24% | 74 |

(One 400-night run; earlier runs with six games read 22–34% and 74–81 ★. Average ★ are a few lower now: an order
of Egg Juggle or Fold pays like any solo game, and fewer nights reach Dawn's big ★.)

Average ★ sit within ~4% of each other; win rates spread wider because a night has one winner (a 2% edge in ★ wins
far more than 2% more nights). Two bakers read low in AI-only nights for a reason that people won't share:

- **Pip** (all 3s, 20% off) gets his value from buffs; the AI models a buff as +0.07 quality for one game, which is
  about what the bots measured for Metronome / Steady Hands / Sharp Memory, but a person picks buffs for what's next.
- **Wick** (Scale 2, caught 12% of the time for −2 ★) gets his value from cheap sabotage, which the AI throws at the
  leader but can't time. A person who throws a Salt Shaker at the leader before a Decorate order gains a lot more.

## What changed and why

- **Tray yield** went from linear per baker (`round(q × share)`) to `q^0.5 × share`, summed exactly and rounded on
  the tray. Linear per-baker rounding made survival a cliff: Easy tables 0%, Normal 100%.
- **AI levels** were 0.50 / 0.64 / 0.77 quality; now 0.59 / 0.645 / 0.76 with a wider game-to-game spread (0.2).
  Easy rivals that can't bake made Easy the hardest setting (your bakery closed).
- **Joe's parry** first doubled ★ for any perfect pull: Joe won 55–79% of AI nights. Now the parry zone is ±60 ms
  (inside the ±240 ms perfect zone), Dawn uses the average of all six skills (it had used Joe's oven 5), and the oven's
  ★ weight is 1.0.
- **Florentine's** clean-line bonus is ×1.1 at q ≥ 0.82 (was ×1.25 at 0.7); Decorate's ★ weight 1.3 (was 1.45) — still
  the biggest ★ source per game.
- **AI personalities** (greed: keeps Saffron for bonus ★, leaves the bakery's 13th loaf to you; mischief: sabotage)
  were backwards for two bakers; Wick is now the greedy one, Nonna Bea the generous one.
- **Chaotic modifiers** each make trays 4.5% easier to fill; all seven at once closed the bakery 98% of nights.
- **Rare buffs** appear from 35% of the night (was 45%), so sabotage has a few more orders to matter.

## Mini games

`tests/mini.test.ts` plays each game with bots. A perfect bot scores 0.85–1; an idle one 0; mashing Knead every
frame < 0.2 and twice a beat < 0.55; scribbling over the Decorate cake < 0.25; guessing Rush Order < 0.3; a short
Scale pour < 0.15. A "decent person" Knead bot (88% of beats, ±65 ms) lands 0.45–0.85, around the AI's Normal.
Egg Juggle: perfect ~1, mashing both hands every frame < 0.25 (~0.19), a few times a second < 0.45, a decent juggler
(88% of eggs, ±70 ms) 0.4–0.85. Fold: perfect ~1, 40 px off the middle 0.6–0.9, letting go mid-swing < 0.3, scribbling
< 0.2. Perfect bots meet the objective a little past halfway (Juggle 28 s of 50, Fold 22 s).

## All Hands (`tests/kitchen.test.ts`)

AI-only kitchens, 50 s, four bakers: Easy serves ~75% of tickets, Normal ~88%, Hard ~97%; free-for-all, where every
cook works alone, ~70 / 81 / 90%. All served is `need × 1.25 × 0.84` (`kitchenYield`); fewer is that × (share
served)^0.5. A shared kitchen's result varies less than four separate games, so with AI cooks that played every
kitchen alike, kitchen orders were never fined (the 13th loaf covered every near miss) and Normal nights all
survived. Now each AI cook has a form for the game (`kitchenAiForm` 0.35: its reactions, kneads and pulls scale by
1 ± that), as AI rivals' solo games spread by `aiSpread`, and kitchen orders end about half a loaf short on average. A scripted good player scores > 0.75
among AI cooks; standing still scores 0; tapping random stations < 0.3.
