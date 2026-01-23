import Phaser from 'phaser';
import { DEPTH, DamageType, GAME_WIDTH, GAME_HEIGHT } from '../utils/Constants';
import { GameScene } from '../scenes/GameScene';
import { Enemy } from './Enemy';

export class Projectile extends Phaser.GameObjects.Sprite {
  public scene: GameScene;

  // Projectile properties
  private damage: number = 0;
  private damageType: DamageType = DamageType.KINETIC;
  private speed: number = 0;
  private aoe: number = 0;
  private slow: number = 0;
  private slowDuration: number = 0;

  // Movement
  private velocityX: number = 0;
  private velocityY: number = 0;

  // Piercing
  private piercing: boolean = false;
  private hitEnemies: Set<Enemy> = new Set();

  // Chain lightning
  private chainTargets: number = 0;
  private chainedEnemies: Set<Enemy> = new Set();

  // Lifetime
  private maxLifetime: number = 3000;
  private lifetime: number = 0;

  constructor(scene: GameScene, x: number, y: number) {
    super(scene, x, y, 'projectile-bullet');

    this.scene = scene;
    this.setDepth(DEPTH.PROJECTILE);
    this.setActive(false);
    this.setVisible(false);
  }

  public fire(targetX: number, targetY: number, data: {
    damage: number;
    damageType: string;
    speed: number;
    texture: string;
    aoe?: number;
    slow?: number;
    slowDuration?: number;
    piercing?: boolean;
    chainTargets?: number;
  }): void {
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
    this.chainTargets = data.chainTargets || 0;

    // Calculate velocity
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    this.velocityX = (dx / distance) * this.speed;
    this.velocityY = (dy / distance) * this.speed;

    // Rotate to face direction
    this.rotation = Math.atan2(dy, dx);

    // Reset state
    this.lifetime = 0;
    this.hitEnemies.clear();
    this.chainedEnemies.clear();
  }

  public preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);

    if (!this.active) return;

    // Update position
    this.x += this.velocityX * (delta / 1000);
    this.y += this.velocityY * (delta / 1000);

    // Check lifetime
    this.lifetime += delta;
    if (this.lifetime > this.maxLifetime) {
      this.deactivate();
      return;
    }

    // Check bounds
    if (this.x < 0 || this.x > GAME_WIDTH || this.y < 0 || this.y > GAME_HEIGHT) {
      this.deactivate();
    }
  }

  public hit(enemy: Enemy, allEnemies: Enemy[]): void {
    // Skip if already hit this enemy (for piercing)
    if (this.hitEnemies.has(enemy)) return;
    this.hitEnemies.add(enemy);

    // Calculate damage
    const result = this.scene.damageSystem.calculateDamage(
      this.damage,
      this.damageType,
      enemy.getData(),
      enemy.getArmor()
    );

    if (!result.wasEvaded) {
      enemy.takeDamage(result.finalDamage);

      // Apply slow effect
      if (this.slow > 0) {
        enemy.applyStatusEffect('slow', this.slow, this.slowDuration);
      }

      // Show hit effect
      this.showHitEffect(enemy.x, enemy.y, result.isCritical);
    }

    // Handle AOE
    if (this.aoe > 0) {
      this.handleAOE(enemy, allEnemies);
    }

    // Handle chain lightning
    if (this.chainTargets > 0) {
      this.handleChain(enemy, allEnemies);
    }

    // Deactivate unless piercing
    if (!this.piercing) {
      this.deactivate();
    }
  }

  private handleAOE(centerEnemy: Enemy, allEnemies: Enemy[]): void {
    allEnemies.forEach(enemy => {
      if (enemy === centerEnemy || !enemy.active) return;

      const distance = Phaser.Math.Distance.Between(centerEnemy.x, centerEnemy.y, enemy.x, enemy.y);

      if (distance <= this.aoe) {
        const result = this.scene.damageSystem.calculateAOEDamage(
          this.damage,
          this.damageType,
          distance,
          this.aoe,
          enemy.getData(),
          enemy.getArmor()
        );

        if (!result.wasEvaded) {
          enemy.takeDamage(result.finalDamage);

          if (this.slow > 0) {
            enemy.applyStatusEffect('slow', this.slow, this.slowDuration);
          }
        }
      }
    });

    // Show AOE effect
    this.showAOEEffect(centerEnemy.x, centerEnemy.y);
  }

  private handleChain(sourceEnemy: Enemy, allEnemies: Enemy[]): void {
    this.chainedEnemies.add(sourceEnemy);

    let currentEnemy: Enemy = sourceEnemy;
    let chainsRemaining = this.chainTargets;
    let currentDamage = this.damage;

    while (chainsRemaining > 0) {
      // Find closest unchained enemy
      let closestEnemy: Enemy | null = null;
      let closestDistance = Infinity;

      for (const enemy of allEnemies) {
        if (!enemy.active || this.chainedEnemies.has(enemy)) continue;

        const distance = Phaser.Math.Distance.Between(currentEnemy.x, currentEnemy.y, enemy.x, enemy.y);

        if (distance < closestDistance && distance < 150) {
          closestDistance = distance;
          closestEnemy = enemy;
        }
      }

      if (!closestEnemy) break;

      // Chain damage reduces by 20% per chain
      currentDamage *= 0.8;

      const result = this.scene.damageSystem.calculateDamage(
        currentDamage,
        this.damageType,
        closestEnemy.getData(),
        closestEnemy.getArmor()
      );

      if (!result.wasEvaded) {
        closestEnemy.takeDamage(result.finalDamage);

        // Show chain effect
        this.showChainEffect(currentEnemy.x, currentEnemy.y, closestEnemy.x, closestEnemy.y);
      }

      this.chainedEnemies.add(closestEnemy);
      currentEnemy = closestEnemy;
      chainsRemaining--;
    }
  }

  private showHitEffect(x: number, y: number, isCritical: boolean): void {
    // Simple particle burst
    const particles = this.scene.add.particles(x, y, this.texture.key, {
      speed: { min: 30, max: 80 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.5, end: 0 },
      lifespan: 200,
      quantity: isCritical ? 10 : 5
    });

    this.scene.time.delayedCall(200, () => particles.destroy());
  }

  private showAOEEffect(x: number, y: number): void {
    const circle = this.scene.add.circle(x, y, this.aoe, this.getDamageTypeColor(), 0.3);

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
    graphics.lineStyle(2, 0xffff00, 0.8);
    graphics.beginPath();
    graphics.moveTo(fromX, fromY);
    graphics.lineTo(toX, toY);
    graphics.strokePath();

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
  }

  public reset(): void {
    this.damage = 0;
    this.speed = 0;
    this.aoe = 0;
    this.slow = 0;
    this.slowDuration = 0;
    this.piercing = false;
    this.chainTargets = 0;
    this.lifetime = 0;
    this.hitEnemies.clear();
    this.chainedEnemies.clear();
  }
}
