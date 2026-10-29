/** Fullscreen, orientation lock, wake lock and haptics, all best-effort. */

export type Orientation = 'portrait' | 'landscape';
export function isFullscreen(): boolean {
  return !!(document.fullscreenElement || (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement);
}

export async function goFullscreen(orientation: Orientation = 'portrait'): Promise<void> {
  if (isFullscreen()) return;
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
  try {
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
  } catch {
    /* refused: carry on windowed */
  }
  await lockOrientation(orientation);
}

/**
 * Lock the screen to portrait or landscape. Only some browsers allow it, and
 * usually only in fullscreen (Android Chrome); elsewhere it quietly does
 * nothing and the layout simply follows how the device is held.
 */
export async function lockOrientation(orientation: Orientation): Promise<void> {
  try {
    const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    await o.lock?.(orientation);
  } catch {
    /* not supported here (e.g. iOS, or not fullscreen) */
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
