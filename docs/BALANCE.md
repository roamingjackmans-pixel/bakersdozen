# Balance

`npm run balance` plays 400 AI nights per row (four AI bakers, every baker rotated through every seat) and prints
these tables; `tests/balance.test.ts` holds the targets on every `npm test`. Numbers live in `BAL`
(`src/game/data.ts`).

## Targets and where they landed (2026-11-21)

| Row | Survival | Fines / night | Minutes |
| --- | --- | --- | --- |
| Co-opetition, Full Dozen, AI Easy | 79% | 1.6 | 20 |
| Co-opetition, Full Dozen, AI Normal | ~94% | ~1.0 | 22 |
| Co-opetition, Full Dozen, AI Hard | 100% | 0.1 | 22 |
| Co-op, Normal | 100% | 0.6 | 22 |
| Free-for-all, Normal (each bakery) | 85% | 1.5 per bakery | 22 |
| 2v2, Normal (each bakery) | 95% | 1.1 per bakery | 21 |
| Strict Inspector, Normal | 86% | 0.7 | 20 |
| Every chaotic modifier at once | 71% | 1.8 | 19 |
| Quick Shift / Long Night, Normal | 100% / 100% | 0.5 / 0.4 | 11 / 31 |

Minutes are AI nights (the market runs its full 20 s); with people pressing Done early a Full Dozen is ~20–25 min.

The design goals: a Normal table usually survives but loses about one seal a night (the 13th loaf and the Bribe
matter); a casual table (Easy) survives most nights; nobody should be able to coast at Hard either, which is why
Strict Inspector and the campaign's late nights exist.

## Bakers

Win rate per seat (25% is even) and average ★ in four-baker co-opetition, Full Dozen, AI Normal:

| Baker | Win rate | Avg ★ |
| --- | --- | --- |
| Stephanie | 22–26% | 78–80 |
| Joe | 27–31% | 78–80 |
| Pip | 15–21% | 76–78 |
| Florentine | 24–34% | 78–80 |
| Wick | 13–25% | 74–77 |
| Nonna Bea | 24–29% | 78–81 |

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
