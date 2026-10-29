import { describe, expect, it } from 'vitest';
import { defaultScores, insertScore, scoreRank, type ScoreEntry } from '../src/platform/storage';

describe('high-score table', () => {
  const table = defaultScores();

  it('starts with AAM on top and KOP END together', () => {
    expect(table[0].initials).toBe('AAM');
    const names = table.map((e) => e.initials).join(' ');
    expect(names).toContain('KOP END');
    expect(names).toContain('LFC');
  });

  it('has ten entries, best first', () => {
    expect(table.length).toBe(10);
    for (let i = 1; i < 10; i++) expect(table[i - 1].score).toBeGreaterThanOrEqual(table[i].score);
  });

  it('finds where a score lands, or -1', () => {
    expect(scoreRank(table, 999999)).toBe(0);
    expect(scoreRank(table, table[4].score + 1)).toBe(4);
    expect(scoreRank(table, 1)).toBe(-1);
    expect(scoreRank(table, 0)).toBe(-1);
    expect(scoreRank([], 50)).toBe(0);
  });

  it('inserts, keeps the top ten and records the rank reached', () => {
    const e: ScoreEntry = { initials: 'QCD', score: table[2].score + 5, level: 4 };
    const out = insertScore(table, e);
    expect(out.length).toBe(10);
    expect(out[2]).toEqual(e);
    expect(out[3]).toEqual(table[2]);
    expect(out).not.toContainEqual(table[9]);
  });

  it('ties go below the existing entry', () => {
    const out = insertScore(table, { initials: 'TIE', score: table[0].score, level: 0 });
    expect(out[0]).toEqual(table[0]);
    expect(out[1].initials).toBe('TIE');
  });

  it('ignores scores that miss the table', () => {
    expect(insertScore(table, { initials: 'LOW', score: 1, level: 0 })).toEqual(table);
  });
});
