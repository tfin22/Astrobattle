import type { SfxId } from '../game/types';

/** Sound and speech output. Filled in by the sound-chip and speech milestones. */
export class AudioEngine {
  enabled = true;
  volume = 0.8;
  unlock(): void {}
  sfx(_id: SfxId, _dur?: number): void {}
  pulse(_beat: number): void {}
  say(_ph: string): void {}
  stopSpeech(): void {}
  setLoop(_id: 'warp' | 'alarm', _on: boolean, _rate = 1): void {}
  apply(enabled: boolean, volume: number): void {
    this.enabled = enabled;
    this.volume = volume;
  }
  suspend(): void {}
  resume(): void {}
}
