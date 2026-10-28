import { RANKS } from './ranks';
import { GAME_TITLE } from './text';

/**
 * The attract-mode scroll, shown after the title. Original text.
 * Each line: [text, style]. '' is a blank line. Max 25 characters a line.
 */
export type StoryStyle = 'body' | 'head' | 'rank';

export const STORY: [string, StoryStyle][] = [
  ['A HIDDEN TREASURE', 'head'],
  ['', 'body'],
  ['LOST FOR DECADES,', 'body'],
  ['AN ARCADE CABINET', 'body'],
  ['WAS REDISCOVERED', 'body'],
  ['IN 2026.', 'body'],
  ['', 'body'],
  [`ITS NAME: ${GAME_TITLE}.`, 'head'],
  ['', 'body'],
  ['THE MOMENT IT WAS', 'body'],
  ['SWITCHED ON, THE ONE', 'body'],
  ['WHO FOUND IT WAS', 'body'],
  ['CATAPULTED INTO', 'body'],
  ['ITS WORLD.', 'body'],
  ['', 'body'],
  ['THAT ONE IS YOU.', 'head'],
  ['', 'body'],
  ['INSIDE, THE VAST ORBITAL', 'body'],
  ['ROBOT GARRISON', 'body'],
  ['RULES THE SKY.', 'body'],
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
  ['THE ONLY WAY OUT', 'head'],
  ['IS THROUGH VORG.', 'head'],
];

/** Pixels per frame the scroll climbs, and the gap between lines. */
export const STORY_SPEED = 0.65;
export const STORY_LINE = 12;
