import Phaser from 'phaser';
import { DEPTH, TurretType, DamageType, MaterialType } from '../utils/Constants';
import { GameScene } from '../scenes/GameScene';
import { getTurretData, TurretData, getUpgradedStats } from '../data/turrets';
import { Enemy } from './Enemy';
import { TurretInstance } from '../types/GameData';

export class Turret extends Phaser.GameObjects.Container {
  public scene: GameScene;
  public turretType: TurretType;
  private turretData: TurretData;

  // Grid position
  public gridX: number;
  public gridY: number;

  // Stats
  public level: number = 1;
  public damage: number;
  public damageType: DamageType;
  public range: number;
  public fireRate: number;
  public projectileSpeed: number;

  // Specials
  public aoe: number = 0;
  public slow: number = 0;
  public slowDuration: number = 0;
  public chainTargets: number = 0;
  public piercing: boolean = false;
  public dotDamage: number = 0;
  public dotDuration: number = 0;

  // Targeting
  private target: Enemy | null = null;
  private fireCooldown: number = 0;

  // Visuals
  private baseSprite: Phaser.GameObjects.Sprite;
  private barrelSprite: Phaser.GameObjects.Rectangle;
  private rangeCircle: Phaser.GameObjects.Graphics;

  // Applied upgrades
  public appliedUpgrades: string[] = [];
  public critChance: number = 0;
  public critMultiplier: number = 1;

  // Inventory tracking - if set, this turret came from player inventory
  public inventoryId: string | null = null;

  constructor(scene: GameScene, x: number, y: number, type: TurretType, gridX: number, gridY: number) {
    super(scene, x, y);

    this.scene = scene;
    this.turretType = type;
    this.gridX = gridX;
    this.gridY = gridY;
    this.turretData = getTurretData(type);

    // Initialize stats
    this.damage = this.turretData.damage;
    this.damageType = this.turretData.damageType;
    this.range = this.turretData.range;
    this.fireRate = this.turretData.fireRate;
    this.projectileSpeed = this.turretData.projectileSpeed;

    // Initialize special abilities
    if (this.turretData.special) {
      this.aoe = this.turretData.special.aoe || 0;
      this.slow = this.turretData.special.slow || 0;
      this.slowDuration = this.turretData.special.slowDuration || 0;
      this.chainTargets = this.turretData.special.chainTargets || 0;
      this.piercing = this.turretData.special.piercing || false;
      this.dotDamage = this.turretData.special.dotDamage || 0;
      this.dotDuration = this.turretData.special.dotDuration || 0;
    }

    // Create visuals
    this.baseSprite = scene.add.sprite(0, 0, `turret-${type}`);
    this.add(this.baseSprite);

    // Create barrel indicator
    this.barrelSprite = scene.add.rectangle(15, 0, 20, 6, 0x444444);
    this.barrelSprite.setOrigin(0, 0.5);
    this.add(this.barrelSprite);

    // Create range circle (initially hidden)
    this.rangeCircle = scene.add.graphics();
    this.rangeCircle.setVisible(false);
    this.updateRangeCircle();

    this.setDepth(DEPTH.TURRET);

    // Fire cooldown starts ready
    this.fireCooldown = 0;
  }

  public preUpdate(_time: number, delta: number): void {
    // Update fire cooldown
    if (this.fireCooldown > 0) {
      this.fireCooldown -= delta;
    }
  }

  public updateTargeting(enemies: Enemy[]): void {
    // Find target if we don't have one or current target is invalid
    if (!this.target || !this.target.active || !this.isInRange(this.target)) {
      this.target = this.findBestTarget(enemies);
    }

    // Aim at target
    if (this.target) {
      this.aimAt(this.target);

      // Fire if ready
      if (this.fireCooldown <= 0) {
        this.fire();
        this.fireCooldown = 1000 / this.fireRate;
      }
    }
  }

  private findBestTarget(enemies: Enemy[]): Enemy | null {
    // Filter enemies in range
    const inRange = enemies.filter(enemy => enemy.active && this.isInRange(enemy));

    if (inRange.length === 0) return null;

    // Target priority: closest to base
    inRange.sort((a, b) => a.getDistanceToBase() - b.getDistanceToBase());

    return inRange[0];
  }

  private isInRange(enemy: Enemy): boolean {
    const distance = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
    return distance <= this.range;
  }

  private aimAt(target: Enemy): void {
    // Calculate angle to target
    const angle = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
    this.barrelSprite.rotation = angle;
  }

  private fire(): void {
    if (!this.target) return;

    // Get projectile texture based on turret type
    const projectileTexture = this.getProjectileTexture();

    // Spawn projectile with all special abilities
    this.scene.spawnProjectile(
      this.x + Math.cos(this.barrelSprite.rotation) * 20,
      this.y + Math.sin(this.barrelSprite.rotation) * 20,
      this.target.x,
      this.target.y,
      {
        damage: this.damage,
        damageType: this.damageType,
        speed: this.projectileSpeed,
        texture: projectileTexture,
        aoe: this.aoe,
        slow: this.slow,
        slowDuration: this.slowDuration,
        chainTargets: this.chainTargets,
        piercing: this.piercing,
        dotDamage: this.dotDamage,
        dotDuration: this.dotDuration
      }
    );

    // Visual feedback
    this.scene.tweens.add({
      targets: this.barrelSprite,
      scaleX: 0.8,
      duration: 50,
      yoyo: true
    });
  }

  private getProjectileTexture(): string {
    switch (this.turretType) {
      case TurretType.MACHINEGUN:
        return 'projectile-bullet';
      case TurretType.LASER:
        return 'projectile-laser';
      case TurretType.CRYO:
        return 'projectile-cryo';
      case TurretType.TESLA:
        return 'projectile-electric';
      case TurretType.MISSILE:
        return 'projectile-missile';
      case TurretType.RAILGUN:
        return 'projectile-railgun';
      case TurretType.PLASMA:
        return 'projectile-plasma';
      default:
        return 'projectile-bullet';
    }
  }

  public setSelected(selected: boolean): void {
    this.rangeCircle.setVisible(selected);

    if (selected) {
      this.baseSprite.setTint(0x88ff88);
    } else {
      this.baseSprite.clearTint();
    }
  }

  private updateRangeCircle(): void {
    this.rangeCircle.clear();
    this.rangeCircle.lineStyle(2, 0x00ff88, 0.5);
    this.rangeCircle.strokeCircle(this.x, this.y, this.range);
    this.rangeCircle.fillStyle(0x00ff88, 0.1);
    this.rangeCircle.fillCircle(this.x, this.y, this.range);
  }

  public upgrade(): boolean {
    if (this.level >= this.turretData.maxLevel) {
      return false;
    }

    const upgradeCost = this.getUpgradeCost();
    if (!this.scene.resourceManager.canAfford(upgradeCost)) {
      return false;
    }

    this.scene.resourceManager.spend(upgradeCost);
    this.level++;

    // Apply level stat increases
    const upgraded = getUpgradedStats(this.turretType, this.level);
    this.damage = upgraded.damage || this.damage;
    this.range = upgraded.range || this.range;
    this.fireRate = upgraded.fireRate || this.fireRate;

    // Update visuals
    this.updateRangeCircle();

    // Visual feedback
    this.scene.tweens.add({
      targets: this.baseSprite,
      scale: 1.2,
      duration: 100,
      yoyo: true
    });

    return true;
  }

  public getUpgradeCost(): { [key: string]: number } {
    if (this.level >= this.turretData.maxLevel) {
      return {};
    }
    return this.turretData.upgradeCosts[this.level - 1] || {};
  }

  public applyUpgrade(upgradeId: string, effect: {
    damage?: number;
    range?: number;
    fireRate?: number;
    aoe?: number;
    slow?: number;
    slowDuration?: number;
    chainTargets?: number;
    critChance?: number;
    critDamage?: number;
  }): void {
    if (this.appliedUpgrades.includes(upgradeId)) return;

    this.appliedUpgrades.push(upgradeId);

    if (effect.damage) this.damage = Math.floor(this.damage * effect.damage);
    if (effect.range) this.range = Math.floor(this.range * effect.range);
    if (effect.fireRate) this.fireRate = this.fireRate * effect.fireRate;
    if (effect.aoe) this.aoe = Math.floor(this.aoe * effect.aoe);
    if (effect.slow) this.slow = this.slow * effect.slow;
    if (effect.slowDuration) this.slowDuration = this.slowDuration * effect.slowDuration;
    if (effect.chainTargets) this.chainTargets += effect.chainTargets;
    if (effect.critChance) this.critChance = effect.critChance;
    if (effect.critDamage) this.critMultiplier = effect.critDamage;

    this.updateRangeCircle();
  }

  public sell(): number {
    // Return 50% of total cost
    let totalCost = 0;

    // Base cost
    Object.values(this.turretData.cost).forEach(v => totalCost += v);

    // Upgrade costs
    for (let i = 0; i < this.level - 1; i++) {
      const upgradeCost = this.turretData.upgradeCosts[i];
      if (upgradeCost) {
        Object.values(upgradeCost).forEach(v => totalCost += v);
      }
    }

    const refund = Math.floor(totalCost * 0.5);

    // Add refund to resources (returned as basic materials)
    this.scene.resourceManager.add({ [MaterialType.CARBOX]: refund });

    // Remove from grid
    this.scene.pathManager.setOccupied(this.gridX, this.gridY, false);

    // Destroy
    this.rangeCircle.destroy();
    this.destroy();

    return refund;
  }

  public getData(): TurretData {
    return this.turretData;
  }

  public getCurrentDPS(): number {
    return this.damage * this.fireRate;
  }

  /**
   * Set this turret as coming from inventory
   */
  public setFromInventory(inventoryId: string): void {
    this.inventoryId = inventoryId;
  }

  /**
   * Check if this turret is from inventory
   */
  public isFromInventory(): boolean {
    return this.inventoryId !== null;
  }

  /**
   * Restore turret state from inventory instance
   */
  public restoreFromInstance(instance: TurretInstance): void {
    this.inventoryId = instance.id;
    this.level = instance.level;

    // Apply level stats
    if (this.level > 1) {
      const upgraded = getUpgradedStats(this.turretType, this.level);
      this.damage = upgraded.damage || this.damage;
      this.range = upgraded.range || this.range;
      this.fireRate = upgraded.fireRate || this.fireRate;
    }

    // Re-apply upgrades
    this.appliedUpgrades = [...instance.appliedUpgrades];
    this.updateRangeCircle();
  }

  /**
   * Export turret state as inventory instance for saving
   */
  public toInventoryInstance(): TurretInstance {
    return {
      id: this.inventoryId || `turret_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: this.turretType.toString(),
      level: this.level,
      appliedUpgrades: [...this.appliedUpgrades]
    };
  }
}
