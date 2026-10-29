/** Fixed-timestep runner: the simulation always advances in 1/60 s steps. */
export const STEP_MS = 1000 / 60;
const MAX_STEPS_PER_FRAME = 5;

export interface LoopHooks {
  step(): void;
  render(alpha: number, now: number): void;
}

export class FixedLoop {
  private acc = 0;
  private last = 0;
  private running = false;
  private raf = 0;
  stepsThisSecond = 0;
  fps = 0;
  private fpsT = 0;
  private framesThisSecond = 0;

  constructor(private hooks: LoopHooks) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const tick = (now: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(tick);
      this.frame(now);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /** Advance by real time; exposed for tests. */
  frame(now: number): void {
    let dt = now - this.last;
    this.last = now;
    if (dt > 250) dt = STEP_MS; // tab was hidden: don't fast-forward
    this.acc += dt;
    let steps = 0;
    while (this.acc >= STEP_MS && steps < MAX_STEPS_PER_FRAME) {
      this.hooks.step();
      this.acc -= STEP_MS;
      steps++;
    }
    if (steps === MAX_STEPS_PER_FRAME) this.acc = 0;
    this.framesThisSecond++;
    if (now - this.fpsT >= 1000) {
      this.fps = (this.framesThisSecond * 1000) / (now - this.fpsT);
      this.framesThisSecond = 0;
      this.fpsT = now;
    }
    this.hooks.render(this.acc / STEP_MS, now);
  }
}
