import Phaser from 'phaser';
import { OrbitalWeaponType, getOrbitalWeaponData } from '../data/orbitalWeapons';

const REGISTRY_KEY = 'orbitalWeaponsState';

interface OrbitalWeaponsState {
  weapons: { [key in OrbitalWeaponType]?: { level: number } };
}

/**
 * Persistent per-weapon level, stored in the registry (and therefore saved).
 * Shared by the in-mission weapon manager and the hangar research panel.
 */
export function getOrbitalWeaponLevel(registry: Phaser.Data.DataManager, type: OrbitalWeaponType): number {
  const state = registry.get(REGISTRY_KEY) as OrbitalWeaponsState | undefined;
  const level = state?.weapons?.[type]?.level;
  return typeof level === 'number' && level >= 1 ? level : 1;
}

export function setOrbitalWeaponLevel(registry: Phaser.Data.DataManager, type: OrbitalWeaponType, level: number): void {
  const current = (registry.get(REGISTRY_KEY) as OrbitalWeaponsState | undefined) || { weapons: {} };
  const next: OrbitalWeaponsState = { weapons: { ...current.weapons, [type]: { level } } };
  registry.set(REGISTRY_KEY, next);
}

export function canUpgradeOrbitalWeapon(registry: Phaser.Data.DataManager, type: OrbitalWeaponType): boolean {
  return getOrbitalWeaponLevel(registry, type) < getOrbitalWeaponData(type).maxLevel;
}
