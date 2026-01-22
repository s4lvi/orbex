import { TrapType, DamageType } from '../utils/Constants';

export interface TrapData {
  type: TrapType;
  name: string;
  description: string;
  damage: number;
  damageType: DamageType;
  triggerRadius: number;
  cooldown: number; // ms between activations
  duration: number; // how long the effect lasts (for persistent traps)
  uses: number; // -1 for unlimited
  cost: { [key: string]: number };
  effect?: {
    slow?: number;
    slowDuration?: number;
    dot?: number;
    dotDuration?: number;
    stun?: number;
    aoe?: number;
  };
}

export const TRAPS: { [key in TrapType]: TrapData } = {
  [TrapType.SPIKE]: {
    type: TrapType.SPIKE,
    name: 'Spike Trap',
    description: 'Deals damage to enemies walking over it. Limited uses.',
    damage: 15,
    damageType: DamageType.KINETIC,
    triggerRadius: 30,
    cooldown: 0,
    duration: 0,
    uses: 5,
    cost: { minerals: 15, alloys: 5 }
  },

  [TrapType.SLOWFIELD]: {
    type: TrapType.SLOWFIELD,
    name: 'Slow Field',
    description: 'Creates a persistent field that slows enemies.',
    damage: 0,
    damageType: DamageType.CRYO,
    triggerRadius: 50,
    cooldown: 0,
    duration: -1, // permanent
    uses: -1, // unlimited
    cost: { minerals: 25, energy: 15, crystals: 3 },
    effect: {
      slow: 0.4, // 40% slow
      aoe: 50
    }
  },

  [TrapType.MINE]: {
    type: TrapType.MINE,
    name: 'Proximity Mine',
    description: 'Explodes when enemies get close. High damage, single use.',
    damage: 50,
    damageType: DamageType.EXPLOSIVE,
    triggerRadius: 40,
    cooldown: 0,
    duration: 0,
    uses: 1,
    cost: { minerals: 30, alloys: 15 },
    effect: {
      aoe: 70
    }
  },

  [TrapType.EMP]: {
    type: TrapType.EMP,
    name: 'EMP Trap',
    description: 'Stuns mechanical enemies briefly. Recharges over time.',
    damage: 10,
    damageType: DamageType.ELECTRIC,
    triggerRadius: 60,
    cooldown: 8000,
    duration: 0,
    uses: -1,
    cost: { minerals: 40, energy: 30 },
    effect: {
      stun: 1500, // 1.5 second stun
      aoe: 60
    }
  },

  [TrapType.FIRE]: {
    type: TrapType.FIRE,
    name: 'Flame Pit',
    description: 'Burns enemies over time. Persistent area damage.',
    damage: 5,
    damageType: DamageType.THERMAL,
    triggerRadius: 45,
    cooldown: 500,
    duration: -1,
    uses: -1,
    cost: { minerals: 35, energy: 20, plasma: 5 },
    effect: {
      dot: 3,
      dotDuration: 3000,
      aoe: 45
    }
  }
};

export function getTrapData(type: TrapType): TrapData {
  return TRAPS[type];
}

export function getAllTraps(): TrapData[] {
  return Object.values(TRAPS);
}
