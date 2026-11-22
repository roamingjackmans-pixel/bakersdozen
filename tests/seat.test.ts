// A solo night is played from the player's own seat. Signed in, the lobby seats you under your account id; offline,
// as 'local'. The night used to look for 'local' only, so a signed-in player's solo night never opened their games.
import { describe, expect, it } from 'vitest';
import { soloPlayerId } from '../src/game/match';
import { aiSeats } from '../src/game/sim';

const rivals = aiSeats(['joe', 'pip', 'florentine'], 2, 'coopetition');
const you = (id: string) => ({ ...aiSeats(['stephanie'], 2, 'coopetition')[0]!, id, ai: false });

describe('whose seat a solo night is played from', () => {
  it('a signed-in player: their account seat', () => {
    expect(soloPlayerId([you('acct-42'), ...rivals], 'acct-42')).toBe('acct-42');
  });
  it('offline: the local seat', () => {
    expect(soloPlayerId([you('local'), ...rivals], null)).toBe('local');
  });
  it('a night resumed after signing out still finds the one person at the table', () => {
    expect(soloPlayerId([you('acct-42'), ...rivals], null)).toBe('acct-42');
  });
  it('never an AI seat', () => {
    expect(soloPlayerId(rivals, 'ai:0')).toBe('local');
  });
});
