import { Rng } from '../core/rng';
import { clamp, fatan2, fcos, fsin, lerp } from '../core/fmath';
import { TUNING } from '../tuning';
import { FB_W, FB_H } from '../render/framebuffer';
import { ENEMY_TYPES, type EnemyTypeName } from '../content/enemies';
import { SCORING } from '../content/scoring';
import { GAME_TEXT } from '../content/text';
import { MISSIONS } from '../content/missions';
import { PEN, col } from '../palette';
import { rankParams, type RankParams } from './rankParams';
import { createMission } from './missions';
import type { Mission } from './mission';
import { Vorg } from './vorg';
import type {
  Bullet, BulletType, Difficulty, Enemy, EnemyState, FrameInput, GameEvent, GameOptions, Particle, Phase, SfxId, Shot,
} from './types';

export const PLAYER_START = { x: FB_W / 2, y: 290 };

export interface GameStats {
  shotsFired: number;
  cancels: number;
  hits: number;
  missStreak: number;
  kills: number;
  deaths: number;
  /** Closest any enemy has ever spawned to the player (fairness check). */
  minSpawnDist: number;
}

/**
 * One game, from the first mission card to game over. Pure logic: no
 * drawing, no audio, no DOM. Advance it with step(input); read `events`
 * after each step for sounds, speech and haptics.
 */
export class Game {
  readonly opts: GameOptions;
  readonly rng: Rng;
  /** Cosmetic randomness (particles) kept apart from gameplay randomness. */
  readonly fx: Rng;
  readonly vorg: Vorg;
  frame = 0;
  phase: Phase = 'card';
  phaseT = 0;
  level: number;
  missionIndex: number;
  mission!: Mission;
  rp!: RankParams;
  score = 0;
  lives: number;
  nextExtra: number = TUNING.extraShipFirst;
  continued = false;
  player = { x: PLAYER_START.x, y: PLAYER_START.y, alive: true, invuln: 0, vx: 0, vy: 0 };
  shot: Shot = { x: 0, y: 0, alive: false };
  enemies: Enemy[] = [];
  bullets: Bullet[] = [];
  particles: Particle[] = [];
  events: GameEvent[] = [];
  stats: GameStats = { shotsFired: 0, cancels: 0, hits: 0, missStreak: 0, kills: 0, deaths: 0, minSpawnDist: Infinity };
  /** Frames left of a full-screen flash, and its colour. */
  flash = 0;
  flashColour = 0;
  /** Thinning multipliers for this frame (see tuning.thinning). */
  urgeSpeed = 1;
  urgeFire = 1;
  /** Enemy speed multiplier this frame: rank x difficulty x thinning, capped. */
  pace = 1;
  /** Debug: the player can't die. */
  invincible = false;
  /** Flagship explosion centre. */
  boom = { x: 0, y: 0 };
  private nextId = 1;
  private pulseT = 0;
  private beat = 0;
  private lastPulse = -1000;
  private saucerT: number = TUNING.saucerEvery;
  private nearMissCooldown = 0;

  constructor(opts: GameOptions) {
    this.opts = opts;
    this.rng = new Rng(opts.seed);
    this.fx = Rng.derive(opts.seed, 77);
    this.vorg = new Vorg(Rng.derive(opts.seed, 99), (trigger, l) =>
      this.events.push({ t: 'say', trigger, text: l.text, ph: l.ph, frames: l.frames }),
    );
    this.level = opts.level ?? 0;
    this.missionIndex = opts.mission ?? 0;
    this.lives = opts.startShips;
    if (opts.mode !== 'demo' && !opts.single) this.say('gameStart');
    this.startMission();
  }

  // ---------------------------------------------------------------------
  // Flow

  get difficulty(): Difficulty {
    return this.opts.difficulty ?? 'normal';
  }

  get missionDef() {
    return MISSIONS[this.missionIndex];
  }

  startMission(): void {
    this.rp = rankParams(this.level, this.difficulty);
    this.enemies = [];
    this.bullets = [];
    this.shot.alive = false;
    this.player.x = PLAYER_START.x;
    this.player.y = PLAYER_START.y;
    this.player.alive = true;
    this.player.invuln = 0;
    this.saucerT = TUNING.saucerEvery + this.rng.int(400);
    this.mission = createMission(this.missionDef.id);
    this.mission.init(this);
    this.setPhase(this.opts.skipCard ? 'play' : 'card');
    if (this.opts.mode !== 'demo') this.say(this.missionDef.intro);
  }

  setPhase(p: Phase): void {
    this.phase = p;
    this.phaseT = 0;
  }

  say(trigger: string): void {
    this.vorg.trigger(trigger, this.frame, this.level);
  }

  sfx(id: SfxId, dur?: number): void {
    this.events.push(dur === undefined ? { t: 'sfx', id } : { t: 'sfx', id, dur });
  }

  /** Free play: continue from the start of the current mission, score reset. */
  continueGame(): void {
    this.score = 0;
    this.continued = true;
    this.lives = this.opts.startShips;
    this.nextExtra = TUNING.extraShipFirst;
    this.startMission();
  }

  // ---------------------------------------------------------------------
  // The step

  step(input: FrameInput): void {
    this.events = [];
    this.frame++;
    this.phaseT++;
    this.vorg.update(this.frame);
    if (this.flash > 0) this.flash--;
    switch (this.phase) {
      case 'card':
        if (this.phaseT >= TUNING.cardFrames || (this.phaseT >= TUNING.cardSkipAfter && input.fire)) {
          this.setPhase('play');
          this.sfx('start');
        }
        break;
      case 'play':
        this.stepPlay(input);
        break;
      case 'dying':
        this.updateParticles();
        if (this.phaseT >= TUNING.deathPause) {
          if (this.lives <= 0) {
            this.setPhase('over');
            this.say('gameOver');
          } else {
            this.player.x = PLAYER_START.x;
            this.player.y = PLAYER_START.y;
            this.player.alive = true;
            this.player.invuln = Math.round(TUNING.respawnGrace * TUNING.difficulty[this.difficulty].grace);
            this.setPhase('play');
          }
        }
        break;
      case 'clear':
        this.updateParticles();
        this.movePlayer(input);
        if (this.phaseT >= TUNING.clearFrames) {
          if (this.opts.single) this.setPhase('done');
          else {
            this.missionIndex++;
            this.startMission();
          }
        }
        break;
      case 'boom':
        this.stepBoom();
        break;
      case 'promotion':
        this.updateParticles();
        if (this.phaseT >= TUNING.promotionFrames) {
          if (this.opts.single) this.setPhase('done');
          else {
            this.missionIndex = 0;
            this.startMission();
          }
        }
        break;
      case 'over':
        this.updateParticles();
        if (this.phaseT >= TUNING.gameOverFrames) this.setPhase('done');
        break;
      case 'done':
        break;
    }
  }

  private stepPlay(input: FrameInput): void {
    this.movePlayer(input);
    this.handleFire(input);
    this.moveShot();
    this.updateUrgency();
    this.mission.update(this);
    if (this.phase !== 'play') return; // the mission may end the phase (flagship)
    this.updateSaucer();
    this.updateBullets();
    this.enemyBodyCollisions();
    this.updateParticles();
    for (const e of this.enemies) if (e.flash > 0) e.flash--;
    this.enemies = this.enemies.filter((e) => e.alive);
    if (this.player.invuln > 0) this.player.invuln--;
    if (this.nearMissCooldown > 0) this.nearMissCooldown--;
    this.checkExtraShip();
    if (!this.mission.ownPulse) this.updatePulse();
    if (this.phase === 'play' && this.mission.isClear(this)) this.missionClear();
  }

  /** The fewer enemies left, the faster and angrier they get. */
  private updateUrgency(): void {
    if (!this.mission.thins) {
      this.urgeSpeed = this.urgeFire = 1;
      this.pace = Math.min(TUNING.maxEnemyPace, this.rp.speed);
      return;
    }
    const cleared = 1 - clamp(this.mission.remaining(this), 0, 1);
    const k = cleared * cleared;
    this.urgeSpeed = 1 + TUNING.thinning.speed * k;
    this.urgeFire = 1 + TUNING.thinning.fire * k;
    this.pace = Math.min(TUNING.maxEnemyPace, this.rp.speed * this.urgeSpeed);
  }

  private movePlayer(input: FrameInput): void {
    const p = this.player;
    if (!p.alive) return;
    const s = TUNING.shipSpeed;
    p.vx = input.mx * s;
    p.vy = input.my * s;
    p.x = clamp(p.x + p.vx, TUNING.zoneMarginX + 6, FB_W - TUNING.zoneMarginX - 6);
    p.y = clamp(p.y + p.vy, TUNING.zoneTop, TUNING.zoneBottom);
  }

  /**
   * The quantum shot: only one shot exists. Pressing FIRE while one is in
   * flight cancels it and launches a new one from the ship. With
   * hold-to-fire on, holding re-fires only when the shot has ended.
   */
  private handleFire(input: FrameInput): void {
    const p = this.player;
    if (!p.alive) return;
    let fire = false;
    if (this.opts.holdToFire) {
      fire = (input.fire || input.fireHeld) && !this.shot.alive;
    } else if (input.fire) {
      if (this.shot.alive) {
        this.cancelShot();
      }
      fire = true;
    }
    if (!fire) return;
    this.shot.x = Math.round(p.x);
    this.shot.y = p.y - 7;
    this.shot.alive = true;
    this.stats.shotsFired++;
    this.mission.onPlayerFire?.(this);
    this.sfx('shot');
    this.events.push({ t: 'haptic', id: 'fire' });
  }

  private cancelShot(): void {
    const s = this.shot;
    s.alive = false;
    this.stats.cancels++;
    this.noteMiss();
    this.sfx('cancel');
    this.addParticle({ kind: 'pop', x: s.x, y: s.y, vx: 0, vy: 0, life: 8, max: 8, r: 1, vr: 0.5 });
  }

  private noteMiss(): void {
    this.stats.missStreak++;
    if (this.stats.missStreak >= TUNING.missStreakLength) {
      this.stats.missStreak = 0;
      this.say('missStreak');
    }
  }

  private moveShot(): void {
    const s = this.shot;
    if (!s.alive) return;
    // Sub-steps so a fast shot can't skip over thin targets.
    const steps = Math.ceil(TUNING.shotSpeed / 2);
    const dy = TUNING.shotSpeed / steps;
    for (let i = 0; i < steps && s.alive; i++) {
      s.y -= dy;
      if (s.y < TUNING.hudTop - 4) {
        s.alive = false;
        this.noteMiss();
        return;
      }
      if (this.mission.shotScenery?.(this, s.x, s.y)) {
        s.alive = false;
        return;
      }
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (this.hitsEnemy(e, s.x, s.y, TUNING.shotLength)) {
          s.alive = false;
          this.stats.hits++;
          this.stats.missStreak = 0;
          if (!this.mission.onHit?.(this, e)) this.damageEnemy(e);
          return;
        }
      }
    }
  }

  // ---------------------------------------------------------------------
  // Enemies

  spawnEnemy(type: EnemyTypeName, x: number, y: number, state: EnemyState): Enemy {
    // Fairness: nothing appears on top of the player.
    const p = this.player;
    let d = Math.hypot(x - p.x, y - p.y);
    if (d < TUNING.minSpawnDistance) {
      y = Math.min(y, p.y - TUNING.minSpawnDistance);
      d = Math.hypot(x - p.x, y - p.y);
    }
    if (d < this.stats.minSpawnDist) this.stats.minSpawnDist = d;
    const def = ENEMY_TYPES[type];
    const e: Enemy = {
      id: this.nextId++, type, x, y, vx: 0, vy: 0, state, t: 0, hp: def.hp,
      hx: 0, hy: 0, a: 0, r: 0, p0: 0, p1: 0, p2: 0, stage: 0, link: -1, flash: 0, cool: 0, alive: true,
    };
    this.enemies.push(e);
    this.events.push({ t: 'spawn', type, x, y, dist: d });
    return e;
  }

  setState(e: Enemy, s: EnemyState): void {
    e.state = s;
    e.t = 0;
  }

  hitbox(e: Enemy): { w: number; h: number } {
    const def = ENEMY_TYPES[e.type];
    return def.hit[Math.min(e.stage, def.hit.length - 1)];
  }

  /** Does a vertical segment (x, y .. y+len) touch the enemy's hitbox? */
  hitsEnemy(e: Enemy, x: number, y: number, len: number): boolean {
    const h = this.hitbox(e);
    return Math.abs(x - e.x) <= h.w / 2 && y <= e.y + h.h / 2 && y + len >= e.y - h.h / 2;
  }

  isAttacking(e: Enemy): boolean {
    return e.state === 'leaving' || e.state === 'attacking' || e.state === 'returning' || e.state === 'emerging';
  }

  damageEnemy(e: Enemy): void {
    e.hp--;
    e.flash = 6;
    if (e.hp <= 0) this.killEnemy(e);
    else this.sfx('hitCarrier');
  }

  killEnemy(e: Enemy, byPlayer = true): void {
    if (!e.alive) return;
    e.alive = false;
    if (byPlayer) {
      const sc = SCORING.enemies[e.type] as { formation: number; attacking: number; stages?: number[] };
      let pts = this.isAttacking(e) ? sc.attacking : sc.formation;
      if (sc.stages) pts = sc.stages[Math.min(e.stage, sc.stages.length - 1)];
      if (e.type === 'saucer') pts = this.rng.pick(SCORING.saucer);
      this.addScore(pts);
      if (pts >= 100 || e.type === 'saucer') this.popupText(String(pts), e.x, e.y);
      this.stats.kills++;
    }
    const big = e.type === 'carrier' || e.type === 'saucer';
    this.explode(e.x, e.y, big ? 26 : 12, big);
    this.sfx(e.type === 'saucer' ? 'saucerHit' : big ? 'explodeLarge' : 'explodeSmall');
    this.events.push({ t: 'kill', type: e.type, x: e.x, y: e.y });
    this.mission.onKill?.(this, e);
  }

  fireBullet(type: BulletType, x: number, y: number, vx: number, vy: number): boolean {
    let n = 0;
    for (const b of this.bullets) if (b.alive) n++;
    if (n >= TUNING.maxEnemyBullets) return false;
    this.bullets.push({ x, y, vx, vy, type, grazed: false, alive: true });
    this.sfx(type === 'dart' ? 'dart' : 'enemyShot');
    return true;
  }

  /** Fire a dart from (x, y) aimed at the player. */
  aimDart(x: number, y: number, speed: number = TUNING.dartSpeed): boolean {
    const p = this.player;
    const a = fatan2(p.y - y, p.x - x);
    // Never aim upward or near-horizontal: darts come down at you.
    const ca = clamp(a, 0.5, Math.PI - 0.5);
    return this.fireBullet('dart', x, y, fcos(ca) * speed, fsin(ca) * speed);
  }

  dropBomb(x: number, y: number): boolean {
    return this.fireBullet('bomb', x, y, 0, TUNING.bombSpeed * this.rp.speed);
  }

  private updateBullets(): void {
    const p = this.player;
    for (const b of this.bullets) {
      if (!b.alive) continue;
      b.x += b.vx;
      b.y += b.vy;
      if (b.y > FB_H + 4 || b.x < -4 || b.x > FB_W + 4) {
        b.alive = false;
        continue;
      }
      if (this.mission.bulletScenery?.(this, b)) {
        b.alive = false;
        continue;
      }
      if (!p.alive) continue;
      const dx = Math.abs(b.x - p.x);
      const dy = Math.abs(b.y - p.y);
      if (dx <= TUNING.playerHitW / 2 + 1 && dy <= TUNING.playerHitH / 2 + 2) {
        b.alive = false;
        this.killPlayer();
        continue;
      }
      if (!b.grazed && dy < 3 && dx <= TUNING.nearMissDistance + TUNING.playerHitW / 2) {
        b.grazed = true;
        if (this.nearMissCooldown === 0) {
          this.nearMissCooldown = 120;
          this.say('nearMiss');
        }
      }
    }
    this.bullets = this.bullets.filter((b) => b.alive);
  }

  private enemyBodyCollisions(): void {
    const p = this.player;
    if (!p.alive) return;
    for (const e of this.enemies) {
      if (!e.alive || e.type === 'carrier') continue;
      const h = this.hitbox(e);
      if (Math.abs(e.x - p.x) <= (h.w + TUNING.playerHitW) / 2 && Math.abs(e.y - p.y) <= (h.h + TUNING.playerHitH) / 2) {
        if (this.player.invuln > 0 || this.invincible) continue;
        this.killEnemy(e, false);
        this.killPlayer();
        return;
      }
    }
  }

  /** A beam or anything else that kills the player on contact. */
  killPlayer(): void {
    const p = this.player;
    if (!p.alive || p.invuln > 0 || this.invincible) return;
    p.alive = false;
    this.lives--;
    this.stats.deaths++;
    this.shot.alive = false;
    this.bullets = [];
    this.mission.onPlayerDeath?.(this);
    this.explode(p.x, p.y, 40, true);
    this.flash = 6;
    this.flashColour = 0;
    this.sfx('death');
    this.events.push({ t: 'haptic', id: 'death' });
    this.setPhase('dying');
    // Down to the last ship: VORG gloats about that; otherwise a death line.
    this.say(this.lives === 1 ? 'lastShip' : 'playerDeath');
  }

  private updateSaucer(): void {
    if (this.missionDef.id === 'flagship') return;
    const s = this.enemies.find((e) => e.type === 'saucer');
    if (s) {
      s.x += s.vx;
      s.t++;
      if (s.x < -12 || s.x > FB_W + 12) s.alive = false;
      return;
    }
    if (--this.saucerT > 0) return;
    this.saucerT = TUNING.saucerEvery + this.rng.int(600);
    const dir = this.rng.sign();
    const e = this.spawnEnemy('saucer', dir > 0 ? -10 : FB_W + 10, TUNING.hudTop + 8, 'attacking');
    e.vx = dir * TUNING.saucerSpeed;
    this.sfx('saucer');
  }

  private updatePulse(): void {
    if (--this.pulseT > 0) return;
    const rem = clamp(this.mission.remaining(this), 0, 1);
    this.pulseT = Math.round(lerp(TUNING.pulseFast, TUNING.pulseSlow, rem));
    this.pulse();
  }

  /** One beat of the background pulse, never closer than pulseFast frames. */
  pulse(): void {
    if (this.frame - this.lastPulse < TUNING.pulseFast) return;
    this.lastPulse = this.frame;
    this.beat ^= 1;
    this.events.push({ t: 'pulse', beat: this.beat });
  }

  // ---------------------------------------------------------------------
  // Score and progress

  addScore(n: number): void {
    this.score += n;
  }

  private checkExtraShip(): void {
    if (this.opts.mode === 'practice' || this.opts.mode === 'demo') return;
    if (this.score >= this.nextExtra) {
      this.nextExtra += TUNING.extraShipEvery;
      this.lives++;
      this.sfx('extraLife');
      this.say('extraLife');
    }
  }

  private missionClear(): void {
    if (this.missionDef.id === 'flagship') return; // the reactor ends this one
    const bonus = SCORING.missionBonus * (this.level + 1);
    this.addScore(bonus);
    this.popupText(`${GAME_TEXT.bonus} ${bonus}`, FB_W / 2, 176);
    this.shot.alive = false;
    this.bullets = [];
    this.sfx('fanfare');
    this.setPhase('clear');
  }

  /** The flagship's reactor is hit: start the big one. */
  reactorDestroyed(x: number, y: number): void {
    this.addScore(SCORING.reactor);
    this.popupText(String(SCORING.reactor), x, y + 14);
    this.boom.x = x;
    this.boom.y = y;
    this.shot.alive = false;
    this.bullets = [];
    for (const e of this.enemies) if (e.alive) this.killEnemy(e, false);
    this.sfx('flagBoom');
    this.events.push({ t: 'haptic', id: 'boom' });
    this.flash = 6;
    this.flashColour = col('GREY', 5);
    this.setPhase('boom');
    this.say('flagshipDestroyed');
  }

  private stepBoom(): void {
    const t = this.phaseT;
    const { x, y } = this.boom;
    // Stage 1: flashes and a fireball at the reactor.
    if (t < 70) {
      // A few soft flashes, never a strobe (photosensitivity).
      if (t === 24 || t === 50) {
        this.flash = 3;
        this.flashColour = t === 24 ? col('RED', 2) : col('ORANGE', 2);
      }
      if (t % 6 === 0) this.explode(x + this.fx.range(-6, 6), y + this.fx.range(-3, 3), 18, true);
    } else if (t < 170) {
      // Stage 2: chain explosions along the hull.
      if (t % 5 === 0) this.explode(x + this.fx.range(-32, 32), y + this.fx.range(-8, 8), 14, t % 15 === 0);
    } else if (t === 170) {
      // Stage 3: the screen-filling blast.
      for (let i = 0; i < 4; i++) {
        this.addParticle({ kind: 'ring', x, y, vx: 0, vy: 0, life: 90, max: 90, r: 2 + i * 8, vr: 1.6 + i * 0.4 });
      }
      this.explode(x, y, 90, true);
      this.flash = 8;
      this.flashColour = col('YELLOW', 3);
    }
    this.updateParticles();
    if (t >= TUNING.boomFrames) {
      this.level++;
      this.sfx('promote');
      this.setPhase('promotion');
      this.say('promotion');
    }
  }

  // ---------------------------------------------------------------------
  // Effects (cosmetic; their randomness never touches gameplay)

  addParticle(p: Particle): void {
    if (this.particles.length < 600) this.particles.push(p);
  }

  explode(x: number, y: number, n: number, big = false): void {
    for (let i = 0; i < n; i++) {
      const a = this.fx.range(0, Math.PI * 2);
      const sp = this.fx.range(0.3, big ? 2.4 : 1.4);
      const life = Math.round(this.fx.range(14, big ? 48 : 26));
      this.addParticle({ kind: 'spark', x, y, vx: fcos(a) * sp, vy: fsin(a) * sp, life, max: life, r: 0, vr: 0, pen: PEN.CYC0 + (i % 6) });
    }
    this.addParticle({ kind: 'ring', x, y, vx: 0, vy: 0, life: big ? 22 : 12, max: big ? 22 : 12, r: 1, vr: big ? 1.4 : 0.9 });
  }

  popupText(text: string, x: number, y: number): void {
    this.addParticle({ kind: 'text', x, y, vx: 0, vy: -0.25, life: 50, max: 50, r: 0, vr: 0, text });
  }

  private updateParticles(): void {
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      if (p.kind === 'spark' || p.kind === 'debris') {
        p.vx *= 0.97;
        p.vy *= 0.97;
      }
      p.life--;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  // ---------------------------------------------------------------------
  // Replays and tests

  /** A hash of the gameplay state; equal hashes = identical games. */
  hash(): number {
    let h = 2166136261 >>> 0;
    const mix = (v: number) => {
      h ^= Math.round(v * 256) | 0;
      h = Math.imul(h, 16777619) >>> 0;
    };
    mix(this.rng.state);
    mix(this.frame);
    mix(this.score);
    mix(this.lives);
    mix(this.level);
    mix(this.missionIndex);
    mix(this.player.x);
    mix(this.player.y);
    mix(this.shot.alive ? this.shot.y : -1);
    for (const e of this.enemies) {
      mix(e.id);
      mix(e.x);
      mix(e.y);
      mix(e.hp);
      mix(e.t);
    }
    for (const b of this.bullets) {
      mix(b.x);
      mix(b.y);
    }
    return h;
  }
}
