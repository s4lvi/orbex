import { TurretType, DamageType } from '../utils/Constants';
import { DataLoader } from '../systems/DataLoader';
import { TurretConfig } from '../types/GameData';

/**
 * Turret stats come from src/data/json/turrets.json (the single source of truth
 * shared with the build menu). This module only adds the enum-typed view the
 * entity layer uses.
 */
export interface TurretData extends TurretConfig {
  type: TurretType;
  damageType: DamageType;
}

export function getTurretData(type: TurretType): TurretData {
  const config = DataLoader.getTurretByType(type);
  if (!config) {
    throw new Error(`Unknown turret type: ${type}`);
  }
  return { ...config, type, damageType: config.damageType as DamageType };
}

export function getAllTurretTypes(): TurretType[] {
  return Object.values(TurretType);
}

/** Per-level stat multipliers (level 1 = base stats). */
export function getLevelMultipliers(level: number): { damage: number; range: number; fireRate: number } {
  const bonus = Math.max(0, level - 1);
  return {
    damage: 1 + bonus * 0.25,
    range: 1 + bonus * 0.1,
    fireRate: 1 + bonus * 0.15
  };
}
