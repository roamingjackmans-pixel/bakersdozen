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
