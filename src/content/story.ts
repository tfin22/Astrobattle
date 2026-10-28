import { RANKS } from './ranks';

/**
 * The attract-mode scroll, shown after the title. Original text.
 * Each line: [text, style]. '' is a blank line.
 */
export type StoryStyle = 'body' | 'head' | 'rank';

export const STORY: [string, StoryStyle][] = [
  ['THE VAST ORBITAL', 'body'],
  ['ROBOT GARRISON', 'body'],
  ['HAS PARKED OVER EARTH.', 'body'],
  ['', 'body'],
  ['IT CALLS ITSELF VORG.', 'body'],
  ['IT HAS OPINIONS', 'body'],
  ['ABOUT YOU.', 'body'],
  ['', 'body'],
  ['YOUR ORDERS, CADET:', 'head'],
  ['', 'body'],
  ['BREAK ITS SHIELD WALL.', 'body'],
  ['DODGE ITS LASERS.', 'body'],
  ['OUTFLY ITS SWARM.', 'body'],
  ['SURVIVE ITS SPACE WARP.', 'body'],
  ['DIG TO THE HEART', 'body'],
  ['OF ITS FLAGSHIP.', 'body'],
  ['', 'body'],
  ['EVERY REACTOR YOU DESTROY', 'body'],
  ['EARNS A PROMOTION.', 'body'],
  ['', 'body'],
  ['RANK LADDER', 'head'],
  ...RANKS.map((r) => [r.name, 'rank'] as [string, StoryStyle]),
  ['', 'body'],
  ['ONE SHIP. ONE SHOT.', 'head'],
  ['VORG IS WAITING.', 'head'],
];

/** Pixels per frame the scroll climbs, and the gap between lines. */
export const STORY_SPEED = 0.6;
export const STORY_LINE = 12;
