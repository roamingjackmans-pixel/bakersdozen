# Decisions

Why Baker's Dozen is the way it is. Newest last.

**D1 — Owner's answers (2026-11-21).** PvP is both free-for-all (own trays and seals) and 2v2 rival bakeries, on top
of the handoff's co-opetition, plus co-op. Browser with mouse and touch; online with AI filling empty seats. Lowercase
URL `/games/bakersdozen/`. Joe and the Sheriff ported from Dungeon Joe and Geode Gobbler. Everything planned is in
scope: campaign, cosmetics, daily challenge, emotes, ~14 tame and chaotic modifiers. Stephanie as in the handoff.

**D2 — Shoallhell's server, same pattern as Smash Your Bros.** Game id `bd`, its own save (`profiles/bd/`), a daily
board (`bd/daily/<date>.json`), dev origin :5176. The host's browser runs the rules; the server relays. No WebRTC: the
only real-time shared game is the oven, which runs on host timestamps, so relay latency doesn't make it jitter.

**D3 — One code path for solo and online.** Solo wires a `ClientMatch` straight to a `HostMatch` in the tab. Fewer
places for online-only bugs to hide; solo also gets refresh-resume for free.

**D4 — The stage is the mockups' 1440×810, scaled.** Every screen matches the mockups' layout exactly and scales to
any window. Phones play sideways; a hint asks portrait phones to turn.

**D5 — Pacing shorter than the handoff's estimate.** A Full Dozen runs ~25 minutes, not ~35: 50–58 s mini games,
8 s reveal, ~14 s tally, 20 s market that ends early when everyone is done. Long Night (two games an order) ~35 min.
A browser party game should keep moving; the handoff marked timings as estimates.

**D6 — The 13th loaf is a call, not a race.** After the count everyone sees the tray and has 6 s to ask for it; the
one who has baked the fewest gets it (then fewer ★). A twitch race over the network would reward ping, not choices,
and the tie-break pushes freeloaders to pay their share.

**D7 — Trays round the table's total, on a forgiving curve.** Each bake adds `q^0.5` of its share; the tray shows the
rounded sum. Rounding every baker separately made survival fall off a cliff as skill dropped (a whole table rounding
the same way), and a linear curve meant a casual table could never fill a tray. See BALANCE.md.

**D8 — AI levels differ more in ★ than in baking.** Easy rivals (q ≈ 0.59) are easier to beat but still decent
bakers; a weak AI table would sink your bakery and make Easy harder, not easier.

**D9 — Perks and skills only change difficulty.** Skill widens windows and lengthens looks (~12% a point); perks do
what the handoff says. The one tuning change: Joe's parry window is ±70 ms (tighter than the perfect zone), because a
wide parry made Joe win 55–79% of AI nights.

**D10 — Anti-exploit scoring.** Knead counts stray taps against you (mashing can't hit every beat); Decorate charges
off-line icing (scribbling can't cover the line); Proof and Scale weigh pace so one lucky bake isn't a whole shift.
Each is held by a bot test.

**D11 — Chaotic nights get an allowance.** Each chaotic modifier makes trays 4.5% easier to fill. With all seven on,
the bakery closed 98% of AI nights; with the allowance, about 30%. Mayhem should be wild, not hopeless.

**D12 — Free-for-all and 2v2 still share one oven.** Rivals load into the same slots, can rescue each other's trays,
and can bump them. It's the game's most social moment; splitting it would lose that.

**D13 — Closed bakeries sit out.** In free-for-all a closed bakery's baker stops baking but keeps emoting and can
still throw Sabotage Night freebies; the night ends when one bakery is left.

**D14 — Recipes in the campaign are a collection.** "Unlocks recipes" became a recipe book (one per night survived)
plus the Daybreak and Royal Warrant aprons, rather than gating which items appear (online lobbies mix profiles).

**D15 — Cosmetics never change silhouettes.** The handoff asks for distinct silhouettes, so cosmetics are aprons
(pattern on the bib), rolling pins (station and results) and a small hat badge.

**D16 — The hidden hearth** is a dark arch at the bottom-left of the window frame; three taps light it for everyone
(Rest at the Hearth for whoever lit it). The geode is a sparkle that appears for 2.6 s in some Sheriff orders.

## The pre-release review (2026-11-21)

Three independent reviews (netcode, performance, rules/UX) read the finished code assuming it was slow and glitchy.
What changed:

**D17 — The lobby stands down during a night.** The lobby's socket handlers answered every guest message with the
lobby state, which bounced guests out of every online night within seconds. Now a night owns the traffic; only an
explicit "back to the lobby" ends it for guests; a guest who says hello mid-night (a refresh, a late join) gets a
`go` addressed to them and drops straight back in.

**D18 — Reconnects take their seat again.** socket.io reconnects with a new socket the relay doesn't know, so `Net`
remembers its room and re-sends `host:reclaim` / `room:join` on every reconnect; guests then re-measure the clock,
ask for the state and re-send their last result.

**D19 — A host refresh keeps what was in flight.** The save holds the results already in for the current game and the
Shared Oven, is written on every phase change, every second and on `pagehide`, and AI rivals re-plan their market
and 13th-loaf choices on resume.

**D20 — The host trusts nothing.** Every guest message is type-checked; ids are checked with `Object.hasOwn` (a
baker called `__proto__` froze the lobby); amounts must be finite; oven slots integers; throws only salt or flour,
only at the market, only from an open bakery.

**D21 — Oven fairness.** A pull is judged up to 180 ms back (was 260); a tray burns 180 ms after the screen shows it,
so a tap in flight still counts; a rival's tray can only be taken once it's smoking (a rescue), never while golden
(that stole the owner's perfect and paid a "rescue"). An Extra Oven Slot belongs to the bakery that bought it.

**D22 — Chip-in ★ only for buffs that get bought.** Chipping into a pool that never filled paid ★ and refunded the
Tips (free ★). Now everyone who paid in gets the ★ when the pool fills; a refund leaves no ★ and no credit. Pip's 20%
applies to his chips (each Tip counts 1.25).

**D23 — Smaller fixes from the review.** Salt Shakers narrow the victim's oven windows (they did nothing on oven
orders); Law & Order counts on the bakery (the event log only keeps 40); Salt in the Wound unlocks from the host's
record, not on click; uneven 2v2 compares the average baker; closed bakeries get no free Sabotage Night throws
(replaces D13's freebies); a Spot Check tray shows 13 slots; labels replaced sentences during play; touch targets are
44 px; the screen-shake and reduced-motion settings apply; the first-run tutorial leads to baker select.

**D24 — Performance.** The bakery under a game canvas is hidden and its animations pause behind dim overlays; candle
flames are HTML layers; the market, 13th-loaf call and rival bars update only what changed (rebuilt buttons also lost
taps); the tray patches its slots; portraits are cached; canvas density is capped at 1.5× and steps down on a slow
device; SVG sprites are rasterised once; canvases free their memory when a game ends; the music skips a stalled
backlog instead of playing it at once.

**D25 — Every mini game shows where and when to act (owner, 2026-11-21).** Players couldn't tell where to tap or what
"the beat" was, and Knead was unreadable with the sound off (its rings faded out before they landed). Each game now
has a looping demo (order card and 3-2-1) and a glove cue on the spot during play; the beat is drawn (solid rings, a
target that flashes at the moment, the board pulsing each beat). Cues are labels and icons, so the handoff's
no-narration rule holds. Two buffs from the handoff changed because what they showed is now everyone's: Metronome
("visible beat guide") widens Knead's timing windows by 25%, and Calibrated Scale ("rough weight indicator") adds a
zone around the now-standard target mark and halves the needle's wobble. The game's rule lines were rewritten to say
the move ("Tap as each ring hits the dough", not "Tap on the beat").

**D26 — A player always gets a turn at the Shared Oven.** AI rivals pulled and reloaded in the same tick, so with
three AIs and three slots a player could wait the whole game with a tray in hand ("Tap a slot" with nowhere to tap).
An AI now leaves a just-freed slot to a waiting player with fewer trays in for up to 2.5 s, after which it's anyone's
(an idle player doesn't stall the bakery). AI-only nights, and so the balance numbers, are unchanged; the queue label
says "Oven full · wait" when there's no slot.

**D27 — One game between counts, in whole loaves (owner, 2026-11-21).** A chained order (Double Bake, Double Shift,
Long Night, the odd late order) played its two games back to back and counted both at the end, so players couldn't
see what their first game put on the tray. Now every game is followed by the 4.5 s count. After a chain's first game
that's all: the second game follows after 3 s, and the Apprentice, the 13th-loaf call and the verdict come once,
after the last game. The count starts from `Bakery.counted`, the whole loaves already counted, so it runs in whole
loaves. It used to start from the rounded tray minus the exact shares, which showed counts like "7.5 / 12" whenever
the tray rounded up. The ★ / tips floats show that game's own numbers (`PlayerState.lastGame`), so the second count
doesn't repeat the first. Scoring is unchanged. The AI's oven moves are seeded from the clock (`aiOven`), and a
chain's oven now starts 4.5 s later, so the balance report reshuffles within its noise: survival and fines move by
about a point at most. A Long Night gets about a minute longer (31 → 32 min of AI play).

**D28 — In Scale, green means good (owner, 2026-11-21).** The needle could rest in Calibrated Scale's green zone and
still be told "Too heavy". The zone was a fixed ±22 g, but a weigh is good (score ≥ 0.75, a green number and chip)
only within ±4.9% of the target, which is narrower than 22 g for every target under ~450 g. The zone is now drawn
from the same rule the verdict uses (`goodErr` / `judgeWeigh` in `src/mini/scale.ts`), so it scales with the target:
±8.8 g at 180 g, ±43 g at 880 g. The needle also lags a fast pour by up to ~16 g, so it could read green at the moment
of Weigh while the bowl was already heavy. On Weigh it now settles at once on the judged weight, so the dial and the
verdict always agree. Scores are unchanged.

**D29 — The 13th-loaf popup pops in once (owner, 2026-11-21).** The popup was rebuilt every time anyone claimed or
passed, and each rebuild replayed its pop-in, so a player saw it pop up once per AI decision. The box (and its timer)
is now built once per order and only its contents update.

**D30 — The host picks mini game length (owner, 2026-11-21).** A lobby choice of 35 / 50 / 70 s (×0.7 / ×1 / ×1.4
on every mini game's clock; `MatchCfg.pace`, `PACES`). The objectives scale with the clock (D31), so a short game asks
for fewer bakes rather than the same bakes in less time, and the balance holds. The Shared Oven and Dawn keep their
clocks: they have a set number of trays (4 / 6 each) and now close once those are out; a shorter oven would only
leave trays unbaked. Campaign and daily nights stay at 50 s. In the lobby, AI rivals and Mini games each sit on one
line with their label; the baker grid and detail panel gave up 40 px of width for it, so the rules panel didn't grow.

**D31 — A game ends once its objective is met (owner, 2026-11-21).** Proof, Decorate and Scale hand out targets
forever, and the score's pace term stops rising at a set number of them (one per 9 / 12 / 8 s). That number is now
the objective: a counter shows it by the clock, and once it's met the game stops, shows "Done" and sends its result.
The pace term divides by the rounded objective (6.25 weighs → 6), a touch kinder at the margin. Rush Order's
objective is getting a recipe of 6 right in a 50 s game (4–7, by the clock): longer recipes score more up to there
(the reach term now tops out at the objective; at 50–58 s that's unchanged). Knead's objective is the song, which
already lasts the game. The oven's is every tray out. The host moves on as soon as every person has sent a result,
so solo players skip the rest of the clock, and online the night moves on once the last person finishes. AI-only
nights still run the full clock, so the balance sims measure the same thing.

**D32 — Decorate: finish the design (owner, 2026-11-21).** A design used to count as done at 94% of its line
covered, or at 60% once the nozzle reached the end dot. On a closed shape the end dot is the start dot, so passing
back by it could end a design with 40% of it bare. Now it's done at 99% (`DONE_AT`): a stray dot or two, never a
stretch of line. The glove's idle hint already points at the first bare dot.

**D33 — A bumper batch pays (owner, 2026-11-21).** A tray that ends 3+ loaves over its order (the tray itself, not
the 13th loaf, which already pays) gives everyone who baked on it +1 ★, +2 at 4 over, +3 at 5 or more. It's ★, not
Tips, so it can't buy the bakery's survival, and everyone on a shared tray gets the same, so it rewards the table
without picking a winner. At first the oven paid it nearly every order; D34 fixed that.

**D34 — The oven bakes its share, not a loaf a tray (owner, 2026-11-21).** Each oven tray was worth
`max(1, round(share))` loaves. At a four-baker table a tray's share is 0.86, so 16 trays made 16 loaves on a 12-loaf
order (+4), and Dawn's 24 trays made ~25 (+12). Dawn's golden trays (×1.6) were added on top of the share, and an
oven that was one game of a chain wasn't halved like every other chained game (`loafCap`), so chain + oven landed +8.
All of it was regardless of how the table baked, so the bumper batch (D33) paid on almost every oven order.
Now each tray holds its exact share, like every other game's loaves, and the tray rounds the total. Golden trays are
×1.6 within the share, a chained oven makes half, and a burnt tray costs a loaf or the tray's worth, whichever is
less. The live counter in the oven adds the exact totals and rounds, so it never shows a fraction. At Normal AI every
order type now ends 0–2 over at any table size. Solo and two-baker tables, whose trays rounded the other way
(3.45 → 3), get their full share too. Survival and fines held within noise in the balance report.

**D35 — Three more mini games (owner, 2026-11-22).** The owner asked for something like a busy shared kitchen with
everyone in it, juggling eggs, and folding pretzels or croissants. **Egg Juggle**: a two-hand catch game (not a
keep-it-up tapper, which mashing would win): each egg lands in a hand at a known moment, the ring closing onto the
hand shows when, and a tap with nothing landing is a fumble that costs accuracy and blocks that hand for 0.28 s, so
mashing scores under 0.25. Three catches put an egg in the bowl; the objective is eggs in the bowl. **Fold**: grab
the end of the dough and let go on its ring. The end is on a spring, trailing your finger and swinging past where
you stop, so it's timing as well as aim (letting go mid-swing misses), and a release far from the ring springs
back and counts as a miss, so scribbling doesn't pay. A croissant's horns start wherever its roll was let go. Both
are solo games: same scoring, AI and objectives as the other five.

**D36 — All Hands: one kitchen for the whole table, tap a station to go there (owner, 2026-11-22).** Everyone's
baker shares one top-down kitchen, which is the chaos the owner asked for. Movement is tap-to-go, not a joystick:
it works on a phone, and a destination survives network delay (the host walks the cook; screens extrapolate along
the path), where steering a cook over the relay would lag. The host runs it like the Shared Oven, with guests
sending only the station they tapped. Each bakery has its own tickets and each loaf belongs to whoever took its
flour, so in free-for-all and 2v2 nobody can serve a rival's loaf, but everyone fights for the same mixers, boards
and ovens. Kneading is taps at the board, not walking up to it. It's never one of the four teaching orders. Swap
Shop never swaps into or out of it.

**D37 — All Hands balance (2026-11-22).** First AI runs deadlocked: four cooks took flour at once, both mixers
filled, and nobody had free hands to take the dough out. AI cooks now take flour only when a mixer is free for it,
and flour can go back in the bin. A cook that walked past a corner of the island in one step never crossed it off
and paced back and forth; walking now drops every waypoint passed. Then the tickets: a whole number per baker made
the results a cliff (12 tickets at 58 s was a 59% fine rate on kitchen orders), so the count now follows the clock
after the first loaf's start-up, and the loaves follow the solo games' curve (share served ^ 0.5) instead of a
fixed value per ticket. A shared kitchen's result also varies far less than four separate games, so at the oven's
yield the 13th loaf covered every near miss and Normal nights stopped losing seals. Two changes: each AI cook gets a
form for the game (`kitchenAiForm`; AI rivals' solo games already spread by `aiSpread`), and the yield is 0.84
(`kitchenYield`), which leaves kitchen orders about half a loaf short on average. Easy AI cooks were slowed less than
the others so an Easy table isn't sunk by one kitchen order. The balance report is back where it was (co-opetition
Normal 97% / 0.86 fines, Easy 81%; the last commit had 97% / 0.81 and 77%). AI cooks score ~0.9
here (they rarely fumble the steps), higher than their ~0.65 in solo games, but they still leave a person their
share of the loaves.
