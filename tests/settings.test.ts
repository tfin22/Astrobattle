import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../src/platform/storage';

/** A tiny in-memory localStorage for these tests. */
function fakeStorage() {
  const m = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    length: 0,
  } as Storage;
  return m;
}

describe('settings', () => {
  afterEach(() => {
    delete (globalThis as unknown as { localStorage?: Storage }).localStorage;
  });

  it('orientation defaults to portrait, as the spec asks', () => {
    expect(DEFAULT_SETTINGS.orientation).toBe('portrait');
    expect(loadSettings().orientation).toBe('portrait');
  });

  it('remembers landscape', () => {
    fakeStorage();
    saveSettings({ ...DEFAULT_SETTINGS, orientation: 'landscape' });
    expect(loadSettings().orientation).toBe('landscape');
  });

  it('a damaged saved value falls back to safe defaults', () => {
    const m = fakeStorage();
    m.set('qc.settings', JSON.stringify({ v: 1, data: { orientation: 'sideways', difficulty: 'nightmare' } }));
    const s = loadSettings();
    expect(s.orientation).toBe('portrait');
    expect(s.difficulty).toBe('normal');
  });

  it('settings saved before these options existed still load', () => {
    const m = fakeStorage();
    m.set('qc.settings', JSON.stringify({ v: 1, data: { volume: 0.3 } }));
    const s = loadSettings();
    expect(s.volume).toBe(0.3);
    expect(s.orientation).toBe('portrait');
    expect(s.sharpScreen).toBe(false);
  });
});
