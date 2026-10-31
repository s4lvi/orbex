import Phaser from 'phaser';
import { DEPTH, DamageType, TILE_SIZE } from '../utils/Constants';
import { GameScene } from '../scenes/GameScene';
import { Enemy } from './Enemy';
import { Turret } from './Turret';
import { Poolable } from '../utils/ObjectPool';

export interface ProjectileData {
  damage: number;
  damageType: string;
  speed: number;
  texture: string;
  aoe?: number;
  slow?: number;
  slowDuration?: number;
  piercing?: boolean;
  pierceFalloff?: number;
  chainTargets?: number;
  dotDamage?: number;
  dotDuration?: number;
  critChance?: number;
  critMultiplier?: number;
  armorPenetration?: number;
  stunOnHit?: number;
  bonusVsSlowed?: number;
  novaOnKill?: number;
  homing?: boolean;
  target?: Enemy | null;
  sourceTurret?: Turret | null;
}

const HOMING_TURN_RATE = 6; // radians per second
const HIT_RADIUS_SQ = 20 * 20;

export class Projectile extends Phaser.GameObjects.Sprite implements Poolable {
  public scene: GameScene;

  private damage: number = 0;
  private damageType: DamageType = DamageType.KINETIC;
  private speed: number = 0;
  private aoe: number = 0;
  private slow: number = 0;
  private slowDuration: number = 0;
  private dotDamage: number = 0;
  private dotDuration: number = 0;
  private critChance: number = 0;
  private critMultiplier: number = 1;
  private armorPenetration: number = 0;
  private stunOnHit: number = 0;
  private bonusVsSlowed: number = 1;
  private novaOnKill: number = 0;
  private homing: boolean = false;
  private target: Enemy | null = null;

  private velocityX: number = 0;
  private velocityY: number = 0;

  private piercing: boolean = false;
  private pierceFalloff: number = 0;
  private hitEnemies: Set<Enemy> = new Set();

  private chainTargets: number = 0;
  private chainedEnemies: Set<Enemy> = new Set();

  private sourceTurret: Turret | null = null;

  private maxLifetime: number = 3000;
  private lifetime: number = 0;

  constructor(scene: GameScene, x: number, y: number) {
    super(scene, x, y, 'projectile-bullet');
    this.scene = scene;
    this.setDepth(DEPTH.PROJECTILE);
    this.setActive(false);
    this.setVisible(false);
  }

  public fire(targetX: number, targetY: number, data: ProjectileData): void {
    this.setActive(true);
    this.setVisible(true);

    this.damage = data.damage;
    this.damageType = data.damageType as DamageType;
    this.speed = data.speed;
    this.setTexture(data.texture);

    this.aoe = data.aoe || 0;
    this.slow = data.slow || 0;
    this.slowDuration = data.slowDuration || 0;
    this.piercing = data.piercing || false;
    this.pierceFalloff = data.pierceFalloff ?? 0;
    this.chainTargets = data.chainTargets || 0;
    this.dotDamage = data.dotDamage || 0;
    this.dotDuration = data.dotDuration || 0;
    this.critChance = data.critChance || 0;
    this.critMultiplier = data.critMultiplier || 1;
    this.armorPenetration = data.armorPenetration || 0;
    this.stunOnHit = data.stunOnHit || 0;
    this.bonusVsSlowed = data.bonusVsSlowed || 1;
    this.novaOnKill = data.novaOnKill || 0;
    this.homing = data.homing || false;
    this.target = data.target || null;
    this.sourceTurret = data.sourceTurret || null;

    this.setVelocityToward(targetX, targetY);

    this.lifetime = 0;
    this.hitEnemies.clear();
    this.chainedEnemies.clear();
  }

  private setVelocityToward(x: number, y: number): void {
    const dx = x - this.x;
    const dy = y - this.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 0) {
      this.velocityX = (dx / distance) * this.speed;
      this.velocityY = (dy / distance) * this.speed;
    } else {
      this.velocityX = 0;
      this.velocityY = 0;
    }
    this.rotation = Math.atan2(this.velocityY, this.velocityX);
  }

  public preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (!this.active) return;

    const dt = this.scene.getSimDelta(delta);
    if (dt <= 0) return;

    if (this.homing && this.target && this.target.active) {
      this.steerToward(this.target.x, this.target.y, dt);
    }

    this.x += this.velocityX * (dt / 1000);
    this.y += this.velocityY * (dt / 1000);

    this.lifetime += dt;
    if (this.lifetime > this.maxLifetime) {
      this.deactivate();
      return;
    }

    const worldWidth = this.scene.gridWidth * TILE_SIZE;
    const worldHeight = this.scene.gridHeight * TILE_SIZE;
    const margin = 100;
    if (this.x < -margin || this.x > worldWidth + margin || this.y < -margin || this.y > worldHeight + margin) {
      this.deactivate();
    }
  }

  private steerToward(x: number, y: number, dt: number): void {
    const current = Math.atan2(this.velocityY, this.velocityX);
    const desired = Math.atan2(y - this.y, x - this.x);
    const maxTurn = HOMING_TURN_RATE * (dt / 1000);
    const next = Phaser.Math.Angle.RotateTo(current, desired, maxTurn);
    this.velocityX = Math.cos(next) * this.speed;
    this.velocityY = Math.sin(next) * this.speed;
    this.rotation = next;
  }

  /** Squared distance test used by the scene's collision pass. */
  public overlaps(enemy: Enemy): boolean {
    const dx = this.x - enemy.x;
    const dy = this.y - enemy.y;
    return dx * dx + dy * dy < HIT_RADIUS_SQ;
  }

  public hit(enemy: Enemy, allEnemies: Enemy[]): void {
    if (this.hitEnemies.has(enemy)) return;
    const pierceIndex = this.hitEnemies.size;
    this.hitEnemies.add(enemy);

    let damage = this.damage * Math.max(0, 1 - this.pierceFalloff * pierceIndex);
    if (this.bonusVsSlowed > 1 && enemy.hasStatusEffect('slow')) {
      damage *= this.bonusVsSlowed;
    }

    const result = this.scene.damageSystem.calculateDamage(
      damage,
      this.damageType,
      enemy.getData(),
      enemy.getArmor(),
      {
        critChance: this.critChance,
        critMultiplier: this.critMultiplier,
        armorPenetration: this.armorPenetration
      }
    );

    if (!result.wasEvaded) {
      const impactX = enemy.x;
      const impactY = enemy.y;
      enemy.takeDamage(result.finalDamage, true, this.sourceTurret);

      if (enemy.active) {
        if (this.slow > 0) enemy.applyStatusEffect('slow', this.slow, this.slowDuration);
        if (this.dotDamage > 0) enemy.applyStatusEffect('dot', this.dotDamage, this.dotDuration, this.damageType);
        if (this.stunOnHit > 0) enemy.applyStatusEffect('stun', 1, this.stunOnHit);
      } else if (this.novaOnKill > 0) {
        this.dealAreaDamage(impactX, impactY, this.aoe || 60, this.damage * this.novaOnKill, allEnemies, enemy);
        this.showAOEEffect(impactX, impactY, this.aoe || 60);
      }

      this.showHitEffect(impactX, impactY, result.isCritical);
    }

    if (this.aoe > 0) {
      this.dealAreaDamage(enemy.x, enemy.y, this.aoe, this.damage, allEnemies, enemy);
      this.showAOEEffect(enemy.x, enemy.y, this.aoe);
    }

    if (this.chainTargets > 0) {
      this.handleChain(enemy, allEnemies);
    }

    if (!this.piercing) {
      this.deactivate();
    }
  }

  private dealAreaDamage(x: number, y: number, radius: number, damage: number, allEnemies: Enemy[], exclude: Enemy): void {
    for (const enemy of allEnemies) {
      if (enemy === exclude || !enemy.active) continue;
      const distance = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
      if (distance > radius) continue;

      const result = this.scene.damageSystem.calculateAOEDamage(
        damage, this.damageType, distance, radius, enemy.getData(), enemy.getArmor()
      );
      if (result.wasEvaded) continue;

      enemy.takeDamage(result.finalDamage, true, this.sourceTurret);
      if (enemy.active && this.slow > 0) {
        enemy.applyStatusEffect('slow', this.slow, this.slowDuration);
      }
    }
  }

  private handleChain(sourceEnemy: Enemy, allEnemies: Enemy[]): void {
    this.chainedEnemies.add(sourceEnemy);

    let currentEnemy: Enemy = sourceEnemy;
    let chainsRemaining = this.chainTargets;
    let currentDamage = this.damage;

    while (chainsRemaining > 0) {
      let closestEnemy: Enemy | null = null;
      let closestDistance = 150;

      for (const enemy of allEnemies) {
        if (!enemy.active || this.chainedEnemies.has(enemy)) continue;
        const distance = Phaser.Math.Distance.Between(currentEnemy.x, currentEnemy.y, enemy.x, enemy.y);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestEnemy = enemy;
        }
      }
      if (!closestEnemy) break;

      currentDamage *= 0.8; // each arc loses 20%

      const result = this.scene.damageSystem.calculateDamage(
        currentDamage, this.damageType, closestEnemy.getData(), closestEnemy.getArmor()
      );

      this.showChainEffect(currentEnemy.x, currentEnemy.y, closestEnemy.x, closestEnemy.y);
      if (!result.wasEvaded) {
        closestEnemy.takeDamage(result.finalDamage, true, this.sourceTurret);
        if (closestEnemy.active && this.stunOnHit > 0) {
          closestEnemy.applyStatusEffect('stun', 1, this.stunOnHit);
        }
      }

      this.chainedEnemies.add(closestEnemy);
      currentEnemy = closestEnemy;
      chainsRemaining--;
    }
  }

  private showHitEffect(x: number, y: number, isCritical: boolean): void {
    const particles = this.scene.add.particles(x, y, this.texture.key, {
      speed: { min: 30, max: 80 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.5, end: 0 },
      lifespan: 200,
      emitting: false
    });
    particles.setDepth(DEPTH.EFFECTS);
    particles.explode(isCritical ? 10 : 5);
    this.scene.time.delayedCall(250, () => particles.destroy());
  }

  private showAOEEffect(x: number, y: number, radius: number): void {
    const circle = this.scene.add.circle(x, y, radius, this.getDamageTypeColor(), 0.3);
    circle.setDepth(DEPTH.EFFECTS);
    this.scene.tweens.add({
      targets: circle,
      alpha: 0,
      scale: 1.2,
      duration: 300,
      onComplete: () => circle.destroy()
    });
  }

  private showChainEffect(fromX: number, fromY: number, toX: number, toY: number): void {
    const graphics = this.scene.add.graphics();
    graphics.setDepth(DEPTH.EFFECTS);
    graphics.lineStyle(2, 0xffff00, 0.8);
    graphics.lineBetween(fromX, fromY, toX, toY);
    this.scene.tweens.add({
      targets: graphics,
      alpha: 0,
      duration: 150,
      onComplete: () => graphics.destroy()
    });
  }

  private getDamageTypeColor(): number {
    return this.scene.damageSystem.getDamageTypeColor(this.damageType);
  }

  private deactivate(): void {
    this.setActive(false);
    this.setVisible(false);
    this.reset();
  }

  public reset(): void {
    this.damage = 0;
    this.speed = 0;
    this.aoe = 0;
    this.slow = 0;
    this.slowDuration = 0;
    this.dotDamage = 0;
    this.dotDuration = 0;
    this.critChance = 0;
    this.critMultiplier = 1;
    this.armorPenetration = 0;
    this.stunOnHit = 0;
    this.bonusVsSlowed = 1;
    this.novaOnKill = 0;
    this.homing = false;
    this.target = null;
    this.sourceTurret = null;
    this.piercing = false;
    this.pierceFalloff = 0;
    this.chainTargets = 0;
    this.lifetime = 0;
    this.velocityX = 0;
    this.velocityY = 0;
    this.hitEnemies.clear();
    this.chainedEnemies.clear();
  }
}
