import { describe, expect, it } from 'vitest';
import { STORY } from '../src/content/story';
import { textWidth, FB_W } from '../src/render/framebuffer';

describe('playtest 1: the opening scroll', () => {
  it('has an original story that ends on the rank ladder and fits the screen', () => {
    expect(STORY.length).toBeGreaterThan(15);
    const text = STORY.map(([t]) => t).join(' ');
    expect(text).toContain('VORG');
    expect(text).toContain('QUANTUM ADMIRAL');
    expect(text).not.toMatch(/GORF/);
    for (const [t] of STORY) expect(textWidth(t), t).toBeLessThanOrEqual(FB_W - 4);
  });
});
