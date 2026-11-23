// The match state. It must stay plain JSON (no Maps, Sets or classes): the host sends it to every guest whole,
// keeps a copy in sessionStorage to survive a refresh, and the rules functions copy it freely.

export type BakerId = 'stephanie' | 'joe' | 'pip' | 'florentine' | 'wick' | 'bea';
export type MiniId = 'knead' | 'proof' | 'oven' | 'decorate' | 'scale' | 'rush' | 'juggle' | 'fold' | 'kitchen';
/** a played game: one of the nine, or the Dawn finale (every station at once in the Shared Oven) */
export type GameId = MiniId | 'dawn';
/** the games the host runs for the whole table at once (everyone in one room); the rest each player runs alone */
export type SharedGame = 'oven' | 'dawn' | 'kitchen';
export type Style = 'coopetition' | 'coop' | 'ffa' | 'teams';
export type Length = 'quick' | 'full' | 'long';
/** how long each mini game runs (the host picks it in the lobby) */
export type Pace = 'short' | 'normal' | 'long';
export type AiLevel = 1 | 2 | 3;
export type ModId =
  | 'midnight'
  | 'strict'
  | 'shortage'
  | 'patrons'
  | 'rarecart'
  | 'doubleshift'
  | 'picky'
  | 'flourstorm'
  | 'mirror'
  | 'haunted'
  | 'sabotage'
  | 'swap'
  | 'lightsout'
  | 'tiny';
export type TwistId =
  | 'rush'
  | 'double'
  | 'shortweight'
  | 'spotcheck'
  | 'closed'
  | 'shipment'
  | 'watch'
  | 'tips'
  | 'bestinshow'
  | 'blackout'
  | 'taster'
  | 'nothirteenth';
export type BuffId =
  | 'memory'
  | 'hands'
  | 'metronome'
  | 'nose'
  | 'scale'
  | 'ovenslot'
  | 'apprentice'
  | 'bribe'
  | 'recipe'
  | 'salt'
  | 'flour'
  | 'saffron';
export type Phase = 'reveal' | 'play' | 'tally' | 'market' | 'dawncheck' | 'over';
export type EmoteId = 'cheers' | 'laugh' | 'heart' | 'burnt';

export interface Cosmetics {
  apron: string;
  pin: string;
  badge: string;
}

export interface Seat {
  /** account id for a person, 'ai:N' for an AI rival, 'local' for the solo player */
  id: string;
  name: string;
  baker: BakerId;
  ai: boolean;
  /** an AI is playing for a person who dropped; they get the seat back when they return */
  standIn: boolean;
  aiLevel: AiLevel;
  team: number;
  cosmetics: Cosmetics;
}

export interface PlayerStats {
  perfect: number;
  rescues: number;
  burnt: number;
  perfectPulls: number;
  sabotages: number;
  caught: number;
  natural20: boolean;
  /** sabotaged the leader going into the final order (Salt in the Wound) */
  saltLeader: boolean;
  bestBeatStreak: number;
  bakes: number;
  tipsEarned: number;
  starsFrom: Partial<Record<GameId, number>>;
}

export interface PlayerState {
  stars: number;
  tips: number;
  saffron: number;
  loaves13: number;
  /** personal and rare buffs held (ids; personal ones last the night, rare ones are spent when used) */
  buffs: BuffId[];
  /** Secret Family Recipe: doubles ★ from this game type (once) */
  recipeFor: MiniId | null;
  /** sabotage waiting to land on this player's next game */
  salted: boolean;
  flourAt: number;
  /** tips chipped into team buffs this night (0 at the end = penalty) */
  chipped: number;
  stats: PlayerStats;
  /** last order's numbers, for the tally screen */
  last: RoundScore | null;
  /** the latest game's own numbers (a chained order's second count floats these, not the order's total) */
  lastGame: RoundScore | null;
}

export interface RoundScore {
  q: number;
  loaves: number;
  stars: number;
  tips: number;
  saffron: number;
  grade: Grade;
}

export type Grade = 'perfect' | 'great' | 'good' | 'plain' | 'flop';

export interface Bakery {
  /** seat indexes that bake for this bakery */
  members: number[];
  /** loaves on the tray (the exact total, rounded) */
  tray: number;
  /** the exact (fractional) total: every bake adds its share, the tray shows it rounded */
  trayExact: number;
  /** loaves that went on the tray this order, per seat (exact; for the tally dots) */
  trayBy: number[];
  /** whole loaves already counted onto the tray this order: where the next count starts */
  counted: number;
  seals: number;
  maxSeals: number;
  closed: boolean;
  closedAt: number;
  bribes: number;
  ovenSlots: number;
  apprentice: number;
  /** team buffs bought this night (for the chip-in penalty) */
  teamBuys: number;
  /** 13th loaf claim for this order: seat index, or -1 */
  thirteenth: number;
  filled: number;
  fines: number;
  /** orders filled for the Sheriff (Law & Order) */
  sheriff: number;
}

export interface Order {
  idx: number;
  customer: string;
  item: string;
  games: GameId[];
  rush: boolean;
  twist: TwistId | null;
  /** loaves the tray needs (12, or 13 on a Spot Check) */
  need: number;
}

export interface CartItem {
  buff: BuffId;
  price: number;
  /** team buffs: tips paid in so far, per bakery index */
  pool: number[];
  /** rare items: who bought it (seat index) or -1 */
  soldTo: number;
  /** personal buys: seats that bought one */
  buyers: number[];
  /** team buffs: tips each seat chipped in */
  by: number[];
}

export interface MatchCfg {
  style: Style;
  length: Length;
  /** mini game length (not the Shared Oven or Dawn, which run until their trays are out); missing = normal */
  pace?: Pace;
  mods: ModId[];
  aiLevel: AiLevel;
  seed: number;
  /** solo campaign night 1-13 (stricter each night) */
  night: number | null;
  /** daily challenge date YYYY-MM-DD */
  daily: string | null;
}

export interface MatchEvent {
  /** increments; clients play each event once */
  n: number;
  k: string;
  seat?: number;
  to?: number;
  v?: number;
  s?: string;
}

export interface MatchState {
  v: 1;
  cfg: MatchCfg;
  seats: Seat[];
  players: PlayerState[];
  bakeries: Bakery[];
  orders: Order[];
  round: number;
  /** which game of a chained order is being played */
  part: number;
  phase: Phase;
  /** host clock (ms) */
  phaseStart: number;
  phaseEnd: number;
  cart: CartItem[];
  /** seats that have pressed Done in the market / sent this part's result */
  done: number[];
  /** seats that want the 13th loaf this order */
  claims: number[];
  /** sub-step of the tally: 0 counting, 1 the 13th window, 2 resolved */
  tallyStep: number;
  events: MatchEvent[];
  eventN: number;
  over: MatchOver | null;
  rngState: number;
  /** a person lit the hearth (Rest at the Hearth): it stays lit for the night */
  hearth: boolean;
  /** the night ends after this tally (a bakery closed) */
  endEarly: boolean;
}

export interface MatchOver {
  survived: boolean[];
  /** seat order, best first */
  ranking: number[];
  winnerTeam: number;
  penalties: { seat: number; kind: 'freeloader' | 'nochip'; stars: number }[];
  finalStars: number[];
  medal: 'gold' | 'silver' | 'bronze' | null;
}

/** one player's result for one game (sent by the client that played it, or made up by the AI) */
export interface GameResult {
  q: number;
  perfect?: number;
  beatStreak?: number;
  natural20?: boolean;
  /** oven: loaves pulled for each seat's bakery, burnt trays, rescues, perfect pulls */
  oven?: { loaves: number; burnt: number; rescues: number; perfectPulls: number; stars: number };
  /** All Hands (the shared kitchen): this seat's part of its bakery's served loaves, and what it did */
  kitchen?: { loaves: number; served: number; burnt: number };
  geode?: boolean;
}

export interface LiveProgress {
  /** 0..1 how well it is going */
  v: number;
  /** combo / streak, shown under the portrait */
  c: number;
  /** last thing that happened: 'hit' | 'miss' | 'perfect' | 'burnt' ... */
  e: string;
  at: number;
}
