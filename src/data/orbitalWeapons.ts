import { DamageType } from '../utils/Constants';

export enum OrbitalWeaponType {
  ORBITAL_LASER = 'orbital_laser',
  KINETIC_STRIKE = 'kinetic_strike',
  CRYO_BOMB = 'cryo_bomb',
  EMP_PULSE = 'emp_pulse',
  PLASMA_BARRAGE = 'plasma_barrage'
}

export interface OrbitalWeaponData {
  id: OrbitalWeaponType;
  name: string;
  description: string;
  energyCost: number;
  damage: number;
  damageType: DamageType;
  aoeRadius: number;
  cooldown: number;  // ms
  maxLevel: number;
  unlocked: boolean;  // Available from start
  researchRequired: string | null;
  special?: {
    slow?: number;
    slowDuration?: number;
    stunDuration?: number;
    dotDamage?: number;
    dotDuration?: number;
  };
  levelScaling: {
    damageMultiplier: number;
    cooldownReduction: number;
    aoeIncrease: number;
  };
}

export const ORBITAL_WEAPONS: { [key in OrbitalWeaponType]: OrbitalWeaponData } = {
  [OrbitalWeaponType.ORBITAL_LASER]: {
    id: OrbitalWeaponType.ORBITAL_LASER,
    name: 'Orbital Laser',
    description: 'Focused laser beam from orbit. Low damage, fast cooldown.',
    energyCost: 0,  // Base weapon is free to use
    damage: 1,  // Base damage of 1 as specified
    damageType: DamageType.THERMAL,
    aoeRadius: 0,  // Single target
    cooldown: 500,  // Very fast cooldown for spamming
    maxLevel: 5,
    unlocked: true,  // Available from start
    researchRequired: null,
    special: {
      dotDamage: 0.5,
      dotDuration: 2000
    },
    levelScaling: {
      damageMultiplier: 1.5,
      cooldownReduction: 0.1,
      aoeIncrease: 0
    }
  },

  [OrbitalWeaponType.KINETIC_STRIKE]: {
    id: OrbitalWeaponType.KINETIC_STRIKE,
    name: 'Kinetic Strike',
    description: 'Tungsten rod dropped from orbit. High damage in small area.',
    energyCost: 40,
    damage: 25,
    damageType: DamageType.KINETIC,
    aoeRadius: 40,
    cooldown: 8000,
    maxLevel: 5,
    unlocked: false,
    researchRequired: 'orbital_kinetic',
    levelScaling: {
      damageMultiplier: 1.3,
      cooldownReduction: 0.08,
      aoeIncrease: 5
    }
  },

  [OrbitalWeaponType.CRYO_BOMB]: {
    id: OrbitalWeaponType.CRYO_BOMB,
    name: 'Cryo Bomb',
    description: 'Freezing bomb that slows enemies in area.',
    energyCost: 30,
    damage: 5,
    damageType: DamageType.CRYO,
    aoeRadius: 80,
    cooldown: 10000,
    maxLevel: 5,
    unlocked: false,
    researchRequired: 'orbital_cryo',
    special: {
      slow: 0.6,
      slowDuration: 5000
    },
    levelScaling: {
      damageMultiplier: 1.2,
      cooldownReduction: 0.1,
      aoeIncrease: 10
    }
  },

  [OrbitalWeaponType.EMP_PULSE]: {
    id: OrbitalWeaponType.EMP_PULSE,
    name: 'EMP Pulse',
    description: 'Electromagnetic pulse that stuns enemies.',
    energyCost: 50,
    damage: 3,
    damageType: DamageType.ELECTRIC,
    aoeRadius: 100,
    cooldown: 15000,
    maxLevel: 5,
    unlocked: false,
    researchRequired: 'orbital_emp',
    special: {
      stunDuration: 3000
    },
    levelScaling: {
      damageMultiplier: 1.2,
      cooldownReduction: 0.1,
      aoeIncrease: 15
    }
  },

  [OrbitalWeaponType.PLASMA_BARRAGE]: {
    id: OrbitalWeaponType.PLASMA_BARRAGE,
    name: 'Plasma Barrage',
    description: 'Multiple plasma strikes in wide area. Devastating damage.',
    energyCost: 100,
    damage: 50,
    damageType: DamageType.THERMAL,
    aoeRadius: 120,
    cooldown: 25000,
    maxLevel: 5,
    unlocked: false,
    researchRequired: 'orbital_plasma',
    special: {
      dotDamage: 5,
      dotDuration: 4000
    },
    levelScaling: {
      damageMultiplier: 1.4,
      cooldownReduction: 0.08,
      aoeIncrease: 15
    }
  }
};

export function getOrbitalWeaponData(type: OrbitalWeaponType): OrbitalWeaponData {
  return ORBITAL_WEAPONS[type];
}

export function getAllOrbitalWeapons(): OrbitalWeaponData[] {
  return Object.values(ORBITAL_WEAPONS);
}

export function getUnlockedOrbitalWeapons(completedResearch: string[]): OrbitalWeaponData[] {
  return Object.values(ORBITAL_WEAPONS).filter(weapon => {
    if (weapon.unlocked) return true;
    if (weapon.researchRequired && completedResearch.includes(weapon.researchRequired)) return true;
    return false;
  });
}

export function getScaledOrbitalWeaponStats(type: OrbitalWeaponType, level: number): {
  damage: number;
  cooldown: number;
  aoeRadius: number;
} {
  const base = ORBITAL_WEAPONS[type];
  const levelBonus = level - 1;

  return {
    damage: Math.floor(base.damage * Math.pow(base.levelScaling.damageMultiplier, levelBonus)),
    cooldown: Math.floor(base.cooldown * Math.pow(1 - base.levelScaling.cooldownReduction, levelBonus)),
    aoeRadius: base.aoeRadius + (base.levelScaling.aoeIncrease * levelBonus)
  };
}
