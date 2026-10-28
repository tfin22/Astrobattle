import type { MissionId } from '../../content/missions';
import type { Mission } from '../mission';
import { ShieldWall } from './shieldWall';

/** Placeholder until a mission is built: clears at once. */
class Pending implements Mission {
  constructor(readonly id: MissionId) {}
  init(): void {}
  update(): void {}
  isClear(): boolean {
    return true;
  }
  remaining(): number {
    return 0;
  }
}

export function createMission(id: MissionId): Mission {
  switch (id) {
    case 'shieldWall':
      return new ShieldWall();
    default:
      return new Pending(id);
  }
}
