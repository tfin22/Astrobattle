import type { MissionId } from '../../content/missions';
import type { Mission } from '../mission';
import { ShieldWall } from './shieldWall';
import { LaserAttack } from './laserAttack';
import { Swarm } from './swarm';
import { SpaceWarp } from './spaceWarp';
import { Flagship } from './flagship';

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
    case 'laserAttack':
      return new LaserAttack();
    case 'swarm':
      return new Swarm();
    case 'spaceWarp':
      return new SpaceWarp();
    case 'flagship':
      return new Flagship();
    default:
      return new Pending(id);
  }
}
