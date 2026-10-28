import { FB_W, FB_H, Framebuffer, wrapText } from './render/framebuffer';
import { Display } from './render/display';
import { InputManager, type AppInput } from './platform/input';
import { FixedLoop } from './core/loop';
import { buildLineMap } from './render/colours';
import { LOOKS, type Look } from './content/looks';
import { PEN } from './palette';
import { Game } from './game/game';
import { Bot } from './game/ai';
import { Vorg, type SpokenLine } from './game/vorg';
import { Rng } from './core/rng';
import { TUNING } from './tuning';
import { MISSIONS } from './content/missions';
import { RANKS, rankLabel, rankIndex } from './content/ranks';
import { ENEMY_TYPES } from './content/enemies';
import { SCORING } from './content/scoring';
import {
  Starfield, drawGame, drawVorgFace, drawSubtitle, mouthFor, pad, drawEnemy,
} from './render/gameView';
import {
  loadSettings, saveSettings, loadScores, saveScores, loadProgress, saveProgress, resetAll,
  insertScore, scoreRank, defaultScores, type Settings, type ScoreEntry, type Progress,
} from './platform/storage';
import { AudioEngine } from './audio/engine';
import { goFullscreen, haptic, isFullscreen, keepAwake } from './platform/device';
import type { GameEvent, GameMode } from './game/types';
import type { Enemy } from './game/types';
import { DebugOverlay } from './debug/overlay';

export type Screen = 'attract' | 'menu' | 'game' | 'continue' | 'initials' | 'settings' | 'practice' | 'howto';
type AttractPage = 'title' | 'vorg' | 'scores' | 'demo' | 'table';

const ATTRACT: { page: AttractPage; frames: number }[] = [
  { page: 'title', frames: 420 },
  { page: 'vorg', frames: 360 },
  { page: 'scores', frames: 420 },
  { page: 'demo', frames: 480 * 5 },
  { page: 'table', frames: 480 },
];
const DEMO_SEED = 19810101;
const DEMO_SEGMENT = 480;
const INITIAL_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ.-!* ';

interface MenuItem { label: string; action: () => void; value?: () => string; left?: () => void; right?: () => void }

export class App {
  readonly fb = new Framebuffer();
  readonly display: Display;
  readonly input: InputManager;
  readonly loop: FixedLoop;
  readonly stars = new Starfield();
  readonly audio = new AudioEngine();
  readonly debug: DebugOverlay;
  settings: Settings;
  scores: ScoreEntry[];
  progress: Progress;
  screen: Screen = 'attract';
  frame = 0;
  screenT = 0;
  game: Game | null = null;
  paused = false;
  pauseSel = 0;
  /** VORG outside a game: attract, coin up, high score. */
  readonly appVorg: Vorg;
  private attractIdx = 0;
  private demo: Game | null = null;
  private demoBot = new Bot('patient');
  private menuSel = 0;
  private settingsSel = 0;
  private confirmReset = false;
  private practice = { mission: 0, level: 0, sel: 0 };
  private initials = { chars: [0, 0, 0], pos: 0, entry: null as ScoreEntry | null, place: -1 };
  private continueT = 0;
  private lastLook: Look = LOOKS.attract;

  constructor(canvas: HTMLCanvasElement) {
    this.display = new Display(canvas);
    this.input = new InputManager(canvas);
    this.settings = loadSettings();
    this.scores = loadScores();
    this.progress = loadProgress();
    this.appVorg = new Vorg(new Rng((Date.now() ^ 0x5eed) >>> 0), (_t, line) => this.onSay(line));
    this.debug = new DebugOverlay(this);
    this.display.touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.applySettings();
    this.onResize();
    window.addEventListener('resize', () => this.onResize());
    this.input.onGesture = () => this.onGesture();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        if (this.screen === 'game') this.paused = true;
        this.audio.suspend();
      } else {
        this.audio.resume();
      }
    });
    this.loop = new FixedLoop({ step: () => this.step(), render: () => this.render() });
    this.enterAttract(0);
  }

  start(): void {
    this.loop.start();
  }

  private onResize(): void {
    if (this.input.touchSeen) this.display.touch = true;
    this.display.resize();
    this.input.layout = this.display.layout;
  }

  private onGesture(): void {
    this.audio.unlock();
    if (this.input.touchSeen && !this.display.touch) this.onResize();
    if ((this.screen === 'attract' || this.screen === 'menu') && this.input.touchSeen && !isFullscreen()) {
      void goFullscreen().then(() => this.onResize());
    }
  }

  applySettings(): void {
    this.display.crt = this.settings.crt;
    this.display.bezel = this.settings.bezel;
    this.input.dpadMode = this.settings.dpad;
    this.audio.apply(this.settings.sound, this.settings.volume);
  }

  // -------------------------------------------------------------------
  // Events out of the simulation

  private onSay(line: SpokenLine): void {
    this.audio.say(line.ph);
  }

  private dispatch(events: GameEvent[], quiet = false): void {
    for (const e of events) {
      switch (e.t) {
        case 'sfx':
          if (!quiet) this.audio.sfx(e.id, e.dur);
          break;
        case 'sfxStop':
          this.audio.stop(e.id);
          break;
        case 'say':
          if (!quiet) this.audio.say(e.ph);
          break;
        case 'pulse':
          if (!quiet) this.audio.pulse(e.beat);
          break;
        case 'haptic':
          if (!quiet) haptic(e.id, this.settings.haptics);
          break;
        default:
          break;
      }
    }
  }

  // -------------------------------------------------------------------
  // Step

  private step(): void {
    const inp = this.input.sample();
    this.frame++;
    this.screenT++;
    this.appVorg.update(this.frame);
    this.stars.update(this.screen === 'game' && this.game?.phase === 'boom' ? 4 : 1);
    if (inp.debug) this.debug.toggle();
    if (this.debug.frozen) return;
    switch (this.screen) {
      case 'attract':
        this.stepAttract(inp);
        break;
      case 'menu':
        this.stepMenu(inp);
        break;
      case 'game':
        this.stepGame(inp);
        break;
      case 'continue':
        this.stepContinue(inp);
        break;
      case 'initials':
        this.stepInitials(inp);
        break;
      case 'settings':
        this.stepSettings(inp);
        break;
      case 'practice':
        this.stepPractice(inp);
        break;
      case 'howto':
        if (this.screenT > 20 && (inp.fire || inp.taps.length || inp.back || inp.start)) this.setScreen('menu');
        break;
    }
    void keepAwake(this.screen === 'game' && !this.paused);
  }

  setScreen(s: Screen): void {
    this.screen = s;
    this.screenT = 0;
  }

  // ---- Attract ----------------------------------------------------------

  private enterAttract(idx: number): void {
    this.setScreen('attract');
    this.attractIdx = idx % ATTRACT.length;
    this.demo = null;
    if (ATTRACT[this.attractIdx].page === 'vorg') this.appVorg.trigger('attract', this.frame, 0);
  }

  get attractPage(): AttractPage {
    return ATTRACT[this.attractIdx].page;
  }

  private stepAttract(inp: AppInput): void {
    if (inp.coin || inp.taps.length || inp.fire || inp.start) {
      this.insertCoin();
      if (inp.start) this.startGame('arcade');
      return;
    }
    const page = this.attractPage;
    if (page === 'demo') {
      const seg = Math.floor(this.screenT / DEMO_SEGMENT);
      if (!this.demo || this.demo.missionIndex !== seg % 5 || this.screenT % DEMO_SEGMENT === 0) {
        this.demo = new Game({ seed: DEMO_SEED + seg, mode: 'demo', startShips: 1, holdToFire: false, mission: seg % 5, level: 0, skipCard: true, single: true });
        this.demo.invincible = true;
        this.demoBot = new Bot('patient');
      }
      this.demo.step(this.demoBot.think(this.demo));
    }
    if (this.screenT >= ATTRACT[this.attractIdx].frames) this.enterAttract(this.attractIdx + 1);
  }

  insertCoin(): void {
    this.audio.unlock();
    this.audio.sfx('coin');
    this.appVorg.trigger('coin', this.frame, 0);
    this.menuSel = 0;
    this.setScreen('menu');
  }

  // ---- Menu -----------------------------------------------------------------

  private menuItems(): MenuItem[] {
    return [
      { label: 'START', action: () => this.startGame('arcade') },
      { label: 'FREE PLAY', action: () => this.startGame('free') },
      { label: 'PRACTICE', action: () => { this.practice.sel = 0; this.setScreen('practice'); } },
      { label: 'HOW TO PLAY', action: () => this.setScreen('howto') },
      { label: 'SETTINGS', action: () => { this.settingsSel = 0; this.confirmReset = false; this.setScreen('settings'); } },
    ];
  }

  private stepMenu(inp: AppInput): void {
    const items = this.menuItems();
    if (inp.start) return this.startGame('arcade');
    if (inp.back) return this.enterAttract(0);
    this.navigate(inp, items, 'menuSel', 150);
    if (this.screenT > 900) this.enterAttract(0);
  }

  /** Shared list navigation: stick/keys move, FIRE picks, taps pick directly. */
  private navigate(inp: AppInput, items: MenuItem[], key: 'menuSel' | 'settingsSel', top: number, rowH = 16): void {
    let sel = this[key];
    if (inp.up) sel = (sel + items.length - 1) % items.length;
    if (inp.down) sel = (sel + 1) % items.length;
    this[key] = sel;
    if (inp.left) items[sel].left?.();
    if (inp.right) items[sel].right?.();
    if (inp.fire && this.screenT > 8) {
      this.audio.sfx('tick');
      items[sel].action();
      return;
    }
    for (const t of inp.taps) {
      const i = Math.floor((t.y - top + 4) / rowH);
      if (i >= 0 && i < items.length && t.x > 8 && t.x < FB_W - 8) {
        this[key] = i;
        this.audio.sfx('tick');
        const it = items[i];
        if (it.right && t.x > FB_W * 0.62) it.right();
        else if (it.left && t.x < FB_W * 0.38) it.left();
        else it.action();
        return;
      }
    }
  }

  // ---- Game ------------------------------------------------------------------

  startGame(mode: GameMode, mission = 0, level = 0): void {
    this.audio.unlock();
    this.game = new Game({
      seed: (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0,
      mode,
      startShips: this.settings.startShips,
      holdToFire: this.settings.holdToFire,
      mission,
      level,
      single: mode === 'practice',
    });
    this.dispatch(this.game.events);
    this.paused = false;
    this.setScreen('game');
  }

  private stepGame(inp: AppInput): void {
    const g = this.game;
    if (!g) return this.enterAttract(0);
    const pauseTap = inp.taps.some((t) => t.x > 184 && t.y < TUNING.hudTop);
    if (this.paused) {
      this.stepPause(inp);
      return;
    }
    if (inp.pause || pauseTap) {
      this.paused = true;
      this.pauseSel = 0;
      this.audio.stopSpeech();
      return;
    }
    g.step(inp);
    this.dispatch(g.events);
    this.audio.setLoop('warp', g.phase === 'play' && g.mission.id === 'spaceWarp');
    if (g.level > this.progress.bestLevel && g.opts.mode !== 'practice') {
      this.progress.bestLevel = g.level;
      saveProgress(this.progress);
    }
    if (g.phase === 'done') this.gameFinished(g);
  }

  private stepPause(inp: AppInput): void {
    if (inp.up || inp.down) this.pauseSel ^= 1;
    const resume = () => { this.paused = false; };
    const quit = () => {
      this.paused = false;
      this.game = null;
      this.audio.setLoop('warp', false);
      this.enterAttract(0);
    };
    if (inp.pause) return resume();
    if (inp.fire) return this.pauseSel === 0 ? resume() : quit();
    for (const t of inp.taps) {
      if (t.y > 150 && t.y < 172) return resume();
      if (t.y >= 172 && t.y < 196) return quit();
      if (t.x > 184 && t.y < TUNING.hudTop) return resume();
    }
  }

  private gameFinished(g: Game): void {
    this.audio.setLoop('warp', false);
    if (g.opts.mode === 'practice') {
      this.game = null;
      this.setScreen('practice');
      return;
    }
    if (g.opts.mode === 'free' && g.lives <= 0) {
      this.continueT = 600;
      this.setScreen('continue');
      return;
    }
    this.finishGame(g);
  }

  private finishGame(g: Game): void {
    const eligible = g.opts.mode === 'arcade' || (g.opts.mode === 'free' && !g.continued);
    const place = eligible ? scoreRank(this.scores, g.score) : -1;
    if (place >= 0) {
      this.initials = { chars: [0, 0, 0], pos: 0, entry: { initials: 'AAA', score: g.score, level: g.level }, place };
      this.appVorg.trigger('highScore', this.frame, g.level);
      this.setScreen('initials');
    } else {
      this.game = null;
      this.enterAttract(2);
    }
  }

  private stepContinue(inp: AppInput): void {
    const g = this.game;
    if (!g) return this.enterAttract(0);
    this.continueT--;
    if (this.screenT > 30 && (inp.fire || inp.taps.length || inp.start)) {
      g.continueGame();
      this.dispatch(g.events);
      this.setScreen('game');
      return;
    }
    if (this.continueT <= 0 || inp.back) this.finishGame(g);
  }

  // ---- Initials ---------------------------------------------------------------

  private stepInitials(inp: AppInput): void {
    const s = this.initials;
    const n = INITIAL_CHARS.length;
    if (inp.up) s.chars[s.pos] = (s.chars[s.pos] + 1) % n;
    if (inp.down) s.chars[s.pos] = (s.chars[s.pos] + n - 1) % n;
    if (inp.left && s.pos > 0) s.pos--;
    for (const t of inp.taps) {
      // Tap above a letter = next, below = previous, the letter itself = OK.
      const col = Math.floor((t.x - (FB_W / 2 - 36)) / 24);
      if (col >= 0 && col < 3 && t.y > 120 && t.y < 200) {
        s.pos = col;
        if (t.y < 145) s.chars[col] = (s.chars[col] + 1) % n;
        else if (t.y > 172) s.chars[col] = (s.chars[col] + n - 1) % n;
      }
      if (t.y > 214 && t.y < 236) s.pos = 3;
    }
    if (inp.fire || inp.start) s.pos++;
    if (s.pos >= 3 || this.screenT > 60 * 45) {
      const entry = s.entry!;
      entry.initials = s.chars.map((c) => INITIAL_CHARS[c]).join('');
      this.scores = insertScore(this.scores, entry);
      saveScores(this.scores);
      this.game = null;
      this.enterAttract(2);
    }
  }

  // ---- Settings -----------------------------------------------------------------

  settingsItems(): MenuItem[] {
    const s = this.settings;
    const save = () => { saveSettings(s); this.applySettings(); };
    const toggle = (k: 'holdToFire' | 'dpad' | 'sound' | 'subtitles' | 'crt' | 'bezel' | 'haptics') => () => { s[k] = !s[k]; save(); };
    const onoff = (v: boolean) => (v ? 'ON' : 'OFF');
    return [
      { label: 'SHIPS', value: () => String(s.startShips), action: () => { s.startShips = s.startShips >= 5 ? 3 : s.startShips + 1; save(); },
        left: () => { s.startShips = Math.max(3, s.startShips - 1); save(); }, right: () => { s.startShips = Math.min(5, s.startShips + 1); save(); } },
      { label: 'HOLD TO FIRE', value: () => onoff(s.holdToFire), action: toggle('holdToFire'), left: toggle('holdToFire'), right: toggle('holdToFire') },
      { label: 'CONTROLS', value: () => (s.dpad ? 'DPAD' : 'STICK'), action: toggle('dpad'), left: toggle('dpad'), right: toggle('dpad') },
      { label: 'SOUND', value: () => onoff(s.sound), action: toggle('sound'), left: toggle('sound'), right: toggle('sound') },
      { label: 'VOLUME', value: () => String(Math.round(s.volume * 10)), action: () => { s.volume = s.volume >= 1 ? 0.1 : Math.min(1, s.volume + 0.1); save(); },
        left: () => { s.volume = Math.max(0, s.volume - 0.1); save(); }, right: () => { s.volume = Math.min(1, s.volume + 0.1); save(); } },
      { label: 'SUBTITLES', value: () => onoff(s.subtitles), action: toggle('subtitles'), left: toggle('subtitles'), right: toggle('subtitles') },
      { label: 'CRT MODE', value: () => onoff(s.crt), action: toggle('crt'), left: toggle('crt'), right: toggle('crt') },
      { label: 'BEZEL', value: () => onoff(s.bezel), action: toggle('bezel'), left: toggle('bezel'), right: toggle('bezel') },
      { label: 'HAPTICS', value: () => onoff(s.haptics), action: toggle('haptics'), left: toggle('haptics'), right: toggle('haptics') },
      { label: this.confirmReset ? 'SURE? TAP AGAIN' : 'RESET SCORES', action: () => {
        if (!this.confirmReset) { this.confirmReset = true; return; }
        resetAll();
        this.scores = defaultScores();
        this.progress = { bestLevel: 0 };
        this.settings = loadSettings();
        this.applySettings();
        this.confirmReset = false;
      } },
      { label: 'BACK', action: () => this.setScreen('menu') },
    ];
  }

  private stepSettings(inp: AppInput): void {
    if (inp.back) return this.setScreen('menu');
    const before = this.settingsSel;
    this.navigate(inp, this.settingsItems(), 'settingsSel', 40);
    if (this.settingsSel !== before && this.settingsSel !== 9) this.confirmReset = false;
  }

  // ---- Practice ---------------------------------------------------------------

  private stepPractice(inp: AppInput): void {
    const p = this.practice;
    const maxLevel = Math.min(this.progress.bestLevel, RANKS.length - 1);
    if (inp.back) return this.setScreen('menu');
    if (inp.up) p.sel = (p.sel + 3) % 4;
    if (inp.down) p.sel = (p.sel + 1) % 4;
    const change = (d: number) => {
      if (p.sel === 0) p.mission = (p.mission + 5 + d) % 5;
      if (p.sel === 1) p.level = Math.max(0, Math.min(maxLevel, p.level + d));
    };
    if (inp.left) change(-1);
    if (inp.right) change(1);
    const act = () => {
      if (p.sel === 2) this.startGame('practice', p.mission, p.level);
      else if (p.sel === 3) this.setScreen('menu');
      else change(1);
    };
    if (inp.fire && this.screenT > 8) act();
    for (const t of inp.taps) {
      const i = Math.floor((t.y - 84) / 32);
      if (i >= 0 && i < 4) {
        p.sel = i;
        if (i < 2 && t.x < FB_W * 0.3) change(-1);
        else act();
      }
    }
  }

  // -------------------------------------------------------------------
  // Render

  render(): void {
    const fb = this.fb;
    let look: Look = LOOKS.attract;
    let ov = {};
    switch (this.screen) {
      case 'attract':
        look = this.drawAttract();
        break;
      case 'menu':
        this.drawMenu();
        break;
      case 'game':
      case 'continue': {
        const g = this.game!;
        const r = drawGame(fb, g, this.stars, this.frame, { hiScore: this.scores[0]?.score ?? 0, showPause: true }, this.settings.subtitles);
        look = r.look;
        ov = r.ov;
        if (this.paused) this.drawPause();
        if (this.screen === 'continue') this.drawContinue();
        break;
      }
      case 'initials':
        this.drawInitials();
        break;
      case 'settings':
        this.drawSettings();
        break;
      case 'practice':
        this.drawPractice();
        break;
      case 'howto':
        this.drawHowTo();
        break;
    }
    const showAppLine = this.screen === 'menu' || (this.screen === 'attract' && this.attractPage !== 'vorg' && this.attractPage !== 'demo');
    if (this.settings.subtitles && showAppLine && this.appVorg.current) {
      drawSubtitle(fb, this.appVorg.current.text, FB_H - 30);
    }
    this.lastLook = look;
    buildLineMap(fb.lineMap, look, this.frame, ov);
    this.debug.drawInFramebuffer(fb);
    this.display.present(fb, this.input, true);
    this.debug.drawOnScreen(this.display);
  }

  get look(): Look {
    return this.lastLook;
  }

  private header(): void {
    const fb = this.fb;
    fb.text('HI', 4, 3, PEN.HUD1, 'small');
    fb.text(pad(this.scores[0]?.score ?? 0), 14, 2, PEN.WHITE);
    fb.text('CREDITS: ~', FB_W - 4 - 46, 3, PEN.HUD1, 'small');
  }

  private drawLogo(y: number): void {
    this.fb.textCentered('QUANTUM', FB_W / 2, y, PEN.HUD2, 'big', 3);
    this.fb.textCentered('CADET', FB_W / 2, y + 28, PEN.HUD2, 'big', 4);
  }

  private drawAttract(): Look {
    const fb = this.fb;
    fb.clear(PEN.BLACK);
    this.stars.draw(fb, this.frame);
    const page = this.attractPage;
    const blink = (this.frame >> 5) & 1;
    if (page === 'demo' && this.demo) {
      const r = drawGame(fb, this.demo, this.stars, this.frame, { hiScore: this.scores[0]?.score ?? 0, showPause: false }, false);
      fb.rect(56, 150, 92, 14, PEN.BLACK);
      fb.textCentered('DEMO', FB_W / 2, 154, PEN.HUD1);
      if (blink) fb.textCentered('INSERT COIN', FB_W / 2, 200, PEN.WHITE);
      return r.look;
    }
    this.header();
    switch (page) {
      case 'title': {
        this.drawLogo(64);
        fb.textCentered('AN ARCADE HOMAGE', FB_W / 2, 140, PEN.HUD1, 'small');
        drawVorgFace(fb, FB_W / 2, 190, 0, 1);
        if (blink) fb.textCentered(this.display.touch ? 'TAP TO INSERT COIN' : 'INSERT COIN', FB_W / 2, 236, PEN.WHITE);
        fb.textCentered('VORG IS WATCHING', FB_W / 2, 290, PEN.STAR2, 'small');
        break;
      }
      case 'vorg': {
        const cur = this.appVorg.current;
        const mouth = cur ? mouthFor(cur.ph, this.frame - cur.start) : 0;
        fb.textCentered('VORG', FB_W / 2, 36, PEN.HUD1, 'big', 2);
        fb.textCentered('VAST ORBITAL ROBOT GARRISON', FB_W / 2, 56, PEN.HUD2, 'small');
        drawVorgFace(fb, FB_W / 2, 142, mouth, 4);
        const text = cur?.text ?? this.appVorg.log[this.appVorg.log.length - 1]?.text ?? '';
        wrapText(text, FB_W - 16).forEach((l, i) => fb.textCentered(l, FB_W / 2, 214 + i * 11, PEN.WHITE));
        if (blink) fb.textCentered('INSERT COIN', FB_W / 2, 270, PEN.HUD2);
        break;
      }
      case 'scores':
        this.drawScoreTable(40);
        if (blink) fb.textCentered('INSERT COIN', FB_W / 2, 290, PEN.WHITE);
        break;
      case 'table':
        this.drawScoringTable();
        break;
      default:
        break;
    }
    return LOOKS.attract;
  }

  private drawScoreTable(y: number): void {
    const fb = this.fb;
    fb.textCentered('HIGH SCORES', FB_W / 2, y, PEN.HUD2, 'big', 2);
    this.scores.forEach((s, i) => {
      const yy = y + 30 + i * 20;
      const pen = i === 0 ? PEN.HUD2 : PEN.WHITE;
      fb.text(String(i + 1).padStart(2, ' '), 10, yy, PEN.HUD1);
      fb.text(s.initials, 34, yy, pen);
      fb.text(pad(s.score, 7), 70, yy, pen);
      fb.text(rankLabel(s.level, true), 130, yy + 1, PEN.STAR2, 'small');
    });
  }

  private drawScoringTable(): void {
    const fb = this.fb;
    fb.textCentered('SCORE ADVANCE TABLE', FB_W / 2, 30, PEN.HUD2);
    fb.text('FORMATION', 92, 44, PEN.HUD1, 'small');
    fb.text('ATTACKING', 150, 44, PEN.HUD1, 'small');
    const rows: (keyof typeof ENEMY_TYPES)[] = ['drone', 'escort', 'swarmer', 'kamikaze', 'carrier', 'fighter'];
    rows.forEach((t, i) => {
      const y = 62 + i * 26;
      const e = { id: i, type: t, x: 30, y, stage: 0, state: 'formation', flash: 0 } as unknown as Enemy;
      drawEnemy(fb, e, this.frame, (this.frame >> 4) & 1);
      fb.text(ENEMY_TYPES[t].name, 46, y - 3, PEN.WHITE, 'small');
      const sc = SCORING.enemies[t];
      fb.text(String(sc.formation), 100, y - 3, PEN.HUD2, 'small');
      fb.text(String(sc.attacking), 158, y - 3, PEN.HUD2, 'small');
    });
    const wy = 62 + rows.length * 26;
    const w = { id: 9, type: 'warpling', x: 30, y: wy, stage: 1, state: 'emerging', flash: 0 } as unknown as Enemy;
    drawEnemy(fb, w, this.frame);
    fb.text('WARPLING', 46, wy - 3, PEN.WHITE, 'small');
    fb.text('SMALL 200 MID 100 BIG 150', 46, wy + 5, PEN.HUD2, 'small');
    const sy = wy + 26;
    const s = { id: 10, type: 'saucer', x: 30, y: sy, stage: 0, state: 'attacking', flash: 0 } as unknown as Enemy;
    drawEnemy(fb, s, this.frame);
    fb.text('SAUCER', 46, sy - 3, PEN.WHITE, 'small');
    fb.text('MYSTERY', 100, sy - 3, PEN.HUD2, 'small');
    fb.textCentered(`REACTOR ${SCORING.reactor}`, FB_W / 2, sy + 22, PEN.HUD1);
  }

  private drawMenu(): void {
    const fb = this.fb;
    fb.clear(PEN.BLACK);
    this.stars.draw(fb, this.frame);
    this.header();
    this.drawLogo(34);
    if ((this.frame >> 4) & 1) fb.textCentered('PRESS START', FB_W / 2, 118, PEN.WHITE);
    this.menuItems().forEach((it, i) => {
      const y = 150 + i * 16;
      const sel = i === this.menuSel;
      if (sel) fb.text('>', 30, y, PEN.HUD1);
      fb.textCentered(it.label, FB_W / 2, y, sel ? PEN.HUD2 : PEN.WHITE);
    });
    fb.textCentered('FIRE OR TAP TO CHOOSE', FB_W / 2, 248, PEN.STAR2, 'small');
    const cur = this.appVorg.current;
    drawVorgFace(fb, FB_W / 2, 266, cur ? mouthFor(cur.ph, this.frame - cur.start) : 0, 1);
  }

  private drawPause(): void {
    const fb = this.fb;
    fb.rect(30, 120, FB_W - 60, 84, PEN.BLACK);
    fb.frame(30, 120, FB_W - 60, 84, PEN.HUD1);
    fb.textCentered('PAUSED', FB_W / 2, 130, PEN.HUD2, 'big', 2);
    fb.textCentered((this.pauseSel === 0 ? '> ' : '') + 'RESUME', FB_W / 2, 158, this.pauseSel === 0 ? PEN.HUD2 : PEN.WHITE);
    fb.textCentered((this.pauseSel === 1 ? '> ' : '') + 'QUIT', FB_W / 2, 180, this.pauseSel === 1 ? PEN.HUD2 : PEN.WHITE);
  }

  private drawContinue(): void {
    const fb = this.fb;
    fb.rect(20, 110, FB_W - 40, 80, PEN.BLACK);
    fb.frame(20, 110, FB_W - 40, 80, PEN.HUD1);
    fb.textCentered('CONTINUE?', FB_W / 2, 120, PEN.HUD2, 'big', 2);
    fb.textCentered(String(Math.max(0, Math.ceil(this.continueT / 60))), FB_W / 2, 142, PEN.WHITE, 'big', 2);
    fb.textCentered('FIRE TO CONTINUE', FB_W / 2, 166, PEN.WHITE, 'small');
    fb.textCentered('SCORE RESETS TO ZERO', FB_W / 2, 176, PEN.STAR2, 'small');
  }

  private drawInitials(): void {
    const fb = this.fb;
    const s = this.initials;
    fb.clear(PEN.BLACK);
    this.stars.draw(fb, this.frame);
    fb.textCentered('NEW HIGH SCORE', FB_W / 2, 30, PEN.HUD2, 'big', 1);
    fb.textCentered(pad(s.entry?.score ?? 0), FB_W / 2, 46, PEN.WHITE, 'big', 2);
    fb.textCentered(rankLabel(s.entry?.level ?? 0), FB_W / 2, 74, PEN.HUD1, 'small');
    fb.textCentered('ENTER YOUR INITIALS', FB_W / 2, 100, PEN.WHITE, 'small');
    for (let i = 0; i < 3; i++) {
      const x = FB_W / 2 - 36 + i * 24 + 12;
      const ch = INITIAL_CHARS[s.chars[i]];
      const active = i === s.pos;
      if (active) {
        fb.textCentered('\u25b2', x, 130, PEN.HUD1);
        fb.textCentered('\u25bc', x, 180, PEN.HUD1);
      }
      fb.textCentered(ch === ' ' ? '_' : ch, x, 150, active && (this.frame & 8) ? PEN.HUD2 : PEN.WHITE, 'big', 2);
    }
    fb.textCentered('UP/DOWN: LETTER  FIRE: OK', FB_W / 2, 220, PEN.STAR2, 'small');
    const cur = this.appVorg.current;
    if (cur) wrapText(cur.text, FB_W - 16).forEach((l, i) => fb.textCentered(l, FB_W / 2, 250 + i * 10, PEN.HUD2));
  }

  private drawSettings(): void {
    const fb = this.fb;
    fb.clear(PEN.BLACK);
    fb.textCentered('SETTINGS', FB_W / 2, 16, PEN.HUD2, 'big', 2);
    this.settingsItems().forEach((it, i) => {
      const y = 40 + i * 16;
      const sel = i === this.settingsSel;
      fb.text(it.label, 12, y, sel ? PEN.HUD2 : PEN.WHITE);
      if (it.value) {
        const v = `< ${it.value()} >`;
        fb.text(v, FB_W - 10 - v.length * 8 + 6, y, sel ? PEN.HUD2 : PEN.HUD1);
      }
    });
    fb.textCentered('TAP A SIDE TO CHANGE A VALUE', FB_W / 2, 224, PEN.STAR2, 'small');
  }

  private drawPractice(): void {
    const fb = this.fb;
    const p = this.practice;
    fb.clear(PEN.BLACK);
    this.stars.draw(fb, this.frame);
    fb.textCentered('PRACTICE', FB_W / 2, 30, PEN.HUD2, 'big', 2);
    fb.textCentered('NO SCORE IS SAVED', FB_W / 2, 56, PEN.STAR2, 'small');
    const rows = [
      ['MISSION', `< ${MISSIONS[p.mission].name} >`],
      ['RANK', `< ${RANKS[rankIndex(p.level)].short} >`],
      ['', 'START'],
      ['', 'BACK'],
    ];
    rows.forEach(([a, b], i) => {
      const y = 90 + i * 32;
      const sel = i === p.sel;
      if (a) fb.textCentered(a, FB_W / 2, y - 2, PEN.HUD1, 'small');
      fb.textCentered(b, FB_W / 2, y + 6, sel ? PEN.HUD2 : PEN.WHITE);
    });
    fb.textCentered(`RANKS UNLOCKED: ${Math.min(this.progress.bestLevel, 5) + 1} OF 6`, FB_W / 2, 230, PEN.STAR2, 'small');
  }

  private drawHowTo(): void {
    const fb = this.fb;
    fb.clear(PEN.BLACK);
    // Styled like the instruction card on a control panel.
    fb.frame(6, 8, FB_W - 12, FB_H - 16, PEN.HUD1);
    fb.frame(8, 10, FB_W - 16, FB_H - 20, PEN.HUD2);
    fb.textCentered('HOW TO PLAY', FB_W / 2, 20, PEN.HUD2, 'big', 1);
    const lines: [string, number][] = [
      ['LEFT THUMB: MOVE IN 8 DIRECTIONS', PEN.WHITE],
      ['IN THE ZONE AT THE BOTTOM.', PEN.WHITE],
      ['RIGHT THUMB: FIRE.', PEN.WHITE],
      ['', 0],
      ['THE QUANTUM SHOT', PEN.HUD2],
      ['ONLY ONE SHOT CAN BE ON SCREEN.', PEN.WHITE],
      ['FIRING AGAIN CANCELS IT AND', PEN.WHITE],
      ['LAUNCHES A NEW ONE. AIM, COMMIT,', PEN.WHITE],
      ['OR SNAP A NEW SHOT IF IT WILL MISS.', PEN.WHITE],
      ['TAPPING FAST NEVER PAYS.', PEN.HUD1],
      ['', 0],
      ['FIVE MISSIONS', PEN.HUD2],
      ['1 SHIELD WALL  2 LASER ATTACK', PEN.WHITE],
      ['3 SWARM  4 SPACE WARP  5 FLAGSHIP', PEN.WHITE],
      ['', 0],
      ['DIG THROUGH THE FLAGSHIP HULL AND', PEN.WHITE],
      ['HIT THE REACTOR TO BE PROMOTED.', PEN.WHITE],
      ['EACH RANK IS FASTER.', PEN.WHITE],
      ['', 0],
      ['WATCH FOR THE LASER GLOW. STEP ASIDE.', PEN.WHITE],
      ['HIT ENEMIES WHILE THEY ATTACK', PEN.WHITE],
      ['FOR MORE POINTS.', PEN.WHITE],
      ['', 0],
      ['VORG WILL TALK. IGNORE VORG.', PEN.HUD1],
    ];
    lines.forEach(([t, pen], i) => t && fb.textCentered(t, FB_W / 2, 40 + i * 9, pen, 'small'));
    fb.textCentered(`EXTRA SHIP AT ${TUNING.extraShipFirst}`, FB_W / 2, 262, PEN.HUD2, 'small');
    if ((this.frame >> 5) & 1) fb.textCentered('TAP TO RETURN', FB_W / 2, 290, PEN.WHITE);
  }
}
