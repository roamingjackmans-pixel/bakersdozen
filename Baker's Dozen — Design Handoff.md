# Baker's Dozen — Design Handoff

Nov 21, 2026 · @Stoe

## Overview

Baker's Dozen is a co-opetition party game for 1–4 players: rival bakers share one bakery overnight, and everyone loses if the bakery fails the King's Inspector at dawn. If it survives, the baker with the most Reputation (★) wins.

- **Hook:** the medieval "baker's dozen" — a 13th loaf added to each dozen so bakers weren't fined for selling short.
- **Core tension:** every order needs the team to fill a shared tray, but each player also wants personal ★. The 13th "insurance loaf" protects everyone and costs whoever bakes it.
- **Players:** solo (vs. AI rivals) or 2–4 players. Empty seats can be filled with AI rivals.
- **Format:** a digital party game built from short mini games. A full game runs about 35 minutes.
- **Universe:** set in the Dungeon Joe universe, with Joe and Stephanie as playable bakers and crossover easter eggs from the other games.

## Core rules

The team wins or loses together on the tray; individuals win on ★.

- **Orders:** a night is 13 orders. Each order card names a customer, an item and a quantity of 12 (for example, the Sheriff: 12 Croissants, Rush).
- **Shared tray:** every player's successful bakes go onto one tray. An order is filled when the tray reaches 12.
- **The 13th loaf:** an optional 13th slot on every order. Baking it costs a rare ingredient (for example, 1 Saffron) and earns a big ★ bonus (for example, +5 ★). It also covers the order if the tray ends one short.
- **Fines:** a short order cracks one of three wax seals on the door. Three cracked seals and the Inspector closes the bakery, and every player loses.
- **Scoring:** ★ (Reputation) is score. Tips are currency for buffs. Both are earned in mini games, scaled by quality.
- **Win:** if the bakery survives all 13 orders, the most ★ wins.
- **Freeloader penalty:** a player who never baked a 13th loaf all night loses half their ★ at the end.

## Rounds, timing and modes

Each round takes 2–3 minutes, so a 13-order night lasts about 35 minutes.

1. **Order reveal** (\~10 s): flip the order card, showing the customer, the item and any Rush or special rule.
2. **Mini game** (60–90 s): everyone plays at the same time. This is most of the round.
3. **Tally** (15–20 s): fill the tray, award ★ and Tips, and resolve the 13th-loaf decision.
4. **Market** (15–20 s): buy buffs from the market cart. This replaced the station draft from the first concept.

**Pacing across the night**

- Orders 1–4 (\~2 min each): one simple mini game per round to teach the systems.
- Orders 5–12 (2.5–3 min each): some rounds chain two mini games (for example, Knead into Proof), and the Inspector adds twists.
- Order 13, "Dawn" (4–5 min): a finale where every station runs at once in the Shared Oven, then the final Inspector check.

**Modes**

| Mode | Orders | Length | Use |
| --- | --- | --- | --- |
| Quick Shift | 7 | \~15 min | Fast sessions, solo daily challenge |
| Full Dozen | 13 | \~35 min | Standard game |
| Long Night | 13, stacked mini games | \~50 min | Game nights |

**Solo:** you run the bakery against greedy AI rivals who leave the 13th loaves to you. A 13-night campaign makes the Inspector stricter each night and unlocks recipes.

## Mini games

There are six mini games. Each one zooms in on a single surface and keeps the bakers visible in a corner so players can watch rivals struggle.

| Mini game | Input | How it scores | Co-opetition angle |
| --- | --- | --- | --- |
| Knead | Rhythm tapping | On-beat accuracy makes better dough | Solo skill |
| Proof | Push your luck | Longer rises are worth more, but dough can collapse; bailing early is safe but plain | Risk vs. the team's tray |
| Shared Oven | Real-time juggling | Pull trays at the right moment; burnt trays cost the team an item | Rescue a rival's tray for a favor, or let it burn |
| Decorate | Precision tracing | Line accuracy; the biggest ★ source | Solo skill |
| Scale | Weigh by feel, timed | Closeness to the target weight | Nod to the short-weight laws |
| Rush Order | Memory | Rebuild the customer's order from the pantry | Solo skill |

**Light sabotage:** players can borrow from a neighbor's pantry or bump the Shared Oven timer. It is never enough to sink the bakery.

## Market and buffs

After each order, a peddler's cart offers 3 random buffs. Players buy them with Tips, so spending never costs ★ directly.

- **Catch-up:** the last-place player gets a discount at the market.
- **Team buffs** are pooled: anyone can chip in. Contributors earn a small ★ bonus, and anyone who chipped in nothing all game takes an end-of-game penalty.
- **Rare buffs** appear in late rounds only.

| Buff | Type | Effect |
| --- | --- | --- |
| Sharp Memory | Personal | Rush Order recipe stays up 2 s longer |
| Steady Hands | Personal | Wider tracing margin in Decorate |
| Metronome | Personal | Visible beat guide in Knead |
| Baker's Nose | Personal | Shimmer warning before dough collapses in Proof |
| Calibrated Scale | Personal | Rough weight indicator in Scale |
| Extra Oven Slot | Team | One more slot in the Shared Oven |
| Apprentice | Team | Auto-fills 1 tray item per round |
| Bribe the Inspector | Team | Cancels one fine |
| Secret Family Recipe | Rare | Doubles ★ from one mini game type |
| Salt Shaker | Rare, sabotage | Scrambles a rival's next recipe |
| Flour Cloud | Rare, sabotage | Blurs a rival's screen for 3 s |

Prices are not set yet.

## Baker roster

There are six bakers. Each has one perk and one weakness. Skill ratings run 1–5 with 3 as the baseline, and each point is worth about 10–15%, so player skill still decides the game.

| Baker | Title | Perk | Weakness | Knead | Proof | Oven | Decorate | Scale | Rush |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Stephanie | The Strategist | Sees the next order one round early | Weaker at Knead | 2 | 3 | 3 | 3 | 5 | 4 |
| Joe | The Dungeon Baker | Parry: a perfectly timed oven pull scores double ★ | Weaker at Decorate | 3 | 3 | 5 | 2 | 3 | 3 |
| Pip | The Apprentice | Market buffs cost 20% less | No skill bonuses | 3 | 3 | 3 | 3 | 3 | 3 |
| Florentine | The Pâtissier | Clean lines score extra in Decorate | Plain bakes earn fewer Tips | 3 | 3 | 3 | 5 | 3 | 3 |
| Wick | The Flour Smuggler | Salt Shakers and Flour Clouds cost half | Loses ★ if caught mid-sabotage by the Inspector | 3 | 3 | 3 | 3 | 2 | 3 |
| Nonna Bea | The Recipe Keeper | Rush Order recipes stay up 2 s longer | Weaker at the Shared Oven | 3 | 4 | 2 | 3 | 3 | 5 |

**Visual identity:** every baker has a distinct silhouette and color so they stay readable in fast moments.

| Baker | Color | Silhouette |
| --- | --- | --- |
| Stephanie | Brick red #C8553D | Long brown hair with bangs, gold earrings |
| Joe | Steel blue #5B7BA6 | Riveted, dented iron helm with a red plume and nose guard |
| Pip | Green #5E9A58 | Mustard beanie with a pompom, freckles |
| Florentine | Rose #C2649A | Tall pleated chef's toque |
| Wick | Purple #7A5FB8 | Newsboy cap, toothpick |
| Nonna Bea | Teal #3E8E8F | Polka-dot headscarf, round glasses, gray curls |

Unlockable aprons, hats and rolling pins are planned as cosmetic progression.

## Screens and visual direction

There are five clickable 1440×810 mockups on the [Baker's Dozen Mockups canvas](https://claude.ai/artifact/4PTcW2ZNZvTBQyRF7y4DM6). The flow is Main menu → Tutorial (first run only) → Baker select → Bakery, with Achievements reached from the menu.

| Screen | What it shows |
| --- | --- |
| [Main menu](https://claude.ai/artifact/4PTcW2ZNZvTBQyRF7y4DM6#artboard-Main) | Title on a hanging wooden sign. Play, How to Play, Achievements (with count), Settings. Night window with the Inspector far off; a bread display with the geode |
| [Tutorial](https://claude.ai/artifact/4PTcW2ZNZvTBQyRF7y4DM6#artboard-Tutorial) | 4 steps on a parchment scroll: shared tray, 13th loaf, fines, ★ vs. Tips. Back, Next and Skip |
| [Baker select](https://claude.ai/artifact/4PTcW2ZNZvTBQyRF7y4DM6#artboard-BakerSelect) | 3×2 framed portrait grid. Detail panel with perk, weakness and loaf-icon skill ratings. Lock in, then Start the night. 4 player slots including Add an AI rival |
| [Bakery](https://claude.ai/artifact/4PTcW2ZNZvTBQyRF7y4DM6#artboard-Bakery) | Pinned order card, window clock, door with fine seals, shared tray on the counter, 4 player stations (★, Tips, 13th loaves, buffs, crown on the leader) |
| [Achievements](https://claude.ai/artifact/4PTcW2ZNZvTBQyRF7y4DM6#artboard-Achievements) | 12 medals. Filter by All, Unlocked or In progress. Overall progress bar |

**The window is the clock.** The sky moves from midnight blue (order 1) to sunrise (order 13). Stars fade, clouds and the sun rise, and the Inspector's lantern walks closer and grows. The Bakery mockup's Tweaks panel has order, fines and tray-fill sliders to preview this.

**Art style:** a cozy storybook look set in a candlelit medieval bakery at night. Chunky rounded shapes with a dark ink outline (#1E120C) on everything. Ambient motion: flickering candles, twinkling stars, drifting flour dust, pie steam and sparkles on the 13th slot. All motion stops under reduced-motion settings.

| Role | Color |
| --- | --- |
| Wall / ground | #2A1A12 dark wood |
| Wood trim | #6B4428 |
| Parchment | #F3E3C3 |
| Primary action, highlights | #F2A541 amber |
| ★ / gold | #E8B84A |
| Night sky | #141B3A |
| Fines / Rush | #A8322D wax red |

**Type:** Fraunces (800–900) for display, Nunito (500–900) for UI, both Google Fonts.

**UI rules**

- No narration or commentary text during play. Labels, numbers and icons only.
- Perks and weaknesses are plain rule text with no flavor lines.
- Body text and UI meet 4.5:1 contrast. Touch targets are at least 44 px. Colored banners use dark text on the light baker color.

## Tutorial, achievements and persistence

The tutorial plays automatically on a profile's first game and can be replayed any time from How to Play. Achievements are saved to the player's profile and carry across games.

**Tutorial:** 4 steps, under a minute, and skippable at any point. Finishing or skipping goes to Baker select.

1. Fill the tray together: every order needs 12 bakes on one shared tray.
2. Bake the 13th loaf: it protects the bakery and earns big ★ but costs a rare ingredient; never baking one halves your ★.
3. Three fines, everyone loses.
4. Most ★ wins: earn ★ and Tips in mini games and spend Tips at the market.

**Profile data to persist:** tutorial-seen flag, achievement unlocks with progress counters, baker win history (for Full Roster), lifetime 13th loaves, oven rescues, orders filled per customer, and cosmetic unlocks.

**Achievements (12)**

| Achievement | Condition | Type | Crossover |
| --- | --- | --- | --- |
| First Light | Survive your first night | One-time |  |
| Not a Crumb Short | Finish a night with zero fines | One-time |  |
| Baker's Dozen | Bake 13 insurance loaves | Lifetime counter |  |
| Good Neighbor | Rescue 25 rival trays from the oven | Lifetime counter |  |
| Salt in the Wound | Sabotage the leader during the final order | One-time |  |
| Full Roster | Win a night with every baker | Lifetime, 6 bakers |  |
| Law & Order | Fill 13 orders for the Sheriff | Lifetime counter | Geode Gobbler |
| Something Shiny | Find what's baked inside the Sheriff's loaf | Secret | Geode Gobbler |
| Parry, Then Bake | Land 10 perfect oven pulls in one night as Joe | One night | Dungeon Joe |
| Rest at the Hearth | Light the hearth in the back of the bakery | Secret | Dungeon Joe |
| On the Beat | Knead 13 perfect beats in a row | Streak | Blade Cadence |
| Natural 20 | Pull a Proof at the exact peak | One-time | D&D system |

Secret achievements show as ??? with a lock icon until unlocked, but their game tag stays visible as a hint.

## Easter eggs and crossovers

The game lives in the Dungeon Joe universe and nods to the other games without explaining itself on screen.

| Source | In Baker's Dozen |
| --- | --- |
| Dungeon Joe | Joe is a playable baker in his helm. His parry perk mirrors souls-like timing. Parry, Then Bake achievement. A hidden hearth to light (Rest at the Hearth, a bonfire nod) |
| Geode Gobbler | The Sheriff is a recurring customer with a star badge on his order cards. Law & Order achievement. A geode baked into one of his loaves (Something Shiny). A geode sits on the main-menu bread display |
| Blade Cadence | Knead's rhythm input. On the Beat achievement for 13 perfect beats in a row |
| D&D DM system | Natural 20 achievement for a perfect Proof pull; d20 medal icon |

## Open questions and next steps

The biggest open decisions are the platform and the art references for Joe and the Sheriff.

- [ ] Platform and engine: browser (like Dungeon Joe), mobile, or both? Local couch play, online, or both?
- [ ] Art references for Joe from Dungeon Joe, and for the Sheriff from Geode Gobbler. The current versions are placeholders.
- [ ] Confirm Stephanie's look and colors.
- [ ] Set buff prices, the Tips earn rate per mini game and the size of the 13th-loaf bonus.
- [ ] Rare ingredient economy: how players get Saffron and similar items, and how many per night.
- [ ] Inspector twists for orders 5–12: write the list.
- [ ] AI rival behavior: tune how greedy each AI baker is.
- [ ] Market, mini game and end-of-night results screens still need mockups.
- [ ] Settings screen contents, including the reduced-motion option.
