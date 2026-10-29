import { sprite, sym } from './types';

// 1 = hull, 2 = wing trim, 3 = cockpit / engine glow
export const PLAYER = sprite(
  'player',
  sym([
    '......1',
    '.....11',
    '.....13',
    '..2..13',
    '..2.111',
    '.221112',
    '2211122',
    '2111222',
    '11.1112',
    '1...111',
    '......3',
  ]),
  sym([
    '......1',
    '.....11',
    '.....13',
    '..2..13',
    '..2.111',
    '.221112',
    '2211122',
    '2111222',
    '11.1112',
    '1...111',
    '.....3.',
  ]),
);

export const LIFE_ICON = sprite(
  'lifeIcon',
  sym(['...1', '..11', '.211', '2111', '1.11']),
);

export const PLAYER_DEBRIS = sprite('playerDebris', ['1.', '.1'], ['.1', '1.']);
