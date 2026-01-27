import { EnemyType, DamageType } from '../utils/Constants';

export interface EnemyData {
  type: EnemyType;
  name: string;
  description: string;
  health: number;
  armor: number;
  speed: number;
  damage: number; // damage to base
  energyReward: number; // energy only - materials come from mines
  resistances: { [key in DamageType]?: number }; // multiplier (0.5 = 50% damage, 1.5 = 150% damage)
  weaknesses: { [key in DamageType]?: number };
  abilities?: {
    teleport?: { range: number; cooldown: number };
    spawn?: { type: EnemyType; count: number; onDeath?: boolean };
    periodicSpawn?: { type: EnemyType; interval: number };
    evasion?: number; // chance to dodge 0-1
    shield?: { amount: number; regenRate: number; regenDelay: number };
    flying?: boolean;
  };
}

// Base stats are for Level 1 enemies (early game, orbital-laser viable)
// Stats scale with enemy level via DifficultyManager
export const ENEMIES: { [key in EnemyType]: EnemyData } = {
  [EnemyType.DRONE]: {
    type: EnemyType.DRONE,
    name: 'Scout Drone',
    description: 'Basic enemy unit. Fast but fragile.',
    health: 3,           // 3 shots with orbital laser
    armor: 0,
    speed: 60,
    damage: 1,
    energyReward: 2,
    resistances: {},
    weaknesses: {
      [DamageType.ELECTRIC]: 1.25
    }
  },

  [EnemyType.SOLDIER]: {
    type: EnemyType.SOLDIER,
    name: 'Infantry',
    description: 'Standard ground unit. Balanced stats.',
    health: 6,           // 6+ shots with orbital laser
    armor: 1,
    speed: 45,
    damage: 1,
    energyReward: 3,
    resistances: {
      [DamageType.KINETIC]: 0.9
    },
    weaknesses: {
      [DamageType.EXPLOSIVE]: 1.2
    }
  },

  [EnemyType.TANK]: {
    type: EnemyType.TANK,
    name: 'Heavy Tank',
    description: 'Heavily armored. Slow but very tough.',
    health: 20,          // Requires sustained fire or AOE
    armor: 3,
    speed: 25,
    damage: 2,
    energyReward: 8,
    resistances: {
      [DamageType.KINETIC]: 0.6,
      [DamageType.EXPLOSIVE]: 0.8
    },
    weaknesses: {
      [DamageType.CRYO]: 1.3,
      [DamageType.THERMAL]: 1.2
    }
  },

  [EnemyType.SPEEDER]: {
    type: EnemyType.SPEEDER,
    name: 'Speeder',
    description: 'Extremely fast. Hard to target.',
    health: 2,           // Very fragile but fast
    armor: 0,
    speed: 120,
    damage: 1,
    energyReward: 4,
    resistances: {},
    weaknesses: {
      [DamageType.CRYO]: 1.5
    },
    abilities: {
      evasion: 0.2
    }
  },

  [EnemyType.FLYER]: {
    type: EnemyType.FLYER,
    name: 'Air Drone',
    description: 'Flying unit. Ignores ground obstacles.',
    health: 4,
    armor: 0,
    speed: 55,
    damage: 1,
    energyReward: 5,
    resistances: {
      [DamageType.EXPLOSIVE]: 0.7
    },
    weaknesses: {
      [DamageType.ELECTRIC]: 1.4
    },
    abilities: {
      flying: true
    }
  },

  [EnemyType.TELEPORTER]: {
    type: EnemyType.TELEPORTER,
    name: 'Phase Shifter',
    description: 'Teleports forward periodically.',
    health: 5,
    armor: 0,
    speed: 40,
    damage: 1,
    energyReward: 6,
    resistances: {
      [DamageType.KINETIC]: 0.8
    },
    weaknesses: {
      [DamageType.ELECTRIC]: 1.3
    },
    abilities: {
      teleport: { range: 80, cooldown: 4000 }
    }
  },

  [EnemyType.SPAWNER]: {
    type: EnemyType.SPAWNER,
    name: 'Hive Carrier',
    description: 'Spawns drones periodically. Spawns more on death.',
    health: 15,
    armor: 2,
    speed: 30,
    damage: 2,
    energyReward: 12,
    resistances: {
      [DamageType.KINETIC]: 0.9
    },
    weaknesses: {
      [DamageType.THERMAL]: 1.3
    },
    abilities: {
      periodicSpawn: { type: EnemyType.DRONE, interval: 6000 },
      spawn: { type: EnemyType.DRONE, count: 2, onDeath: true }
    }
  },

  [EnemyType.BOSS]: {
    type: EnemyType.BOSS,
    name: 'Overlord',
    description: 'Massive boss unit. Very dangerous.',
    health: 100,
    armor: 5,
    speed: 18,
    damage: 5,
    energyReward: 50,
    resistances: {
      [DamageType.KINETIC]: 0.7,
      [DamageType.THERMAL]: 0.8,
      [DamageType.CRYO]: 0.8
    },
    weaknesses: {},
    abilities: {
      shield: { amount: 20, regenRate: 1, regenDelay: 5000 },
      periodicSpawn: { type: EnemyType.SOLDIER, interval: 10000 }
    }
  }
};

export function getEnemyData(type: EnemyType | string): EnemyData {
  return ENEMIES[type as EnemyType];
}

export function getScaledEnemyStats(type: EnemyType, waveNumber: number, difficulty: number): Partial<EnemyData> {
  const base = ENEMIES[type];
  const healthMultiplier = 1 + (waveNumber - 1) * 0.1 * difficulty;
  const armorMultiplier = 1 + (waveNumber - 1) * 0.05 * difficulty;
  const energyMultiplier = 1 + (waveNumber - 1) * 0.05;

  return {
    health: Math.floor(base.health * healthMultiplier),
    armor: Math.floor(base.armor * armorMultiplier),
    energyReward: Math.floor(base.energyReward * energyMultiplier)
  };
}
