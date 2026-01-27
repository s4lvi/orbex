import { TurretType, DamageType, MaterialType } from '../utils/Constants';

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
    cost: { [MaterialType.CARBOX]: 20, [MaterialType.HYDRON]: 10 },
    upgradeCosts: [
      { [MaterialType.CARBOX]: 15, [MaterialType.HYDRON]: 8 },
      { [MaterialType.CARBOX]: 30, [MaterialType.HYDRON]: 15 },
      { [MaterialType.CARBOX]: 60, [MaterialType.HYDRON]: 30 }
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
    cost: { [MaterialType.CARBOX]: 30, [MaterialType.HYDRON]: 20, energy: 15 },
    upgradeCosts: [
      { [MaterialType.CARBOX]: 20, [MaterialType.HYDRON]: 15, energy: 10 },
      { [MaterialType.CARBOX]: 40, [MaterialType.HYDRON]: 30, energy: 20 },
      { [MaterialType.CARBOX]: 80, [MaterialType.HYDRON]: 60, energy: 40 }
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
    cost: { [MaterialType.CARBOX]: 25, [MaterialType.HYDRON]: 15, [MaterialType.OXYON]: 10 },
    upgradeCosts: [
      { [MaterialType.CARBOX]: 20, [MaterialType.HYDRON]: 10, [MaterialType.OXYON]: 8 },
      { [MaterialType.CARBOX]: 40, [MaterialType.HYDRON]: 20, [MaterialType.OXYON]: 15 },
      { [MaterialType.CARBOX]: 80, [MaterialType.HYDRON]: 40, [MaterialType.OXYON]: 30 }
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
    cost: { [MaterialType.CARBOX]: 35, [MaterialType.HYDRON]: 25, energy: 30 },
    upgradeCosts: [
      { [MaterialType.CARBOX]: 25, [MaterialType.HYDRON]: 20, energy: 20 },
      { [MaterialType.CARBOX]: 50, [MaterialType.HYDRON]: 40, energy: 40 },
      { [MaterialType.CARBOX]: 100, [MaterialType.HYDRON]: 80, energy: 80 }
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
    cost: { [MaterialType.CARBOX]: 50, [MaterialType.TITAGEN]: 25, [MaterialType.PLUTONIA]: 10 },
    upgradeCosts: [
      { [MaterialType.CARBOX]: 35, [MaterialType.TITAGEN]: 20, [MaterialType.PLUTONIA]: 8 },
      { [MaterialType.CARBOX]: 70, [MaterialType.TITAGEN]: 40, [MaterialType.PLUTONIA]: 15 },
      { [MaterialType.CARBOX]: 140, [MaterialType.TITAGEN]: 80, [MaterialType.PLUTONIA]: 30 }
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
    cost: { [MaterialType.TITAGEN]: 40, [MaterialType.XITANIUM]: 20, [MaterialType.PLUTONIA]: 15 },
    upgradeCosts: [
      { [MaterialType.TITAGEN]: 30, [MaterialType.XITANIUM]: 15, [MaterialType.PLUTONIA]: 10 },
      { [MaterialType.TITAGEN]: 60, [MaterialType.XITANIUM]: 30, [MaterialType.PLUTONIA]: 20 },
      { [MaterialType.TITAGEN]: 120, [MaterialType.XITANIUM]: 60, [MaterialType.PLUTONIA]: 40 }
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
    cost: { [MaterialType.XITANIUM]: 30, [MaterialType.PLUTONIA]: 25, [MaterialType.NANON]: 10 },
    upgradeCosts: [
      { [MaterialType.XITANIUM]: 25, [MaterialType.PLUTONIA]: 20, [MaterialType.NANON]: 8 },
      { [MaterialType.XITANIUM]: 50, [MaterialType.PLUTONIA]: 40, [MaterialType.NANON]: 15 },
      { [MaterialType.XITANIUM]: 100, [MaterialType.PLUTONIA]: 80, [MaterialType.NANON]: 30 }
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
