// Content as data: bakers, mini games, buffs, customers, twists, modifiers, achievements, cosmetics.
// Every balance number lives in BAL so a balance pass changes one place (docs/BALANCE.md explains them).
import type { BakerId, BuffId, GameId, Length, MiniId, ModId, Style, TwistId } from './types';

export const BAL = {
  /** ★ a perfect game is worth (before Rush, buffs and the game's weight) */
  starsPerGame: 6,
  /** Decorate is the biggest ★ source */
  gameWeight: { knead: 1, proof: 1, oven: 1.0, decorate: 1.3, scale: 1, rush: 1, dawn: 1.6 } as Record<GameId, number>,
  /** tray loaves a perfect game makes, as a share of 12 / bakers on that tray */
  yieldFactor: 1.25,
  /** loaves = q^yieldCurve × share: under 1 so a casual table can still fill a tray */
  yieldCurve: 0.5,
  /** how much an AI rival's bakes vary game to game (people are streaky) */
  aiSpread: 0.2,
  /** each chaotic modifier on makes the trays this much easier to fill */
  chaosAllowance: 0.045,
  /** under this quality a bake puts nothing on the tray */
  flopBelow: 0.18,
  tipsBase: 1,
  tipsPerQ: 4,
  /** a Perfect bake (q at or over this) drops a Saffron */
  saffronDropAt: 0.9,
  saffronDropChance: 0.55,
  startSaffron: 1,
  thirteenthStars: 5,
  freeloaderKeeps: 0.5,
  noChipPenalty: 3,
  chipStars: 1,
  catchUpDiscount: 0.25,
  pipDiscount: 0.2,
  wickSabotageDiscount: 0.5,
  wickCaughtChance: 0.12,
  wickCaughtStars: 2,
  rushStars: 1.3,
  skillStep: 0.12,
  /** seconds */
  revealS: 8,
  playS: 50,
  playLateS: 58,
  chainS: 38,
  longS: 50,
  dawnS: 80,
  tallyCountS: 4.5,
  tallyClaimS: 6,
  tallyResolveS: 3.5,
  marketS: 20,
  dawnCheckS: 7,
  /** an AI fills in for a missing result this long after the game ends */
  resultGraceS: 3,
  /** dev: ?fast=0.3 runs every clock at 30% (testing) */
  timeScale: 1,
};

export interface BakerDef {
  id: BakerId;
  name: string;
  title: string;
  perk: string;
  weakness: string;
  skills: Record<MiniId, number>;
  coat: string;
  light: string;
  tint: string;
  skin: string;
  hat: 'hair' | 'helm' | 'beanie' | 'chef' | 'cap' | 'scarf';
  best: string;
  /** AI personality: how readily it bakes the 13th loaf (0 never .. 1 always) and sabotages */
  greed: number;
  mischief: number;
}

export const BAKERS: BakerDef[] = [
  {
    id: 'stephanie',
    name: 'Stephanie',
    title: 'The Strategist',
    perk: 'Sees the next order one round early.',
    weakness: 'Weaker at Knead.',
    skills: { knead: 2, proof: 3, oven: 3, decorate: 3, scale: 5, rush: 4 },
    coat: '#C8553D',
    light: '#F2A08C',
    tint: '#4A2A20',
    skin: '#F1C7A0',
    hat: 'hair',
    best: 'Scale',
    greed: 0.5,
    mischief: 0.3,
  },
  {
    id: 'joe',
    name: 'Joe',
    title: 'The Dungeon Baker',
    perk: 'Parry: a perfectly timed oven pull scores double ★.',
    weakness: 'Weaker at Decorate.',
    skills: { knead: 3, proof: 3, oven: 5, decorate: 2, scale: 3, rush: 3 },
    coat: '#5B7BA6',
    light: '#A9C2E6',
    tint: '#1F2A3A',
    skin: '#E8C9A0',
    hat: 'helm',
    best: 'Shared Oven',
    greed: 0.4,
    mischief: 0.2,
  },
  {
    id: 'pip',
    name: 'Pip',
    title: 'The Apprentice',
    perk: 'Market buffs cost 20% less.',
    weakness: 'No skill bonuses.',
    skills: { knead: 3, proof: 3, oven: 3, decorate: 3, scale: 3, rush: 3 },
    coat: '#5E9A58',
    light: '#A8D69F',
    tint: '#26361F',
    skin: '#E0A97E',
    hat: 'beanie',
    best: 'Buffs',
    greed: 0.45,
    mischief: 0.15,
  },
  {
    id: 'florentine',
    name: 'Florentine',
    title: 'The Pâtissier',
    perk: 'Clean lines score extra in Decorate.',
    weakness: 'Plain bakes earn fewer Tips.',
    skills: { knead: 3, proof: 3, oven: 3, decorate: 5, scale: 3, rush: 3 },
    coat: '#C2649A',
    light: '#F0A8CF',
    tint: '#452338',
    skin: '#F4D2B5',
    hat: 'chef',
    best: 'Decorate',
    greed: 0.6,
    mischief: 0.35,
  },
  {
    id: 'wick',
    name: 'Wick',
    title: 'The Flour Smuggler',
    perk: 'Salt Shakers and Flour Clouds cost half.',
    weakness: 'Loses ★ if caught mid-sabotage by the Inspector.',
    skills: { knead: 3, proof: 3, oven: 3, decorate: 3, scale: 2, rush: 3 },
    coat: '#7A5FB8',
    light: '#C3B0F0',
    tint: '#2F2648',
    skin: '#C98B5E',
    hat: 'cap',
    best: 'Sabotage',
    greed: 0.7,
    mischief: 0.85,
  },
  {
    id: 'bea',
    name: 'Nonna Bea',
    title: 'The Recipe Keeper',
    perk: 'Rush Order recipes stay up 2 s longer.',
    weakness: 'Weaker at the Shared Oven.',
    skills: { knead: 3, proof: 4, oven: 2, decorate: 3, scale: 3, rush: 5 },
    coat: '#3E8E8F',
    light: '#93D3D2',
    tint: '#1E3A3A',
    skin: '#B07448',
    hat: 'scarf',
    best: 'Rush Order',
    greed: 0.3,
    mischief: 0.1,
  },
];
export const BAKER: Record<BakerId, BakerDef> = Object.fromEntries(BAKERS.map((b) => [b.id, b])) as Record<BakerId, BakerDef>;

/** each skill point above 3 makes that game about 12% easier (wider windows, longer looks) */
export function skillMult(baker: BakerId, game: GameId): number {
  // Dawn runs every station at once: it uses the average of all six skills
  const sk = BAKER[baker].skills;
  const s = game === 'dawn' ? (sk.knead + sk.proof + sk.oven + sk.decorate + sk.scale + sk.rush) / 6 : sk[game];
  return 1 + BAL.skillStep * (s - 3);
}

export interface GameDef {
  id: GameId;
  name: string;
  /** two to four words, shown on the order card and the game's intro */
  how: string;
  input: string;
  color: string;
}
export const GAMES: Record<GameId, GameDef> = {
  knead: { id: 'knead', name: 'Knead', how: 'Tap on the beat', input: 'Tap / Space', color: '#F2C14E' },
  proof: { id: 'proof', name: 'Proof', how: 'Hold to rise · let go to bake', input: 'Hold / Space', color: '#F2A08C' },
  oven: { id: 'oven', name: 'Shared Oven', how: 'Load · pull when golden', input: 'Tap trays', color: '#E07A1F' },
  decorate: { id: 'decorate', name: 'Decorate', how: 'Trace the line', input: 'Drag', color: '#F0A8CF' },
  scale: { id: 'scale', name: 'Scale', how: 'Hold to pour · hit the weight', input: 'Hold / Space', color: '#93D3D2' },
  rush: { id: 'rush', name: 'Rush Order', how: 'Remember · rebuild', input: 'Tap / 1-8', color: '#C3B0F0' },
  dawn: { id: 'dawn', name: 'Dawn', how: 'Every station at once', input: 'Tap · hold · drag', color: '#FFD27A' },
};
export const MINI_IDS: MiniId[] = ['knead', 'proof', 'oven', 'decorate', 'scale', 'rush'];

export type BuffKind = 'personal' | 'team' | 'rare' | 'staple';
export interface BuffDef {
  id: BuffId;
  name: string;
  kind: BuffKind;
  effect: string;
  price: number;
  color: string;
  /** the game it helps (personal buffs) */
  game?: MiniId;
  sabotage?: boolean;
}
export const BUFFS: Record<BuffId, BuffDef> = {
  memory: { id: 'memory', name: 'Sharp Memory', kind: 'personal', effect: 'Rush Order recipe stays up 2 s longer.', price: 6, color: '#C3B0F0', game: 'rush' },
  hands: { id: 'hands', name: 'Steady Hands', kind: 'personal', effect: 'Wider tracing margin in Decorate.', price: 6, color: '#A8D69F', game: 'decorate' },
  metronome: { id: 'metronome', name: 'Metronome', kind: 'personal', effect: 'Visible beat guide in Knead.', price: 5, color: '#F2C14E', game: 'knead' },
  nose: { id: 'nose', name: "Baker's Nose", kind: 'personal', effect: 'Shimmer warning before dough collapses in Proof.', price: 5, color: '#F2A08C', game: 'proof' },
  scale: { id: 'scale', name: 'Calibrated Scale', kind: 'personal', effect: 'Rough weight indicator in Scale.', price: 5, color: '#93D3D2', game: 'scale' },
  ovenslot: { id: 'ovenslot', name: 'Extra Oven Slot', kind: 'team', effect: 'One more slot in the Shared Oven.', price: 12, color: '#E07A1F' },
  apprentice: { id: 'apprentice', name: 'Apprentice', kind: 'team', effect: 'Auto-fills 1 tray item per round for 3 rounds.', price: 14, color: '#A8D69F' },
  bribe: { id: 'bribe', name: 'Bribe the Inspector', kind: 'team', effect: 'Cancels one fine.', price: 18, color: '#E8B84A' },
  recipe: { id: 'recipe', name: 'Secret Family Recipe', kind: 'rare', effect: 'Doubles ★ from your next game of one type.', price: 11, color: '#FFD166' },
  salt: { id: 'salt', name: 'Salt Shaker', kind: 'rare', effect: "Scrambles a rival's next recipe.", price: 9, color: '#FFFDF8', sabotage: true },
  flour: { id: 'flour', name: 'Flour Cloud', kind: 'rare', effect: "Blurs a rival's screen for 3 s.", price: 7, color: '#F3E3C3', sabotage: true },
  saffron: { id: 'saffron', name: 'Saffron', kind: 'staple', effect: 'One rare ingredient for a 13th loaf.', price: 7, color: '#F2A541' },
};
export const PERSONAL_BUFFS: BuffId[] = ['memory', 'hands', 'metronome', 'nose', 'scale'];
export const TEAM_BUFFS: BuffId[] = ['ovenslot', 'apprentice', 'bribe'];
export const RARE_BUFFS: BuffId[] = ['recipe', 'salt', 'flour'];

export interface Customer {
  id: string;
  name: string;
  /** the items they order */
  items: string[];
  badge?: 'sheriff' | 'gary' | 'clerk';
}
export const CUSTOMERS: Customer[] = [
  { id: 'sheriff', name: 'The Sheriff', items: ['Croissants', 'Honey Buns', 'Pretzels'], badge: 'sheriff' },
  { id: 'miller', name: 'The Miller', items: ['Rye Loaves', 'Sourdough', 'Baguettes'] },
  { id: 'marchpane', name: 'Lady Marchpane', items: ['Plum Tarts', 'Shortbread', 'Cinnamon Rolls'] },
  { id: 'barnaby', name: 'Brother Barnaby', items: ['Sourdough', 'Honey Buns', 'Rye Loaves'] },
  { id: 'smith', name: 'The Blacksmith', items: ['Meat Pies', 'Pretzels', 'Rye Loaves'] },
  { id: 'ferryman', name: 'Old Tom the Ferryman', items: ['Bagels', 'Baguettes', 'Meat Pies'] },
  { id: 'mayor', name: 'The Mayor', items: ['Croissants', 'Plum Tarts', 'Saffron Buns'] },
  { id: 'hettie', name: 'Goodwife Hettie', items: ['Cinnamon Rolls', 'Shortbread', 'Bagels'] },
  { id: 'bard', name: 'The Bard', items: ['Pretzels', 'Croissants', 'Honey Buns'] },
  { id: 'gary', name: 'Gary', items: ['Meat Pies', 'Sourdough', 'Saffron Buns'], badge: 'gary' },
  { id: 'clerk', name: "The Landlord's Clerk", items: ['Shortbread', 'Rye Loaves', 'Bagels'], badge: 'clerk' },
];
export const CUSTOMER: Record<string, Customer> = Object.fromEntries(CUSTOMERS.map((c) => [c.id, c]));

/** item → icon shape and the games that suit it */
export const ITEMS: Record<string, { icon: string; games: MiniId[] }> = {
  Croissants: { icon: 'croissant', games: ['knead', 'proof', 'oven'] },
  'Honey Buns': { icon: 'bun', games: ['proof', 'decorate', 'scale'] },
  Pretzels: { icon: 'pretzel', games: ['knead', 'rush', 'oven'] },
  'Rye Loaves': { icon: 'loaf', games: ['scale', 'knead', 'oven'] },
  Sourdough: { icon: 'boule', games: ['proof', 'scale', 'knead'] },
  Baguettes: { icon: 'baguette', games: ['knead', 'oven', 'rush'] },
  'Plum Tarts': { icon: 'tart', games: ['decorate', 'rush', 'scale'] },
  Shortbread: { icon: 'cookie', games: ['decorate', 'scale', 'rush'] },
  'Cinnamon Rolls': { icon: 'roll', games: ['decorate', 'proof', 'oven'] },
  'Meat Pies': { icon: 'pie', games: ['oven', 'rush', 'scale'] },
  Bagels: { icon: 'bagel', games: ['oven', 'knead', 'rush'] },
  'Saffron Buns': { icon: 'bun', games: ['proof', 'decorate', 'rush'] },
};

export interface TwistDef {
  id: TwistId;
  name: string;
  rule: string;
}
export const TWISTS: Record<TwistId, TwistDef> = {
  rush: { id: 'rush', name: 'Rush', rule: 'Shorter clock. ★ ×1.3.' },
  double: { id: 'double', name: 'Double Bake', rule: 'Two games back to back.' },
  shortweight: { id: 'shortweight', name: 'Short Weight', rule: 'Plain bakes put nothing on the tray.' },
  spotcheck: { id: 'spotcheck', name: 'Spot Check', rule: 'The tray needs 13.' },
  closed: { id: 'closed', name: 'Market Closed', rule: 'No market after this order.' },
  shipment: { id: 'shipment', name: 'Saffron Shipment', rule: 'Everyone gets 1 Saffron.' },
  watch: { id: 'watch', name: "Inspector's Watch", rule: 'Sabotage is caught half the time: −2 ★.' },
  tips: { id: 'tips', name: 'Generous Tips', rule: 'Tips ×2 this order.' },
  bestinshow: { id: 'bestinshow', name: 'Best in Show', rule: 'Best bake +3 ★.' },
  blackout: { id: 'blackout', name: 'Blackout', rule: 'Candlelight only.' },
  taster: { id: 'taster', name: 'Royal Taster', rule: '★ ×1.5 this order.' },
  nothirteenth: { id: 'nothirteenth', name: 'No Insurance', rule: 'No 13th loaf this order.' },
};
export const TWIST_IDS = Object.keys(TWISTS) as TwistId[];

export interface ModDef {
  id: ModId;
  name: string;
  rule: string;
  chaos: boolean;
}
export const MODS: ModDef[] = [
  { id: 'midnight', name: 'Midnight Rush', rule: 'Every clock 25% shorter. ★ ×1.25.', chaos: false },
  { id: 'strict', name: 'Strict Inspector', rule: 'Two seals instead of three.', chaos: false },
  { id: 'shortage', name: 'Saffron Shortage', rule: 'No starting Saffron. Perfect bakes drop it less.', chaos: false },
  { id: 'patrons', name: 'Generous Patrons', rule: 'Tips ×2.', chaos: false },
  { id: 'rarecart', name: 'Rare Cart', rule: 'Four cart slots. Rare buffs from order 1.', chaos: false },
  { id: 'doubleshift', name: 'Double Shift', rule: 'Every order chains two games.', chaos: false },
  { id: 'picky', name: 'Picky Customers', rule: 'Bakes need more quality to count. ★ ×1.5.', chaos: false },
  { id: 'flourstorm', name: 'Flour Storm', rule: 'Flour clouds drift over every screen.', chaos: true },
  { id: 'mirror', name: 'Mirror Kitchen', rule: 'Left and right are swapped.', chaos: true },
  { id: 'haunted', name: 'Haunted Bakery', rule: 'A ghost drifts by. Oven timers wobble.', chaos: true },
  { id: 'sabotage', name: 'Sabotage Night', rule: 'A free Salt Shaker and Flour Cloud every order. Nobody gets caught.', chaos: true },
  { id: 'swap', name: 'Swap Shop', rule: 'Halfway through, the game swaps.', chaos: true },
  { id: 'lightsout', name: 'Lights Out', rule: 'Candlelight around your cursor only.', chaos: true },
  { id: 'tiny', name: 'Tiny Kitchen', rule: 'Every target 30% smaller.', chaos: true },
];
export const MOD: Record<ModId, ModDef> = Object.fromEntries(MODS.map((m) => [m.id, m])) as Record<ModId, ModDef>;

export const STYLES: { id: Style; name: string; rule: string }[] = [
  { id: 'coopetition', name: 'Co-opetition', rule: 'One shared tray. Everyone loses if the bakery fails. Most ★ wins.' },
  { id: 'coop', name: 'Co-op', rule: 'One tray, one team score. No sabotage. Beat the Inspector together.' },
  { id: 'ffa', name: 'Free-for-all', rule: 'Every baker runs their own tray and seals. Most ★ among the survivors wins.' },
  { id: 'teams', name: '2v2 Rival Bakeries', rule: 'Two teams, two trays. Survive and out-score the other bakery.' },
];

export const LENGTHS: { id: Length; name: string; orders: number; about: string }[] = [
  { id: 'quick', name: 'Quick Shift', orders: 7, about: '~12 min' },
  { id: 'full', name: 'Full Dozen', orders: 13, about: '~25 min' },
  { id: 'long', name: 'Long Night', orders: 13, about: '~35 min' },
];

// ------------------------------------------------------------------ achievements

export interface AchDef {
  id: string;
  title: string;
  desc: string;
  icon: string;
  need: number;
  secret?: boolean;
  tag?: string;
  tagColor?: string;
}
export const ACHIEVEMENTS: AchDef[] = [
  { id: 'firstlight', title: 'First Light', desc: 'Survive your first night.', icon: 'sun', need: 1 },
  { id: 'nocrumb', title: 'Not a Crumb Short', desc: 'Finish a night with zero fines.', icon: 'shield', need: 1 },
  { id: 'bakersdozen', title: "Baker's Dozen", desc: 'Bake 13 insurance loaves.', icon: 'loaf', need: 13 },
  { id: 'neighbor', title: 'Good Neighbor', desc: 'Rescue 25 rival trays from the oven.', icon: 'hand', need: 25 },
  { id: 'salt', title: 'Salt in the Wound', desc: 'Sabotage the leader during the final order.', icon: 'salt', need: 1 },
  { id: 'roster', title: 'Full Roster', desc: 'Win a night with every baker.', icon: 'people', need: 6 },
  { id: 'law', title: 'Law & Order', desc: 'Fill 13 orders for the Sheriff.', icon: 'badge', need: 13, tag: 'Geode Gobbler', tagColor: '#E8B84A' },
  { id: 'shiny', title: 'Something Shiny', desc: "Find what's baked inside the Sheriff's loaf.", icon: 'gem', need: 1, secret: true, tag: 'Geode Gobbler', tagColor: '#E8B84A' },
  { id: 'parry', title: 'Parry, Then Bake', desc: 'Land 10 perfect oven pulls in one night as Joe.', icon: 'sword', need: 10, tag: 'Dungeon Joe', tagColor: '#A9C2E6' },
  { id: 'hearth', title: 'Rest at the Hearth', desc: 'Light the hearth in the back of the bakery.', icon: 'fire', need: 1, secret: true, tag: 'Dungeon Joe', tagColor: '#A9C2E6' },
  { id: 'beat', title: 'On the Beat', desc: 'Knead 13 perfect beats in a row.', icon: 'music', need: 13, tag: 'Blade Cadence', tagColor: '#F2A08C' },
  { id: 'nat20', title: 'Natural 20', desc: 'Pull a Proof at the exact peak.', icon: 'd20', need: 1, tag: 'D&D', tagColor: '#C3B0F0' },
];

// ------------------------------------------------------------------ cosmetics

export interface CosmeticDef {
  id: string;
  slot: 'apron' | 'pin' | 'badge';
  name: string;
  /** what unlocks it (shown on the locker) */
  how: string;
  /** colors / pattern key used by the portrait and station art */
  look: string[];
}
export const COSMETICS: CosmeticDef[] = [
  { id: 'apron_plain', slot: 'apron', name: 'Linen', how: 'Starter', look: ['plain', '#FFF4E0'] },
  { id: 'apron_gingham', slot: 'apron', name: 'Gingham', how: 'Survive 3 nights', look: ['gingham', '#FFF4E0', '#C8553D'] },
  { id: 'apron_stripe', slot: 'apron', name: 'Market Stripe', how: 'Play 5 nights', look: ['stripe', '#FFF4E0', '#3E8E8F'] },
  { id: 'apron_starry', slot: 'apron', name: 'Starry Night', how: 'Survive a Full Dozen', look: ['stars', '#2E3468', '#FFE7A3'] },
  { id: 'apron_dawn', slot: 'apron', name: 'Daybreak', how: 'Campaign night 7', look: ['plain', '#FFCF7A'] },
  { id: 'apron_gold', slot: 'apron', name: 'Gold Trim', how: 'Win 10 nights', look: ['trim', '#FFF4E0', '#E8B84A'] },
  { id: 'apron_royal', slot: 'apron', name: 'Royal Warrant', how: 'Finish the 13-night campaign', look: ['trim', '#7A2B3A', '#E8B84A'] },
  { id: 'pin_oak', slot: 'pin', name: 'Oak Pin', how: 'Starter', look: ['#D9A46A', '#8A5A35'] },
  { id: 'pin_marble', slot: 'pin', name: 'Marble Pin', how: 'Bake 13 insurance loaves', look: ['#E9E4DC', '#9A948A'] },
  { id: 'pin_copper', slot: 'pin', name: 'Copper Pin', how: 'Daily challenge 3 days', look: ['#D98A4A', '#8A4A2A'] },
  { id: 'pin_gold', slot: 'pin', name: 'Golden Pin', how: 'Full Roster', look: ['#F7CF62', '#B9862C'] },
  { id: 'pin_bonk', slot: 'pin', name: 'Bonk Pin', how: 'Parry, Then Bake', look: ['#9AA1AD', '#5E6470'] },
  { id: 'pin_geode', slot: 'pin', name: 'Geode Pin', how: 'Something Shiny', look: ['#8E6AD8', '#4A2A7A'] },
  { id: 'badge_none', slot: 'badge', name: 'No badge', how: 'Starter', look: [] },
  { id: 'badge_daisy', slot: 'badge', name: 'Daisy', how: 'Survive your first night', look: ['daisy'] },
  { id: 'badge_star', slot: 'badge', name: 'Tin Star', how: 'Law & Order', look: ['star'] },
  { id: 'badge_note', slot: 'badge', name: 'Music Note', how: 'On the Beat', look: ['note'] },
  { id: 'badge_d20', slot: 'badge', name: 'd20', how: 'Natural 20', look: ['d20'] },
  { id: 'badge_ember', slot: 'badge', name: 'Ember', how: 'Rest at the Hearth', look: ['ember'] },
  { id: 'badge_feather', slot: 'badge', name: 'Feather', how: 'Not a Crumb Short', look: ['feather'] },
];
export const COSMETIC: Record<string, CosmeticDef> = Object.fromEntries(COSMETICS.map((c) => [c.id, c]));
export const DEFAULT_COSMETICS = { apron: 'apron_plain', pin: 'pin_oak', badge: 'badge_none' };

export const EMOTES = ['cheers', 'laugh', 'heart', 'burnt'] as const;

/** names for AI rivals sitting in for nobody (they just use the baker's name) */
export function aiName(baker: BakerId): string {
  return BAKER[baker].name;
}
