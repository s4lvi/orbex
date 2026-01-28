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

interface WeaponState {
  level: number;
  cooldownRemaining: number;
  lastFiredTime: number;
}

interface OrbitalWeaponsState {
  weapons: { [key in OrbitalWeaponType]?: WeaponState };
}

const REGISTRY_KEY = 'orbitalWeaponsState';

/**
 * OrbitalWeaponManager - Manages player-controlled orbital weapons
 *
 * Features:
 * - Track cooldowns for each weapon
 * - Handle targeting mode
 * - Fire weapons at targets
 * - Track weapon levels/upgrades
 */
export class OrbitalWeaponManager {
  private scene: GameScene;
  private registry: Phaser.Data.DataManager;

  // Targeting state
  private isTargeting: boolean = false;
  private selectedWeapon: OrbitalWeaponType | null = null;
  private targetReticle: Phaser.GameObjects.Graphics | null = null;
  private rangeIndicator: Phaser.GameObjects.Graphics | null = null;

  // Cooldown tracking (per-mission)
  private cooldowns: Map<OrbitalWeaponType, number> = new Map();

  // Completed research (for unlock checking)
  private completedResearch: string[] = [];

  constructor(scene: GameScene) {
    this.scene = scene;
    this.registry = scene.registry;

    // Load completed research
    const researchProgress = this.registry.get('researchProgress');
    if (researchProgress?.completedNodes) {
      this.completedResearch = researchProgress.completedNodes;
    }

    // Initialize cooldowns
    this.initializeCooldowns();

    // Create targeting reticle
    this.createTargetReticle();
  }

  private initializeCooldowns(): void {
    const unlocked = this.getUnlockedWeapons();
    for (const weapon of unlocked) {
      this.cooldowns.set(weapon.id, 0);
    }
  }

  private createTargetReticle(): void {
    this.targetReticle = this.scene.add.graphics();
    this.targetReticle.setDepth(100);
    this.targetReticle.setVisible(false);
    // UI element - don't move with camera
    this.targetReticle.setScrollFactor(0);

    this.rangeIndicator = this.scene.add.graphics();
    this.rangeIndicator.setDepth(99);
    this.rangeIndicator.setVisible(false);

    // Register with camera manager so they don't zoom
    const cameraManager = this.scene.getCameraManager();
    cameraManager.addUIObject(this.targetReticle);
    // Range indicator is in world space, so it should zoom with the game
  }

  /**
   * Get all unlocked weapons
   */
  public getUnlockedWeapons(): OrbitalWeaponData[] {
    return getUnlockedOrbitalWeapons(this.completedResearch);
  }

  /**
   * Get weapon state (persistent across sessions)
   */
  private getWeaponState(type: OrbitalWeaponType): WeaponState {
    const state = this.registry.get(REGISTRY_KEY) as OrbitalWeaponsState | undefined;
    const weaponState = state?.weapons?.[type];

    if (weaponState) {
      return weaponState;
    }

    // Default state
    return {
      level: 1,
      cooldownRemaining: 0,
      lastFiredTime: 0
    };
  }

  /**
   * Save weapon state
   */
  private saveWeaponState(type: OrbitalWeaponType, state: WeaponState): void {
    const currentState = (this.registry.get(REGISTRY_KEY) as OrbitalWeaponsState) || { weapons: {} };
    currentState.weapons[type] = state;
    this.registry.set(REGISTRY_KEY, currentState);
  }

  /**
   * Get weapon level
   */
  public getWeaponLevel(type: OrbitalWeaponType): number {
    return this.getWeaponState(type).level;
  }

  /**
   * Start targeting mode for a weapon
   */
  public startTargeting(type: OrbitalWeaponType): boolean {
    console.log(`[OrbitalWeaponManager] startTargeting called for: ${type}`);

    const data = getOrbitalWeaponData(type);
    if (!data) {
      console.log(`[OrbitalWeaponManager] No data found for weapon: ${type}`);
      return false;
    }

    // Check if weapon is on cooldown
    const cooldown = this.cooldowns.get(type) || 0;
    if (cooldown > 0) {
      console.log(`[OrbitalWeaponManager] ${type} on cooldown: ${cooldown}ms remaining`);
      return false;
    }

    // Check if player has enough energy (skip check if cost is 0)
    if (data.energyCost > 0 && !this.scene.resourceManager.hasEnergy(data.energyCost)) {
      console.log(`[OrbitalWeaponManager] Not enough energy: ${data.energyCost} required, have: ${this.scene.resourceManager.getEnergy()}`);
      return false;
    }

    console.log(`[OrbitalWeaponManager] Starting targeting mode for ${type}`);
    this.isTargeting = true;
    this.selectedWeapon = type;
    this.targetReticle?.setVisible(true);
    this.rangeIndicator?.setVisible(data.aoeRadius > 0);

    return true;
  }

  /**
   * Cancel targeting mode
   */
  public cancelTargeting(): void {
    this.isTargeting = false;
    this.selectedWeapon = null;
    this.targetReticle?.setVisible(false);
    this.rangeIndicator?.setVisible(false);
  }

  /**
   * Update targeting reticle position
   */
  public updateTargeting(screenX: number, screenY: number): void {
    if (!this.isTargeting || !this.selectedWeapon) return;

    // Draw reticle at screen position (reticle has scrollFactor 0)
    this.drawTargetReticle(screenX, screenY);

    // Draw range indicator at world position (it moves with camera)
    if (this.selectedWeapon) {
      const level = this.getWeaponLevel(this.selectedWeapon);
      const scaled = getScaledOrbitalWeaponStats(this.selectedWeapon, level);

      if (scaled.aoeRadius > 0) {
        // Convert screen to world for the range indicator
        const worldPos = this.scene.getCameraManager().screenToWorld(screenX, screenY);
        this.drawRangeIndicator(worldPos.x, worldPos.y, scaled.aoeRadius);
      }
    }
  }

  private drawTargetReticle(screenX: number, screenY: number): void {
    if (!this.targetReticle) return;

    this.targetReticle.clear();

    // Draw at screen coordinates (reticle has scrollFactor 0)
    // Outer circle
    this.targetReticle.lineStyle(3, 0xff0000, 0.8);
    this.targetReticle.strokeCircle(screenX, screenY, 25);

    // Cross hairs
    this.targetReticle.lineStyle(2, 0xff0000, 0.8);
    this.targetReticle.lineBetween(screenX - 35, screenY, screenX - 10, screenY);
    this.targetReticle.lineBetween(screenX + 10, screenY, screenX + 35, screenY);
    this.targetReticle.lineBetween(screenX, screenY - 35, screenX, screenY - 10);
    this.targetReticle.lineBetween(screenX, screenY + 10, screenX, screenY + 35);

    // Center dot
    this.targetReticle.fillStyle(0xff0000, 1);
    this.targetReticle.fillCircle(screenX, screenY, 3);
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
   * Fire weapon at target location
   * Note: Targeting mode stays active after firing - user must click cancel or switch weapons
   */
  public fireAtTarget(screenX: number, screenY: number): boolean {
    if (!this.isTargeting || !this.selectedWeapon) return false;

    const weaponType = this.selectedWeapon;
    const data = getOrbitalWeaponData(weaponType);
    const level = this.getWeaponLevel(weaponType);
    const scaled = getScaledOrbitalWeaponStats(weaponType, level);

    // Check if weapon is on cooldown
    const cooldown = this.cooldowns.get(weaponType) || 0;
    if (cooldown > 0) {
      console.log(`[OrbitalWeaponManager] Cannot fire - on cooldown: ${cooldown}ms`);
      return false;
    }

    // Check and consume energy (skip for free weapons)
    if (data.energyCost > 0) {
      if (!this.scene.resourceManager.spendEnergy(data.energyCost)) {
        console.log(`[OrbitalWeaponManager] Cannot fire - not enough energy`);
        return false;
      }
    }

    // Convert screen to world coordinates
    const worldPos = this.scene.getCameraManager().screenToWorld(screenX, screenY);

    // Create orbital strike visual effect
    new OrbitalStrike(this.scene, worldPos.x, worldPos.y, weaponType, level);

    // Apply damage to enemies in range
    this.applyDamage(worldPos.x, worldPos.y, scaled, data);

    // Start cooldown
    this.cooldowns.set(weaponType, scaled.cooldown);

    // Stay in targeting mode - user must click cancel or switch weapons to exit

    // Emit event for UI update
    this.scene.events.emit('orbitalWeaponFired', weaponType);

    return true;
  }

  private applyDamage(x: number, y: number, scaled: { damage: number; aoeRadius: number }, data: OrbitalWeaponData): void {
    const enemies = this.scene.enemies.getChildren() as unknown as Enemy[];

    for (const enemy of enemies) {
      if (!enemy.active) continue;

      const distance = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);

      // Check if enemy is in range (single target or AOE)
      const inRange = scaled.aoeRadius > 0 ? distance <= scaled.aoeRadius : distance <= 30;

      if (inRange) {
        // Apply damage
        enemy.takeDamage(scaled.damage);

        // Apply special effects
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
  }

  /**
   * Update cooldowns (call each frame)
   */
  public update(delta: number): void {
    for (const [type, cooldown] of this.cooldowns.entries()) {
      if (cooldown > 0) {
        this.cooldowns.set(type, Math.max(0, cooldown - delta));
      }
    }
  }

  /**
   * Get cooldown remaining for weapon
   */
  public getCooldown(type: OrbitalWeaponType): number {
    return this.cooldowns.get(type) || 0;
  }

  /**
   * Get cooldown percentage (0-1)
   */
  public getCooldownPercent(type: OrbitalWeaponType): number {
    const current = this.cooldowns.get(type) || 0;
    const data = getOrbitalWeaponData(type);
    return current / data.cooldown;
  }

  /**
   * Check if weapon is ready to fire
   */
  public isReady(type: OrbitalWeaponType): boolean {
    return (this.cooldowns.get(type) || 0) <= 0;
  }

  /**
   * Check if currently in targeting mode
   */
  public isTargetingActive(): boolean {
    return this.isTargeting;
  }

  /**
   * Get currently selected weapon
   */
  public getSelectedWeapon(): OrbitalWeaponType | null {
    return this.selectedWeapon;
  }

  /**
   * Upgrade weapon level
   */
  public upgradeWeapon(type: OrbitalWeaponType, energyCost: number): boolean {
    const state = this.getWeaponState(type);
    const data = getOrbitalWeaponData(type);

    if (state.level >= data.maxLevel) return false;
    if (!this.scene.resourceManager.spendEnergy(energyCost)) return false;

    state.level++;
    this.saveWeaponState(type, state);
    return true;
  }

  /**
   * Clean up
   */
  public destroy(): void {
    this.targetReticle?.destroy();
    this.rangeIndicator?.destroy();
    this.cancelTargeting();
  }
}
