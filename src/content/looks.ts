import { col, BLACK, WHITE, type PenName } from '../palette';

/**
 * Colour schemes, as data. A look says which master colour each pen shows,
 * and how that changes down the screen (bands and per-scanline gradients)
 * and over time (cycles). This is our take on the 1981 trick of rewriting
 * the colour registers between scanlines.
 */
export interface Band { y0: number; y1: number; pens: Partial<Record<PenName, number>> }
/** Per-scanline stripes: pen shows colours[i] for `lines` lines each, optionally scrolling. */
export interface Gradient { pen: PenName; y0: number; y1: number; colours: number[]; lines: number; scroll?: number }
/** Colour cycling: pens[i] shows colours[(i + t/frames) % n]. */
export interface Cycle { pens: PenName[]; colours: number[]; frames: number }
export interface Look {
  base: Partial<Record<PenName, number>>;
  bands?: Band[];
  gradients?: Gradient[];
  cycles?: Cycle[];
}

const FIRE_CYCLE = [col('YELLOW', 7), col('YELLOW', 5), col('ORANGE', 5), col('RED', 5), col('RED', 3), col('MAGENTA', 3), col('ORANGE', 6), WHITE];
const RAINBOW = [col('RED', 5), col('ORANGE', 5), col('YELLOW', 6), col('GREEN', 5), col('CYAN', 5), col('BLUE', 5), col('VIOLET', 5), col('MAGENTA', 5)];

const COMMON: Look = {
  base: {
    BLACK,
    WHITE,
    HUD1: col('RED', 5),
    HUD2: col('YELLOW', 6),
    PLAYER: col('CYAN', 6),
    PLAYER2: col('AZURE', 4),
    PLAYER3: col('YELLOW', 7),
    SHOT: col('YELLOW', 7),
    BOMB: col('PINK', 6),
    DART: col('GREEN', 7),
    EA1: col('RED', 5), EA2: col('YELLOW', 6), EA3: WHITE,
    EB1: col('CYAN', 5), EB2: col('BLUE', 6), EB3: col('YELLOW', 7),
    EC1: col('MAGENTA', 5), EC2: col('VIOLET', 4), EC3: col('YELLOW', 7),
    FIELD: col('CYAN', 5),
    BEAM: col('RED', 6),
    FLASH: WHITE,
    FACE: col('GREY', 5),
  },
  gradients: [
    // The starfield changes hue slowly down the screen.
    { pen: 'STAR1', y0: 0, y1: 320, colours: [col('BLUE', 2), col('VIOLET', 2), col('MAGENTA', 2), col('INDIGO', 2)], lines: 40, scroll: 0.1 },
    { pen: 'STAR2', y0: 0, y1: 320, colours: [col('AZURE', 4), col('CYAN', 4), col('TEAL', 4), col('BLUE', 4)], lines: 36, scroll: 0.15 },
    { pen: 'STAR3', y0: 0, y1: 320, colours: [WHITE, col('YELLOW', 7), col('PINK', 7), col('CYAN', 7)], lines: 30, scroll: 0.2 },
  ],
  cycles: [{ pens: ['CYC0', 'CYC1', 'CYC2', 'CYC3', 'CYC4', 'CYC5'], colours: FIRE_CYCLE, frames: 3 }],
};

function extend(over: Look): Look {
  return {
    base: { ...COMMON.base, ...over.base },
    bands: [...(COMMON.bands ?? []), ...(over.bands ?? [])],
    gradients: [...(COMMON.gradients ?? []), ...(over.gradients ?? [])],
    cycles: over.cycles ?? COMMON.cycles,
  };
}

export const LOOKS = {
  attract: extend({
    base: { FACE: col('GREY', 4), EC1: col('RED', 6) },
    gradients: [
      // The title logo: per-scanline rainbow that rolls downward.
      { pen: 'HUD2', y0: 0, y1: 320, colours: RAINBOW, lines: 2, scroll: 0.5 },
    ],
  }),
  card: extend({
    base: {},
    gradients: [{ pen: 'HUD2', y0: 0, y1: 320, colours: [col('YELLOW', 7), col('ORANGE', 6), col('YELLOW', 6), col('AMBER', 6)], lines: 1, scroll: 0.25 }],
  }),
  shieldWall: extend({
    base: { EB1: col('CYAN', 6), EB2: col('GREEN', 5) },
    bands: [
      // The marching block changes colour by height, cabinet style.
      { y0: 0, y1: 84, pens: { EA1: col('MAGENTA', 5), EA2: col('PINK', 7) } },
      { y0: 84, y1: 124, pens: { EA1: col('RED', 5), EA2: col('YELLOW', 7) } },
      { y0: 124, y1: 164, pens: { EA1: col('ORANGE', 5), EA2: col('YELLOW', 7) } },
      { y0: 164, y1: 320, pens: { EA1: col('YELLOW', 6), EA2: col('RED', 6) } },
    ],
    gradients: [
      // The force field shimmers line by line.
      { pen: 'FIELD', y0: 200, y1: 310, colours: [col('CYAN', 6), col('AZURE', 5), col('BLUE', 5), col('CYAN', 7), col('TEAL', 5)], lines: 1, scroll: 0.6 },
    ],
  }),
  laserAttack: extend({
    base: { EC1: col('GREEN', 5), EC2: col('LIME', 6), EC3: col('RED', 6), EB1: col('ORANGE', 6), EB2: col('YELLOW', 7) },
    gradients: [
      { pen: 'BEAM', y0: 0, y1: 320, colours: [col('RED', 6), col('PINK', 7), col('RED', 7), WHITE], lines: 2, scroll: 2 },
    ],
  }),
  swarm: extend({
    base: { EA1: col('GREEN', 6), EA2: col('YELLOW', 7), EB1: col('RED', 6), EB2: col('ORANGE', 6) },
    bands: [
      { y0: 0, y1: 110, pens: { EA1: col('LIME', 6) } },
      { y0: 110, y1: 200, pens: { EA1: col('GREEN', 5) } },
      { y0: 200, y1: 320, pens: { EA1: col('TEAL', 6) } },
    ],
  }),
  spaceWarp: extend({
    base: { EA1: col('YELLOW', 7), EA2: col('MAGENTA', 6) },
    cycles: [
      { pens: ['CYC0', 'CYC1', 'CYC2', 'CYC3', 'CYC4', 'CYC5'], colours: [col('VIOLET', 5), col('MAGENTA', 5), col('PINK', 6), col('BLUE', 5), col('INDIGO', 4), col('CYAN', 5), col('AZURE', 4), col('VIOLET', 3)], frames: 3 },
    ],
  }),
  flagship: extend({
    base: { EC1: col('MAGENTA', 4), EC2: col('BLUE', 5), EC3: col('CYAN', 7), EB1: col('YELLOW', 6), EB2: col('RED', 5) },
    gradients: [
      // Hull blocks banded per row so the channel you dig reads clearly.
      { pen: 'FIELD', y0: 0, y1: 320, colours: [col('ORANGE', 5), col('RED', 5), col('ORANGE', 6)], lines: 3 },
    ],
  }),
} satisfies Record<string, Look>;

export type LookName = keyof typeof LOOKS;
