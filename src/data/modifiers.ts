import { DamageType } from '../utils/Constants';

export type ModifierId =
  | 'ION_STORM'
  | 'DENSE_FOG'
  | 'UNSTABLE_GROUND'
  | 'SOLAR_FLARE'
  | 'OVERPRESSURE';

export type ModifierSlant = 'negative' | 'positive' | 'mixed';

export interface ModifierEffects {
  /** Multiplied into every turret's range at construct/restore. */
  turretRangeMul?: number;
  /** Multiplied into every turret's fire rate. */
  turretFireRateMul?: number;
  /** Multiplied into every turret's damage. */
  turretDamageMul?: number;
  /** If set, the above three multipliers only apply to turrets of these damage types. */
  affectsDamageTypes?: DamageType[];
  /** Multiplied into every enemy's base/current speed. */
  enemySpeedMul?: number;
  /** True → orbital weapons are unavailable for the duration of the drop. */
  orbitalWeaponsDisabled?: boolean;
}

export interface ModifierData {
  id: ModifierId;
  name: string;
  shortName: string; // for HUD pill
  description: string;
  slant: ModifierSlant;
  color: string; // hex like '#ff8844'
  effects: ModifierEffects;
}

export const MODIFIERS: Record<ModifierId, ModifierData> = {
  ION_STORM: {
    id: 'ION_STORM',
    name: 'Ion Storm',
    shortName: 'ION',
    description: 'Atmospheric interference disables orbital strike support.',
    slant: 'negative',
    color: '#ff8844',
    effects: { orbitalWeaponsDisabled: true },
  },
  DENSE_FOG: {
    id: 'DENSE_FOG',
    name: 'Dense Fog',
    shortName: 'FOG',
    description: 'Visibility reduced. All turret range -25%.',
    slant: 'negative',
    color: '#aaaaaa',
    effects: { turretRangeMul: 0.75 },
  },
  UNSTABLE_GROUND: {
    id: 'UNSTABLE_GROUND',
    name: 'Unstable Ground',
    shortName: 'QUAKE',
    description: 'Tremors propel hostiles forward. Enemy speed +25%.',
    slant: 'negative',
    color: '#cc6644',
    effects: { enemySpeedMul: 1.25 },
  },
  SOLAR_FLARE: {
    id: 'SOLAR_FLARE',
    name: 'Solar Flare',
    shortName: 'FLARE',
    description: 'Energy weapons supercharged. Thermal and electric turrets +30% damage, +15% fire rate.',
    slant: 'positive',
    color: '#ffee44',
    effects: {
      turretDamageMul: 1.3,
      turretFireRateMul: 1.15,
      affectsDamageTypes: [DamageType.THERMAL, DamageType.ELECTRIC],
    },
  },
  OVERPRESSURE: {
    id: 'OVERPRESSURE',
    name: 'Overpressure',
    shortName: 'PSI+',
    description: 'Dense atmosphere. Kinetic turrets +20% damage, enemies -10% speed.',
    slant: 'positive',
    color: '#88ddff',
    effects: {
      turretDamageMul: 1.2,
      affectsDamageTypes: [DamageType.KINETIC, DamageType.EXPLOSIVE],
      enemySpeedMul: 0.9,
    },
  },
};

const NEGATIVE_POOL: ModifierId[] = ['ION_STORM', 'DENSE_FOG', 'UNSTABLE_GROUND'];
const POSITIVE_POOL: ModifierId[] = ['SOLAR_FLARE', 'OVERPRESSURE'];

/**
 * Roll 0–2 modifiers for a drop. Higher difficulty bumps the chance of two.
 * Mostly negatives with a sprinkle of positives so the player has something
 * to look forward to.
 */
export function rollModifiers(difficulty: number): ModifierId[] {
  const r = Math.random();
  // Base distribution shifts toward "more modifiers" with difficulty (0..1).
  const noneCutoff = 0.35 - difficulty * 0.20;     // less likely to be empty as diff rises
  const oneCutoff = noneCutoff + 0.55;             // rest is "two modifiers"

  let count: number;
  if (r < noneCutoff) count = 0;
  else if (r < oneCutoff) count = 1;
  else count = 2;

  const picks: ModifierId[] = [];
  const used = new Set<ModifierId>();
  for (let i = 0; i < count; i++) {
    const usePositive = Math.random() < 0.30;
    const pool = (usePositive ? POSITIVE_POOL : NEGATIVE_POOL).filter(id => !used.has(id));
    if (pool.length === 0) {
      // Fall back to the other pool if we exhausted this one.
      const otherPool = (usePositive ? NEGATIVE_POOL : POSITIVE_POOL).filter(id => !used.has(id));
      if (otherPool.length === 0) break;
      const pick = otherPool[Math.floor(Math.random() * otherPool.length)];
      picks.push(pick);
      used.add(pick);
    } else {
      const pick = pool[Math.floor(Math.random() * pool.length)];
      picks.push(pick);
      used.add(pick);
    }
  }
  return picks;
}
