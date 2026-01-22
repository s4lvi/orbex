import { DamageType } from '../utils/Constants';
import { EnemyData } from '../data/enemies';

export interface DamageResult {
  finalDamage: number;
  damageBlocked: number;
  isCritical: boolean;
  wasEvaded: boolean;
}

export class DamageSystem {
  constructor() {}

  public calculateDamage(
    baseDamage: number,
    damageType: DamageType,
    targetData: EnemyData,
    targetCurrentArmor: number,
    options?: {
      critChance?: number;
      critMultiplier?: number;
      armorPenetration?: number;
    }
  ): DamageResult {
    let damage = baseDamage;
    let isCritical = false;
    let wasEvaded = false;

    // Check for evasion
    if (targetData.abilities?.evasion) {
      if (Math.random() < targetData.abilities.evasion) {
        return {
          finalDamage: 0,
          damageBlocked: baseDamage,
          isCritical: false,
          wasEvaded: true
        };
      }
    }

    // Apply damage type modifiers (resistances and weaknesses)
    const resistance = targetData.resistances?.[damageType] || 1;
    const weakness = targetData.weaknesses?.[damageType] || 1;
    damage *= resistance * weakness;

    // Check for critical hit
    if (options?.critChance && Math.random() < options.critChance) {
      damage *= options.critMultiplier || 2;
      isCritical = true;
    }

    // Calculate armor reduction
    let effectiveArmor = targetCurrentArmor;
    if (options?.armorPenetration) {
      effectiveArmor *= (1 - options.armorPenetration);
    }

    // Armor reduces damage by a percentage (diminishing returns formula)
    // armor 10 = ~9% reduction, armor 50 = ~33% reduction, armor 100 = ~50% reduction
    const armorReduction = effectiveArmor / (effectiveArmor + 100);
    const damageBlocked = damage * armorReduction;
    damage -= damageBlocked;

    // Minimum damage of 1
    damage = Math.max(1, Math.floor(damage));

    return {
      finalDamage: damage,
      damageBlocked: Math.floor(damageBlocked),
      isCritical,
      wasEvaded
    };
  }

  public calculateAOEDamage(
    baseDamage: number,
    damageType: DamageType,
    distanceFromCenter: number,
    aoeRadius: number,
    targetData: EnemyData,
    targetArmor: number
  ): DamageResult {
    // Falloff based on distance (linear falloff from center)
    const falloff = Math.max(0, 1 - (distanceFromCenter / aoeRadius) * 0.5);
    const adjustedDamage = baseDamage * falloff;

    return this.calculateDamage(adjustedDamage, damageType, targetData, targetArmor);
  }

  public calculateDOTDamage(
    damagePerTick: number,
    damageType: DamageType,
    targetData: EnemyData,
    targetArmor: number
  ): DamageResult {
    // DOT typically ignores armor partially
    const reducedArmor = targetArmor * 0.5;
    return this.calculateDamage(damagePerTick, damageType, targetData, reducedArmor);
  }

  public getDamageTypeColor(type: DamageType): number {
    switch (type) {
      case DamageType.KINETIC:
        return 0xaaaaaa;
      case DamageType.THERMAL:
        return 0xff6600;
      case DamageType.CRYO:
        return 0x00ccff;
      case DamageType.ELECTRIC:
        return 0xffff00;
      case DamageType.EXPLOSIVE:
        return 0xff3300;
      default:
        return 0xffffff;
    }
  }

  public getDamageTypeName(type: DamageType): string {
    switch (type) {
      case DamageType.KINETIC:
        return 'Kinetic';
      case DamageType.THERMAL:
        return 'Thermal';
      case DamageType.CRYO:
        return 'Cryo';
      case DamageType.ELECTRIC:
        return 'Electric';
      case DamageType.EXPLOSIVE:
        return 'Explosive';
      default:
        return 'Unknown';
    }
  }
}
