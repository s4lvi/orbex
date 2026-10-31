import Phaser from 'phaser';
import {
  OrbitalWeaponType,
  OrbitalWeaponData,
  getOrbitalWeaponData,
  getScaledOrbitalWeaponStats,
  getUnlockedOrbitalWeapons
} from '../data/orbitalWeapons';
import { GameScene } from '../scenes/GameScene';
import { OrbitalStrike } from '../entities/OrbitalStrike';
import { Enemy } from '../entities/Enemy';
import { getOrbitalWeaponLevel } from './OrbitalWeaponState';

/**
 * OrbitalWeaponManager - player-controlled strikes from orbit.
 *
 * Tracks per-mission cooldowns, runs targeting mode, and applies damage
 * through the shared DamageSystem so resistances and armor apply.
 */
export class OrbitalWeaponManager {
  private scene: GameScene;
  private registry: Phaser.Data.DataManager;

  private isTargeting: boolean = false;
  private selectedWeapon: OrbitalWeaponType | null = null;
  private targetReticle: Phaser.GameObjects.Graphics | null = null;
  private rangeIndicator: Phaser.GameObjects.Graphics | null = null;

  private cooldowns: Map<OrbitalWeaponType, number> = new Map();
  private completedResearch: string[] = [];

  constructor(scene: GameScene) {
    this.scene = scene;
    this.registry = scene.registry;

    const researchProgress = this.registry.get('researchProgress');
    if (researchProgress?.completedNodes) {
      this.completedResearch = researchProgress.completedNodes;
    }

    for (const weapon of this.getUnlockedWeapons()) {
      this.cooldowns.set(weapon.id, 0);
    }

    this.createTargetReticle();
  }

  private createTargetReticle(): void {
    this.targetReticle = this.scene.add.graphics();
    this.targetReticle.setDepth(100);
    this.targetReticle.setVisible(false);
    this.targetReticle.setScrollFactor(0);
    this.scene.getCameraManager().addUIObject(this.targetReticle);

    // World-space AOE preview; moves and zooms with the map.
    this.rangeIndicator = this.scene.add.graphics();
    this.rangeIndicator.setDepth(99);
    this.rangeIndicator.setVisible(false);
    this.scene.getCameraManager().addGameObject(this.rangeIndicator);
  }

  public getUnlockedWeapons(): OrbitalWeaponData[] {
    return getUnlockedOrbitalWeapons(this.completedResearch);
  }

  public getWeaponLevel(type: OrbitalWeaponType): number {
    return getOrbitalWeaponLevel(this.registry, type);
  }

  public isDisabled(): boolean {
    return this.scene.isOrbitalDisabled();
  }

  /** Enter targeting mode. Returns false if the weapon can't be used right now. */
  public startTargeting(type: OrbitalWeaponType): boolean {
    if (this.isDisabled()) return false;

    const data = getOrbitalWeaponData(type);
    if (!data) return false;
    if ((this.cooldowns.get(type) || 0) > 0) return false;
    if (data.energyCost > 0 && !this.scene.resourceManager.hasEnergy(data.energyCost)) return false;

    this.isTargeting = true;
    this.selectedWeapon = type;
    this.targetReticle?.setVisible(!this.isTouchInput());
    this.rangeIndicator?.setVisible(false);
    return true;
  }

  public cancelTargeting(): void {
    this.isTargeting = false;
    this.selectedWeapon = null;
    this.targetReticle?.setVisible(false);
    this.rangeIndicator?.setVisible(false);
  }

  /** Move the reticle / AOE preview to the pointer. */
  public updateTargeting(screenX: number, screenY: number): void {
    if (!this.isTargeting || !this.selectedWeapon) return;

    if (!this.isTouchInput()) {
      this.drawTargetReticle(screenX, screenY);
    }

    const level = this.getWeaponLevel(this.selectedWeapon);
    const scaled = getScaledOrbitalWeaponStats(this.selectedWeapon, level);
    if (scaled.aoeRadius > 0) {
      const worldPos = this.scene.getCameraManager().screenToWorld(screenX, screenY);
      this.drawRangeIndicator(worldPos.x, worldPos.y, scaled.aoeRadius);
      this.rangeIndicator?.setVisible(true);
    }
  }

  private drawTargetReticle(screenX: number, screenY: number): void {
    if (!this.targetReticle) return;
    const g = this.targetReticle;
    g.clear();
    g.lineStyle(3, 0xff0000, 0.8);
    g.strokeCircle(screenX, screenY, 25);
    g.lineStyle(2, 0xff0000, 0.8);
    g.lineBetween(screenX - 35, screenY, screenX - 10, screenY);
    g.lineBetween(screenX + 10, screenY, screenX + 35, screenY);
    g.lineBetween(screenX, screenY - 35, screenX, screenY - 10);
    g.lineBetween(screenX, screenY + 10, screenX, screenY + 35);
    g.fillStyle(0xff0000, 1);
    g.fillCircle(screenX, screenY, 3);
  }

  private drawRangeIndicator(worldX: number, worldY: number, radius: number): void {
    if (!this.rangeIndicator) return;
    this.rangeIndicator.clear();
    this.rangeIndicator.lineStyle(2, 0xff6600, 0.5);
    this.rangeIndicator.strokeCircle(worldX, worldY, radius);
    this.rangeIndicator.fillStyle(0xff6600, 0.1);
    this.rangeIndicator.fillCircle(worldX, worldY, radius);
  }

  /**
   * Fire the selected weapon at a screen position. Targeting mode stays active
   * so cheap weapons can be fired repeatedly; cancel to return to building.
   */
  public fireAtTarget(screenX: number, screenY: number): boolean {
    if (!this.isTargeting || !this.selectedWeapon) return false;
    if (this.isDisabled()) return false;

    const weaponType = this.selectedWeapon;
    const data = getOrbitalWeaponData(weaponType);
    const level = this.getWeaponLevel(weaponType);
    const scaled = getScaledOrbitalWeaponStats(weaponType, level);

    if ((this.cooldowns.get(weaponType) || 0) > 0) return false;
    if (data.energyCost > 0 && !this.scene.resourceManager.spendEnergy(data.energyCost)) return false;

    const worldPos = this.scene.getCameraManager().screenToWorld(screenX, screenY);

    new OrbitalStrike(this.scene, worldPos.x, worldPos.y, weaponType, level);
    this.applyDamage(worldPos.x, worldPos.y, scaled, data);

    this.cooldowns.set(weaponType, scaled.cooldown);
    this.scene.events.emit('orbitalWeaponFired', weaponType);
    return true;
  }

  private applyDamage(x: number, y: number, scaled: { damage: number; aoeRadius: number }, data: OrbitalWeaponData): void {
    const enemies = this.scene.enemies.getChildren() as unknown as Enemy[];
    const radius = scaled.aoeRadius > 0 ? scaled.aoeRadius : 30;

    for (const enemy of [...enemies]) {
      if (!enemy.active) continue;
      const distance = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
      if (distance > radius) continue;

      const result = scaled.aoeRadius > 0
        ? this.scene.damageSystem.calculateAOEDamage(scaled.damage, data.damageType, distance, radius, enemy.getData(), enemy.getArmor())
        : this.scene.damageSystem.calculateDamage(scaled.damage, data.damageType, enemy.getData(), enemy.getArmor());

      if (result.wasEvaded) continue;
      enemy.takeDamage(result.finalDamage);
      if (!enemy.active) continue;

      if (data.special) {
        if (data.special.slow && data.special.slowDuration) {
          enemy.applyStatusEffect('slow', data.special.slow, data.special.slowDuration);
        }
        if (data.special.stunDuration) {
          enemy.applyStatusEffect('stun', 1, data.special.stunDuration);
        }
        if (data.special.dotDamage && data.special.dotDuration) {
          enemy.applyStatusEffect('dot', data.special.dotDamage, data.special.dotDuration, data.damageType);
        }
      }
    }
  }

  /** @param delta Simulation delta in ms (zero while paused). */
  public update(delta: number): void {
    if (delta <= 0) return;
    for (const [type, cooldown] of this.cooldowns.entries()) {
      if (cooldown > 0) {
        this.cooldowns.set(type, Math.max(0, cooldown - delta));
      }
    }
  }

  public getCooldown(type: OrbitalWeaponType): number {
    return this.cooldowns.get(type) || 0;
  }

  public getCooldownPercent(type: OrbitalWeaponType): number {
    const scaled = getScaledOrbitalWeaponStats(type, this.getWeaponLevel(type));
    return scaled.cooldown > 0 ? this.getCooldown(type) / scaled.cooldown : 0;
  }

  public isReady(type: OrbitalWeaponType): boolean {
    return this.getCooldown(type) <= 0;
  }

  public isTargetingActive(): boolean {
    return this.isTargeting;
  }

  public getSelectedWeapon(): OrbitalWeaponType | null {
    return this.selectedWeapon;
  }

  public destroy(): void {
    this.cancelTargeting();
    this.targetReticle?.destroy();
    this.rangeIndicator?.destroy();
    this.targetReticle = null;
    this.rangeIndicator = null;
  }

  private isTouchInput(): boolean {
    return this.scene.sys.game.device.input.touch;
  }
}
