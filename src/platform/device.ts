/** Fullscreen, portrait lock, wake lock and haptics, all best-effort. */
export function isFullscreen(): boolean {
  return !!(document.fullscreenElement || (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement);
}

export async function goFullscreen(): Promise<void> {
  if (isFullscreen()) return;
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
  try {
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
  } catch {
    /* refused: carry on windowed */
  }
  try {
    const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    await o.lock?.('portrait');
  } catch {
    /* not supported (e.g. iOS) */
  }
}

type WakeLockSentinelLike = { release(): Promise<void>; released?: boolean };
let wake: WakeLockSentinelLike | null = null;
let wantWake = false;

export async function keepAwake(on: boolean): Promise<void> {
  wantWake = on;
  const nav = navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<WakeLockSentinelLike> } };
  try {
    if (on && !wake && nav.wakeLock && document.visibilityState === 'visible') {
      wake = await nav.wakeLock.request('screen');
    } else if (!on && wake) {
      await wake.release();
      wake = null;
    }
  } catch {
    wake = null;
  }
}

document.addEventListener('visibilitychange', () => {
  // The browser drops the lock when hidden; take it back on return.
  if (document.visibilityState === 'visible' && wantWake) {
    wake = null;
    void keepAwake(true);
  }
});

const PATTERNS: Record<string, number | number[]> = {
  fire: 8,
  tap: 10,
  death: [60, 40, 90],
  boom: [120, 50, 200, 50, 400],
};

export function haptic(id: string, enabled: boolean): void {
  if (!enabled || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(PATTERNS[id] ?? 10);
  } catch {
    /* ignore */
  }
}
