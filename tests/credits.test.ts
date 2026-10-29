import { describe, expect, it } from 'vitest';
import { CREDITS } from '../src/content/credits';
import { STORY } from '../src/content/story';
import { textWidth, FB_W } from '../src/render/framebuffer';

describe('credits roll', () => {
  const text = CREDITS.map(([t]) => t).join(' ');

  it('honours the original game and the people who made it', () => {
    expect(text).toContain('GORF');
    expect(text).toContain('1981');
    expect(text).toContain('JAMIE FENTON');
    expect(text).toContain('DAVE NUTTING ASSOCIATES');
    expect(text).toContain('MIDWAY');
    expect(text).toContain('VOTRAX');
    // Plain about what is (and isn't) borrowed.
    expect(text).toMatch(/NOTHING HERE IS COPIED/);
    expect(text).toMatch(/NOT AFFILIATED/);
  });

  it('credits Claude Code and outlines the tech', () => {
    expect(text).toContain('CLAUDE CODE');
    expect(text).toContain('TYPESCRIPT');
    expect(text).toContain('CANVAS');
    expect(text).toContain('204 X 320');
  });

  it('fits the screen, line by line', () => {
    expect(CREDITS.length).toBeGreaterThan(40);
    for (const [t] of CREDITS) expect(textWidth(t), t).toBeLessThanOrEqual(FB_W - 4);
  });

  it('keeps the original name out of the story itself', () => {
    expect(STORY.map(([t]) => t).join(' ')).not.toMatch(/GORF/);
  });
});
