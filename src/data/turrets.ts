import { TurretType, DamageType } from '../utils/Constants';

export interface TurretData {
  type: TurretType;
  name: string;
  description: string;
  damage: number;
  damageType: DamageType;
  range: number;
  fireRate: number; // shots per second
  projectileSpeed: number;
  cost: { [key: string]: number };
  upgradeCosts: { [key: string]: number }[];
  maxLevel: number;
  special?: {
    aoe?: number;
    slow?: number;
    slowDuration?: number;
    chainTargets?: number;
    piercing?: boolean;
    dotDamage?: number;
    dotDuration?: number;
  };
}

export const TURRETS: { [key in TurretType]: TurretData } = {
  [TurretType.MACHINEGUN]: {
    type: TurretType.MACHINEGUN,
    name: 'Machine Gun',
    description: 'Fast-firing kinetic turret. Low damage, high fire rate.',
    damage: 5,
    damageType: DamageType.KINETIC,
    range: 150,
    fireRate: 8,
    projectileSpeed: 600,
    cost: { minerals: 30, energy: 10 },
    upgradeCosts: [
      { minerals: 20, energy: 10 },
      { minerals: 40, energy: 20 },
      { minerals: 80, energy: 40 }
    ],
    maxLevel: 4
  },

  [TurretType.LASER]: {
    type: TurretType.LASER,
    name: 'Laser Turret',
    description: 'Thermal beam weapon. Continuous damage, good range.',
    damage: 15,
    damageType: DamageType.THERMAL,
    range: 200,
    fireRate: 2,
    projectileSpeed: 1000,
    cost: { minerals: 50, energy: 30 },
    upgradeCosts: [
      { minerals: 30, energy: 20 },
      { minerals: 60, energy: 40 },
      { minerals: 120, energy: 80 }
    ],
    maxLevel: 4,
    special: {
      dotDamage: 3,
      dotDuration: 2000
    }
  },

  [TurretType.CRYO]: {
    type: TurretType.CRYO,
    name: 'Cryo Cannon',
    description: 'Freezing weapon. Slows enemies, moderate damage.',
    damage: 8,
    damageType: DamageType.CRYO,
    range: 140,
    fireRate: 1.5,
    projectileSpeed: 400,
    cost: { minerals: 40, energy: 25, crystals: 5 },
    upgradeCosts: [
      { minerals: 25, energy: 15, crystals: 3 },
      { minerals: 50, energy: 30, crystals: 6 },
      { minerals: 100, energy: 60, crystals: 12 }
    ],
    maxLevel: 4,
    special: {
      slow: 0.5,
      slowDuration: 2000
    }
  },

  [TurretType.TESLA]: {
    type: TurretType.TESLA,
    name: 'Tesla Coil',
    description: 'Electric arc weapon. Chains between enemies.',
    damage: 12,
    damageType: DamageType.ELECTRIC,
    range: 130,
    fireRate: 1,
    projectileSpeed: 800,
    cost: { minerals: 60, energy: 50 },
    upgradeCosts: [
      { minerals: 40, energy: 30 },
      { minerals: 80, energy: 60 },
      { minerals: 160, energy: 120 }
    ],
    maxLevel: 4,
    special: {
      chainTargets: 3
    }
  },

  [TurretType.MISSILE]: {
    type: TurretType.MISSILE,
    name: 'Missile Launcher',
    description: 'Explosive projectiles. Area damage, slow fire rate.',
    damage: 25,
    damageType: DamageType.EXPLOSIVE,
    range: 250,
    fireRate: 0.5,
    projectileSpeed: 350,
    cost: { minerals: 80, alloys: 30 },
    upgradeCosts: [
      { minerals: 50, alloys: 20 },
      { minerals: 100, alloys: 40 },
      { minerals: 200, alloys: 80 }
    ],
    maxLevel: 4,
    special: {
      aoe: 60
    }
  },

  [TurretType.RAILGUN]: {
    type: TurretType.RAILGUN,
    name: 'Railgun',
    description: 'Piercing projectile. Hits all enemies in line.',
    damage: 40,
    damageType: DamageType.KINETIC,
    range: 300,
    fireRate: 0.3,
    projectileSpeed: 1200,
    cost: { minerals: 100, alloys: 50, plasma: 10 },
    upgradeCosts: [
      { minerals: 60, alloys: 30, plasma: 5 },
      { minerals: 120, alloys: 60, plasma: 10 },
      { minerals: 240, alloys: 120, plasma: 20 }
    ],
    maxLevel: 4,
    special: {
      piercing: true
    }
  },

  [TurretType.PLASMA]: {
    type: TurretType.PLASMA,
    name: 'Plasma Cannon',
    description: 'Devastating plasma weapon. High damage, area effect.',
    damage: 50,
    damageType: DamageType.THERMAL,
    range: 180,
    fireRate: 0.4,
    projectileSpeed: 300,
    cost: { minerals: 120, energy: 80, plasma: 20, darkMatter: 5 },
    upgradeCosts: [
      { minerals: 80, energy: 50, plasma: 15, darkMatter: 3 },
      { minerals: 160, energy: 100, plasma: 30, darkMatter: 6 },
      { minerals: 320, energy: 200, plasma: 60, darkMatter: 12 }
    ],
    maxLevel: 4,
    special: {
      aoe: 80,
      dotDamage: 5,
      dotDuration: 3000
    }
  }
};

export function getTurretData(type: TurretType): TurretData {
  return TURRETS[type];
}

export function getUpgradedStats(type: TurretType, level: number): Partial<TurretData> {
  const base = TURRETS[type];
  const multiplier = 1 + (level - 1) * 0.25;

  return {
    damage: Math.floor(base.damage * multiplier),
    range: Math.floor(base.range * (1 + (level - 1) * 0.1)),
    fireRate: base.fireRate * (1 + (level - 1) * 0.15)
  };
}
