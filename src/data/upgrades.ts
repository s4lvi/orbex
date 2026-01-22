import { TurretType } from '../utils/Constants';

export interface UpgradeData {
  id: string;
  name: string;
  description: string;
  effect: {
    damage?: number; // multiplier
    range?: number; // multiplier
    fireRate?: number; // multiplier
    aoe?: number; // multiplier
    slow?: number; // multiplier
    slowDuration?: number; // multiplier
    chainTargets?: number; // additional targets
    critChance?: number; // 0-1
    critDamage?: number; // multiplier
  };
  cost: { [key: string]: number };
  requiredLevel: number;
  turretTypes?: TurretType[]; // if specified, only available for these turrets
}

export const GLOBAL_UPGRADES: UpgradeData[] = [
  {
    id: 'damage_1',
    name: 'Reinforced Barrels',
    description: '+15% damage for all turrets',
    effect: { damage: 1.15 },
    cost: { minerals: 50, alloys: 20 },
    requiredLevel: 2
  },
  {
    id: 'damage_2',
    name: 'Advanced Ammunition',
    description: '+25% damage for all turrets',
    effect: { damage: 1.25 },
    cost: { minerals: 100, alloys: 50, plasma: 10 },
    requiredLevel: 3
  },
  {
    id: 'range_1',
    name: 'Enhanced Optics',
    description: '+20% range for all turrets',
    effect: { range: 1.2 },
    cost: { minerals: 40, energy: 30, crystals: 5 },
    requiredLevel: 2
  },
  {
    id: 'firerate_1',
    name: 'Overclocked Motors',
    description: '+20% fire rate for all turrets',
    effect: { fireRate: 1.2 },
    cost: { minerals: 60, energy: 50 },
    requiredLevel: 2
  },
  {
    id: 'crit_1',
    name: 'Precision Targeting',
    description: '10% chance for 2x critical damage',
    effect: { critChance: 0.1, critDamage: 2 },
    cost: { minerals: 80, alloys: 30, crystals: 10 },
    requiredLevel: 3
  }
];

export const TURRET_SPECIFIC_UPGRADES: { [key in TurretType]: UpgradeData[] } = {
  [TurretType.MACHINEGUN]: [
    {
      id: 'mg_burst',
      name: 'Burst Fire',
      description: '+50% fire rate, -10% damage',
      effect: { fireRate: 1.5, damage: 0.9 },
      cost: { minerals: 40, energy: 20 },
      requiredLevel: 2,
      turretTypes: [TurretType.MACHINEGUN]
    },
    {
      id: 'mg_armor_pierce',
      name: 'Armor Piercing Rounds',
      description: 'Ignores 50% of enemy armor',
      effect: { damage: 1.2 },
      cost: { minerals: 60, alloys: 30 },
      requiredLevel: 3,
      turretTypes: [TurretType.MACHINEGUN]
    }
  ],
  [TurretType.LASER]: [
    {
      id: 'laser_focus',
      name: 'Focused Beam',
      description: '+30% damage, +20% range',
      effect: { damage: 1.3, range: 1.2 },
      cost: { minerals: 50, energy: 40, crystals: 5 },
      requiredLevel: 2,
      turretTypes: [TurretType.LASER]
    },
    {
      id: 'laser_burn',
      name: 'Intense Heat',
      description: 'Burn damage increased by 100%',
      effect: { damage: 1.1 },
      cost: { minerals: 70, energy: 60 },
      requiredLevel: 3,
      turretTypes: [TurretType.LASER]
    }
  ],
  [TurretType.CRYO]: [
    {
      id: 'cryo_deep',
      name: 'Deep Freeze',
      description: '+50% slow effect, +1s slow duration',
      effect: { slow: 1.5, slowDuration: 1.5 },
      cost: { minerals: 50, crystals: 15 },
      requiredLevel: 2,
      turretTypes: [TurretType.CRYO]
    },
    {
      id: 'cryo_shatter',
      name: 'Shatter',
      description: 'Frozen enemies take 25% more damage from all sources',
      effect: { damage: 1.25 },
      cost: { minerals: 80, crystals: 25, darkMatter: 3 },
      requiredLevel: 3,
      turretTypes: [TurretType.CRYO]
    }
  ],
  [TurretType.TESLA]: [
    {
      id: 'tesla_chain',
      name: 'Extended Arc',
      description: '+2 chain targets',
      effect: { chainTargets: 2 },
      cost: { minerals: 60, energy: 50 },
      requiredLevel: 2,
      turretTypes: [TurretType.TESLA]
    },
    {
      id: 'tesla_overload',
      name: 'System Overload',
      description: 'Stunned enemies for 0.5s on hit',
      effect: { damage: 1.2 },
      cost: { minerals: 100, energy: 80, plasma: 10 },
      requiredLevel: 3,
      turretTypes: [TurretType.TESLA]
    }
  ],
  [TurretType.MISSILE]: [
    {
      id: 'missile_cluster',
      name: 'Cluster Warheads',
      description: '+50% AOE radius',
      effect: { aoe: 1.5 },
      cost: { minerals: 80, alloys: 40 },
      requiredLevel: 2,
      turretTypes: [TurretType.MISSILE]
    },
    {
      id: 'missile_smart',
      name: 'Smart Targeting',
      description: 'Missiles track targets, +30% damage',
      effect: { damage: 1.3 },
      cost: { minerals: 120, alloys: 60, plasma: 15 },
      requiredLevel: 3,
      turretTypes: [TurretType.MISSILE]
    }
  ],
  [TurretType.RAILGUN]: [
    {
      id: 'rail_velocity',
      name: 'Hypervelocity',
      description: '+40% projectile speed, +20% damage',
      effect: { damage: 1.2 },
      cost: { minerals: 100, alloys: 50, plasma: 15 },
      requiredLevel: 2,
      turretTypes: [TurretType.RAILGUN]
    },
    {
      id: 'rail_penetrate',
      name: 'Full Penetration',
      description: 'No damage reduction on pierce',
      effect: { damage: 1.3 },
      cost: { minerals: 150, alloys: 80, plasma: 25, darkMatter: 5 },
      requiredLevel: 3,
      turretTypes: [TurretType.RAILGUN]
    }
  ],
  [TurretType.PLASMA]: [
    {
      id: 'plasma_unstable',
      name: 'Unstable Plasma',
      description: '+30% AOE, +25% damage',
      effect: { aoe: 1.3, damage: 1.25 },
      cost: { minerals: 120, plasma: 30, darkMatter: 8 },
      requiredLevel: 2,
      turretTypes: [TurretType.PLASMA]
    },
    {
      id: 'plasma_nova',
      name: 'Plasma Nova',
      description: 'Enemies killed explode for 50% damage',
      effect: { damage: 1.2, aoe: 1.2 },
      cost: { minerals: 200, plasma: 50, darkMatter: 15, antimatter: 5 },
      requiredLevel: 3,
      turretTypes: [TurretType.PLASMA]
    }
  ]
};

export function getUpgradesForTurret(type: TurretType, level: number): UpgradeData[] {
  const specific = TURRET_SPECIFIC_UPGRADES[type].filter(u => u.requiredLevel <= level);
  const global = GLOBAL_UPGRADES.filter(u => u.requiredLevel <= level);
  return [...specific, ...global];
}

export function getUpgradeById(id: string): UpgradeData | undefined {
  // Check global upgrades
  const globalUpgrade = GLOBAL_UPGRADES.find(u => u.id === id);
  if (globalUpgrade) return globalUpgrade;

  // Check turret-specific upgrades
  for (const turretUpgrades of Object.values(TURRET_SPECIFIC_UPGRADES)) {
    const found = turretUpgrades.find(u => u.id === id);
    if (found) return found;
  }

  return undefined;
}
