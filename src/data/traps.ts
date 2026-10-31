import { TrapType, DamageType } from '../utils/Constants';
import { DataLoader } from '../systems/DataLoader';
import { TrapConfig } from '../types/GameData';

/**
 * Trap stats come from src/data/json/traps.json (shared with the build menu).
 */
export interface TrapData extends TrapConfig {
  type: TrapType;
  damageType: DamageType;
}

export function getTrapData(type: TrapType): TrapData {
  const config = DataLoader.getTrapByType(type);
  if (!config) {
    throw new Error(`Unknown trap type: ${type}`);
  }
  return { ...config, type, damageType: config.damageType as DamageType };
}
