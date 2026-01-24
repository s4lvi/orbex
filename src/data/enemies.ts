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

export const ENEMIES: { [key in EnemyType]: EnemyData } = {
  [EnemyType.DRONE]: {
    type: EnemyType.DRONE,
    name: 'Scout Drone',
    description: 'Basic enemy unit. Fast but fragile.',
    health: 30,
    armor: 0,
    speed: 80,
    damage: 1,
    energyReward: 3,
    resistances: {},
    weaknesses: {
      [DamageType.ELECTRIC]: 1.25
    }
  },

  [EnemyType.SOLDIER]: {
    type: EnemyType.SOLDIER,
    name: 'Infantry',
    description: 'Standard ground unit. Balanced stats.',
    health: 60,
    armor: 5,
    speed: 60,
    damage: 1,
    energyReward: 5,
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
    health: 200,
    armor: 30,
    speed: 30,
    damage: 2,
    energyReward: 15,
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
    health: 25,
    armor: 0,
    speed: 150,
    damage: 1,
    energyReward: 8,
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
    health: 40,
    armor: 0,
    speed: 70,
    damage: 1,
    energyReward: 10,
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
    health: 50,
    armor: 0,
    speed: 50,
    damage: 1,
    energyReward: 12,
    resistances: {
      [DamageType.KINETIC]: 0.8
    },
    weaknesses: {
      [DamageType.ELECTRIC]: 1.3
    },
    abilities: {
      teleport: { range: 100, cooldown: 3000 }
    }
  },

  [EnemyType.SPAWNER]: {
    type: EnemyType.SPAWNER,
    name: 'Hive Carrier',
    description: 'Spawns drones periodically. Spawns more on death.',
    health: 120,
    armor: 10,
    speed: 35,
    damage: 2,
    energyReward: 20,
    resistances: {
      [DamageType.KINETIC]: 0.9
    },
    weaknesses: {
      [DamageType.THERMAL]: 1.3
    },
    abilities: {
      periodicSpawn: { type: EnemyType.DRONE, interval: 5000 },
      spawn: { type: EnemyType.DRONE, count: 3, onDeath: true }
    }
  },

  [EnemyType.BOSS]: {
    type: EnemyType.BOSS,
    name: 'Overlord',
    description: 'Massive boss unit. Very dangerous.',
    health: 1000,
    armor: 50,
    speed: 20,
    damage: 5,
    energyReward: 100,
    resistances: {
      [DamageType.KINETIC]: 0.7,
      [DamageType.THERMAL]: 0.8,
      [DamageType.CRYO]: 0.8
    },
    weaknesses: {},
    abilities: {
      shield: { amount: 200, regenRate: 10, regenDelay: 5000 },
      periodicSpawn: { type: EnemyType.SOLDIER, interval: 8000 }
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
