import { App } from './app';
import { Bot } from './game/ai';
import { registerServiceWorker } from './platform/pwa';

const canvas = document.getElementById('screen') as HTMLCanvasElement;
const app = new App(canvas);
app.start();
registerServiceWorker();

/**
 * Debug hook for headless checks and screenshots: reach any state quickly.
 * Not used by the game itself.
 */
const hook = {
  app,
  /** Start a game at a mission (0-4) and level (0 = Cadet). */
  start(mission = 0, level = 0, mode: 'arcade' | 'practice' | 'free' = 'arcade') {
    app.startGame(mode, mission, level);
    return app.game!.opts.seed;
  },
  /** Run the current game for n frames with the AI pilot at the stick. */
  autoplay(n: number, invincible = true) {
    const g = app.game;
    if (!g) return 'no game';
    g.invincible = invincible;
    const bot = new Bot('patient');
    for (let i = 0; i < n && g.phase !== 'done'; i++) g.step(bot.think(g));
    return { phase: g.phase, mission: g.missionIndex, score: g.score, enemies: g.enemies.length };
  },
  /** Advance the game n frames with no input. */
  idle(n: number) {
    const g = app.game;
    if (!g) return 'no game';
    for (let i = 0; i < n; i++) g.step({ mx: 0, my: 0, fire: false, fireHeld: false });
    return g.phase;
  },
  screen(s: string) {
    app.setScreen(s as never);
  },
};
(window as unknown as { __qc: typeof hook }).__qc = hook;
