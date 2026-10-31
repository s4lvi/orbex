import Phaser from 'phaser';
import { DEPTH, TurretType, DamageType, PIERCE_FALLOFF, SELL_REFUND_FRACTION } from '../utils/Constants';
import { GameScene } from '../scenes/GameScene';
import { getTurretData, TurretData, getLevelMultipliers } from '../data/turrets';
import { DataLoader } from '../systems/DataLoader';
import { Enemy } from './Enemy';
import { TurretInstance, TurretIdentity, MaterialCost, UpgradeEffect } from '../types/GameData';

/**
 * A placed turret. All combat stats are derived by `recalculateStats()` from
 * base data × level × applied upgrades × drop modifiers, so no code path can
 * accidentally overwrite another's contribution.
 */
export class Turret extends Phaser.GameObjects.Container {
  public scene: GameScene;
  public turretType: TurretType;
  private turretData: TurretData;

  public gridX: number;
  public gridY: number;

  public level: number = 1;
  public appliedUpgrades: string[] = [];

  // Derived stats
  public damage: number = 0;
  public damageType: DamageType;
  public range: number = 0;
  public fireRate: number = 0;
  public projectileSpeed: number = 0;
  public aoe: number = 0;
  public slow: number = 0;
  public slowDuration: number = 0;
  public chainTargets: number = 0;
  public piercing: boolean = false;
  public pierceFalloff: number = PIERCE_FALLOFF;
  public dotDamage: number = 0;
  public dotDuration: number = 0;
  public critChance: number = 0;
  public critMultiplier: number = 1;
  public armorPenetration: number = 0;
  public stunOnHit: number = 0;
  public homing: boolean = false;
  public bonusVsSlowed: number = 1;
  public novaOnKill: number = 0;

  private target: Enemy | null = null;
  private fireCooldown: number = 0;

  private baseSprite: Phaser.GameObjects.Sprite;
  private barrelSprite: Phaser.GameObjects.Sprite;
  private rangeCircle: Phaser.GameObjects.Graphics;

  /** Set when this turret came from the roster (free placement). */
  public inventoryId: string | null = null;

  public identity: TurretIdentity = {
    callsign: '',
    kills: 0,
    dropsSurvived: 0,
    createdAt: Date.now()
  };

  constructor(scene: GameScene, x: number, y: number, type: TurretType, gridX: number, gridY: number) {
    super(scene, x, y);

    this.scene = scene;
    this.turretType = type;
    this.gridX = gridX;
    this.gridY = gridY;
    this.turretData = getTurretData(type);
    this.damageType = this.turretData.damageType;

    // Range circle lives inside the container so it moves/destroys with it.
    this.rangeCircle = scene.add.graphics();
    this.rangeCircle.setVisible(false);
    this.add(this.rangeCircle);

    this.baseSprite = scene.add.sprite(0, 0, `turret-${type}`);
    this.add(this.baseSprite);

    // Gun art points +x; pivot it on the hub so it swivels around the mount.
    this.barrelSprite = scene.add.sprite(0, 0, `turret-${type}-gun`);
    this.barrelSprite.setOrigin(9 / 44, 0.5);
    this.add(this.barrelSprite);

    this.setDepth(DEPTH.TURRET);
    this.recalculateStats();
  }

  // ---------------------------------------------------------------- stats

  /** Rebuild every combat stat from scratch. */
  private recalculateStats(): void {
    const base = this.turretData;
    const lvl = getLevelMultipliers(this.level);

    let damage = base.damage * lvl.damage;
    let range = base.range * lvl.range;
    let fireRate = base.fireRate * lvl.fireRate;
    let projectileSpeed = base.projectileSpeed;
    let aoe = base.special?.aoe || 0;
    let slow = base.special?.slow || 0;
    let slowDuration = base.special?.slowDuration || 0;
    let chainTargets = base.special?.chainTargets || 0;
    let dotDamage = base.special?.dotDamage || 0;
    const dotDuration = base.special?.dotDuration || 0;
    const piercing = base.special?.piercing || false;
    let pierceFalloff = PIERCE_FALLOFF;
    let critChance = 0;
    let critMultiplier = 1;
    let armorPenetration = 0;
    let stunOnHit = 0;
    let homing = false;
    let bonusVsSlowed = 1;
    let novaOnKill = 0;

    for (const id of this.appliedUpgrades) {
      const upgrade = DataLoader.getUpgradeById(id);
      if (!upgrade) continue;
      const e: UpgradeEffect = upgrade.effect;
      if (e.damage) damage *= e.damage;
      if (e.range) range *= e.range;
      if (e.fireRate) fireRate *= e.fireRate;
      if (e.projectileSpeed) projectileSpeed *= e.projectileSpeed;
      if (e.aoe) aoe *= e.aoe;
      if (e.slow) slow = Math.min(0.9, slow * e.slow);
      if (e.slowDuration) slowDuration *= e.slowDuration;
      if (e.dotDamage) dotDamage *= e.dotDamage;
      if (e.chainTargets) chainTargets += e.chainTargets;
      if (e.critChance) critChance = Math.max(critChance, e.critChance);
      if (e.critDamage) critMultiplier = Math.max(critMultiplier, e.critDamage);
      if (e.armorPenetration) armorPenetration = Math.max(armorPenetration, e.armorPenetration);
      if (e.stunOnHit) stunOnHit = Math.max(stunOnHit, e.stunOnHit);
      if (e.homing) homing = true;
      if (e.pierceFalloff !== undefined) pierceFalloff = e.pierceFalloff;
      if (e.bonusVsSlowed) bonusVsSlowed = Math.max(bonusVsSlowed, e.bonusVsSlowed);
      if (e.novaOnKill) novaOnKill = Math.max(novaOnKill, e.novaOnKill);
    }

    // Drop modifiers (Dense Fog, Solar Flare, ...)
    const mods = this.scene.getTurretMultipliers(this.damageType);
    damage *= mods.damage;
    range *= mods.range;
    fireRate *= mods.fireRate;

    this.damage = Math.max(1, Math.floor(damage));
    this.range = Math.floor(range);
    this.fireRate = fireRate;
    this.projectileSpeed = projectileSpeed;
    this.aoe = Math.floor(aoe);
    this.slow = slow;
    this.slowDuration = slowDuration;
    this.chainTargets = chainTargets;
    this.piercing = piercing;
    this.pierceFalloff = pierceFalloff;
    this.dotDamage = dotDamage;
    this.dotDuration = dotDuration;
    this.critChance = critChance;
    this.critMultiplier = critMultiplier;
    this.armorPenetration = armorPenetration;
    this.stunOnHit = stunOnHit;
    this.homing = homing;
    this.bonusVsSlowed = bonusVsSlowed;
    this.novaOnKill = novaOnKill;

    this.updateRangeCircle();
  }

  // ---------------------------------------------------------------- combat

  public preUpdate(_time: number, delta: number): void {
    const dt = this.scene.getSimDelta(delta);
    if (this.fireCooldown > 0) {
      this.fireCooldown -= dt;
    }
  }

  public updateTargeting(enemies: Enemy[]): void {
    if (!this.target || !this.target.active || !this.isInRange(this.target)) {
      this.target = this.findBestTarget(enemies);
    }

    if (this.target) {
      this.aimAt(this.target);
      if (this.fireCooldown <= 0) {
        this.fire();
        this.fireCooldown = 1000 / this.fireRate;
      }
    }
  }

  /** Target the enemy furthest along its path (classic TD "first" priority). */
  private findBestTarget(enemies: Enemy[]): Enemy | null {
    let best: Enemy | null = null;
    let bestRemaining = Infinity;
    for (const enemy of enemies) {
      if (!enemy.active || !this.isInRange(enemy)) continue;
      const remaining = enemy.getRemainingPathDistance();
      if (remaining < bestRemaining) {
        bestRemaining = remaining;
        best = enemy;
      }
    }
    return best;
  }

  private isInRange(enemy: Enemy): boolean {
    return Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y) <= this.range;
  }

  private aimAt(target: Enemy): void {
    this.barrelSprite.rotation = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
  }

  private fire(): void {
    if (!this.target) return;

    // Lead the shot so fast enemies don't outrun straight-flying projectiles.
    let aimX = this.target.x;
    let aimY = this.target.y;
    if (!this.homing && this.projectileSpeed > 0) {
      const vel = this.target.getVelocity();
      const travelTime = Phaser.Math.Distance.Between(this.x, this.y, aimX, aimY) / this.projectileSpeed;
      aimX += vel.x * travelTime;
      aimY += vel.y * travelTime;
    }
    this.barrelSprite.rotation = Phaser.Math.Angle.Between(this.x, this.y, aimX, aimY);

    const muzzle = 30;
    this.scene.spawnProjectile(
      this.x + Math.cos(this.barrelSprite.rotation) * muzzle,
      this.y + Math.sin(this.barrelSprite.rotation) * muzzle,
      aimX,
      aimY,
      {
        damage: this.damage,
        damageType: this.damageType,
        speed: this.projectileSpeed,
        texture: this.getProjectileTexture(),
        aoe: this.aoe,
        slow: this.slow,
        slowDuration: this.slowDuration,
        chainTargets: this.chainTargets,
        piercing: this.piercing,
        pierceFalloff: this.pierceFalloff,
        dotDamage: this.dotDamage,
        dotDuration: this.dotDuration,
        critChance: this.critChance,
        critMultiplier: this.critMultiplier,
        armorPenetration: this.armorPenetration,
        stunOnHit: this.stunOnHit,
        bonusVsSlowed: this.bonusVsSlowed,
        novaOnKill: this.novaOnKill,
        homing: this.homing,
        target: this.target,
        sourceTurret: this
      }
    );

    this.scene.tweens.add({
      targets: this.barrelSprite,
      scaleX: 0.85,
      duration: 50,
      yoyo: true
    });
  }

  private getProjectileTexture(): string {
    switch (this.turretType) {
      case TurretType.LASER: return 'projectile-laser';
      case TurretType.CRYO: return 'projectile-cryo';
      case TurretType.TESLA: return 'projectile-electric';
      case TurretType.MISSILE: return 'projectile-missile';
      case TurretType.RAILGUN: return 'projectile-railgun';
      case TurretType.PLASMA: return 'projectile-plasma';
      case TurretType.MACHINEGUN:
      default:
        return 'projectile-bullet';
    }
  }

  // ---------------------------------------------------------------- visuals

  public setSelected(selected: boolean): void {
    if (!this.active) return;
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
    this.rangeCircle.strokeCircle(0, 0, this.range);
    this.rangeCircle.fillStyle(0x00ff88, 0.1);
    this.rangeCircle.fillCircle(0, 0, this.range);
  }

  // ---------------------------------------------------------------- progression

  public canUpgradeLevel(): boolean {
    return this.level < this.turretData.maxLevel;
  }

  public upgrade(): boolean {
    if (!this.canUpgradeLevel()) return false;

    const upgradeCost = this.getUpgradeCost();
    if (!this.scene.resourceManager.spend(upgradeCost)) return false;

    this.level++;
    this.recalculateStats();

    this.scene.tweens.add({
      targets: this.baseSprite,
      scale: 1.2,
      duration: 100,
      yoyo: true
    });
    return true;
  }

  public getUpgradeCost(): MaterialCost {
    if (!this.canUpgradeLevel()) return {};
    return this.turretData.upgradeCosts[this.level - 1] || {};
  }

  public applyUpgrade(upgradeId: string): void {
    if (this.appliedUpgrades.includes(upgradeId)) return;
    this.appliedUpgrades.push(upgradeId);
    this.recalculateStats();
  }

  /** Everything spent on this turret so far (purchase, levels, upgrades). */
  public getTotalInvestment(): MaterialCost {
    const total: MaterialCost = {};
    const addCost = (cost: MaterialCost) => {
      Object.entries(cost).forEach(([key, value]) => {
        total[key] = (total[key] || 0) + value;
      });
    };
    addCost(this.turretData.cost);
    for (let i = 0; i < this.level - 1; i++) {
      const cost = this.turretData.upgradeCosts[i];
      if (cost) addCost(cost);
    }
    for (const id of this.appliedUpgrades) {
      const upgrade = DataLoader.getUpgradeById(id);
      if (upgrade) addCost(upgrade.cost);
    }
    return total;
  }

  public getSellValue(): MaterialCost {
    const value: MaterialCost = {};
    Object.entries(this.getTotalInvestment()).forEach(([key, amount]) => {
      const refund = Math.floor(amount * SELL_REFUND_FRACTION);
      if (refund > 0) value[key] = refund;
    });
    return value;
  }

  /** Refund part of the investment and remove the turret. Returns what was refunded. */
  public sell(): MaterialCost {
    const refunded = this.scene.resourceManager.refund(this.getTotalInvestment(), SELL_REFUND_FRACTION);
    this.scene.pathManager.setOccupied(this.gridX, this.gridY, false);
    this.destroy();
    return refunded;
  }

  public getData(): TurretData {
    return this.turretData;
  }

  public getCurrentDPS(): number {
    return this.damage * this.fireRate;
  }

  // ---------------------------------------------------------------- roster persistence

  public isFromInventory(): boolean {
    return this.inventoryId !== null;
  }

  public restoreFromInstance(instance: TurretInstance): void {
    this.inventoryId = instance.id;
    this.level = Math.max(1, Math.min(instance.level, this.turretData.maxLevel));
    this.appliedUpgrades = [...instance.appliedUpgrades];
    if (instance.identity) {
      this.identity = { ...instance.identity };
    }
    this.recalculateStats();
  }

  public toInventoryInstance(): TurretInstance {
    return {
      id: this.inventoryId || `turret_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      type: this.turretType.toString(),
      level: this.level,
      appliedUpgrades: [...this.appliedUpgrades],
      identity: { ...this.identity }
    };
  }

  public recordKill(): void {
    this.identity.kills++;
  }
}
