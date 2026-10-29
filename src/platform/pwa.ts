/**
 * Offline support. The service worker only exists when the game is served
 * over http(s) next to sw.js; opened as a single local file it simply
 * runs without one (it's already offline).
 */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      /* no sw.js alongside: fine */
    });
  });
}
