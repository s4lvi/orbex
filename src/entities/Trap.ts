import Phaser from 'phaser';
import { DEPTH, TrapType, DamageType } from '../utils/Constants';
import { GameScene } from '../scenes/GameScene';
import { getTrapData, TrapData } from '../data/traps';
import { Enemy } from './Enemy';

export class Trap extends Phaser.GameObjects.Sprite {
  public scene: GameScene;
  public trapType: TrapType;
  private trapData: TrapData;

  // Stats
  public damage: number;
  public damageType: DamageType;
  public triggerRadius: number;
  public cooldown: number;
  public uses: number;

  // State
  private cooldownRemaining: number = 0;
  private usesRemaining: number;

  // Effects
  private effectGraphics: Phaser.GameObjects.Graphics | null = null;

  constructor(scene: GameScene, x: number, y: number, type: TrapType) {
    super(scene, x, y, `trap-${type}`);

    this.scene = scene;
    this.trapType = type;
    this.trapData = getTrapData(type);

    // Initialize stats
    this.damage = this.trapData.damage;
    this.damageType = this.trapData.damageType;
    this.triggerRadius = this.trapData.triggerRadius;
    this.cooldown = this.trapData.cooldown;
    this.uses = this.trapData.uses;
    this.usesRemaining = this.uses;

    this.setDepth(DEPTH.TRAP);
    this.setAlpha(0.8);

    // Create persistent effect visualization for certain traps
    if (this.trapType === TrapType.SLOWFIELD || this.trapType === TrapType.FIRE) {
      this.createEffectArea();
    }
  }

  private createEffectArea(): void {
    this.effectGraphics = this.scene.add.graphics();
    this.effectGraphics.setDepth(DEPTH.TRAP - 1);

    const color = this.trapType === TrapType.SLOWFIELD ? 0x4444ff : 0xff6600;
    const radius = this.trapData.effect?.aoe || this.triggerRadius;

    this.effectGraphics.fillStyle(color, 0.2);
    this.effectGraphics.fillCircle(this.x, this.y, radius);
    this.effectGraphics.lineStyle(1, color, 0.5);
    this.effectGraphics.strokeCircle(this.x, this.y, radius);
  }

  public preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);

    if (!this.active) return;

    // Update cooldown
    if (this.cooldownRemaining > 0) {
      this.cooldownRemaining -= delta;
    }
  }

  public isReady(): boolean {
    if (this.usesRemaining === 0) return false;
    return this.cooldownRemaining <= 0;
  }

  public trigger(enemy: Enemy, allEnemies: Enemy[]): void {
    if (!this.isReady()) return;

    switch (this.trapType) {
      case TrapType.SPIKE:
        this.triggerSpike(enemy);
        break;
      case TrapType.SLOWFIELD:
        this.triggerSlowField(enemy, allEnemies);
        break;
      case TrapType.MINE:
        this.triggerMine(enemy, allEnemies);
        break;
      case TrapType.EMP:
        this.triggerEMP(enemy, allEnemies);
        break;
      case TrapType.FIRE:
        this.triggerFire(enemy, allEnemies);
        break;
    }

    // Use up a charge
    if (this.usesRemaining > 0) {
      this.usesRemaining--;
    }

    // Start cooldown
    this.cooldownRemaining = this.cooldown;

    // Destroy if out of uses
    if (this.usesRemaining === 0 && this.uses !== -1) {
      this.destroyTrap();
    }
  }

  private triggerSpike(enemy: Enemy): void {
    const result = this.scene.damageSystem.calculateDamage(
      this.damage,
      this.damageType,
      enemy.getData(),
      enemy.getArmor()
    );

    if (!result.wasEvaded) {
      enemy.takeDamage(result.finalDamage);
    }

    // Visual effect
    this.showHitEffect();
  }

  private triggerSlowField(_enemy: Enemy, allEnemies: Enemy[]): void {
    const aoeRadius = this.trapData.effect?.aoe || this.triggerRadius;

    allEnemies.forEach(e => {
      if (!e.active) return;

      const distance = Phaser.Math.Distance.Between(this.x, this.y, e.x, e.y);
      if (distance <= aoeRadius) {
        e.applyStatusEffect('slow', this.trapData.effect?.slow || 0.4, 500);
      }
    });
  }

  private triggerMine(_enemy: Enemy, allEnemies: Enemy[]): void {
    const aoeRadius = this.trapData.effect?.aoe || 70;

    // Damage all enemies in range
    allEnemies.forEach(e => {
      if (!e.active) return;

      const distance = Phaser.Math.Distance.Between(this.x, this.y, e.x, e.y);
      if (distance <= aoeRadius) {
        const result = this.scene.damageSystem.calculateAOEDamage(
          this.damage,
          this.damageType,
          distance,
          aoeRadius,
          e.getData(),
          e.getArmor()
        );

        if (!result.wasEvaded) {
          e.takeDamage(result.finalDamage);
        }
      }
    });

    // Explosion effect
    this.showExplosionEffect(aoeRadius);
  }

  private triggerEMP(_enemy: Enemy, allEnemies: Enemy[]): void {
    const aoeRadius = this.trapData.effect?.aoe || 60;
    const stunDuration = this.trapData.effect?.stun || 1500;

    // Stun all enemies in range
    allEnemies.forEach(e => {
      if (!e.active) return;

      const distance = Phaser.Math.Distance.Between(this.x, this.y, e.x, e.y);
      if (distance <= aoeRadius) {
        // Small damage
        const result = this.scene.damageSystem.calculateDamage(
          this.damage,
          this.damageType,
          e.getData(),
          e.getArmor()
        );

        if (!result.wasEvaded) {
          e.takeDamage(result.finalDamage);
          e.applyStatusEffect('stun', 1, stunDuration);
        }
      }
    });

    // EMP visual effect
    this.showEMPEffect(aoeRadius);
  }

  private triggerFire(_enemy: Enemy, allEnemies: Enemy[]): void {
    const aoeRadius = this.trapData.effect?.aoe || 45;
    const dotDamage = this.trapData.effect?.dot || 3;
    const dotDuration = this.trapData.effect?.dotDuration || 3000;

    // Apply DOT to all enemies in range
    allEnemies.forEach(e => {
      if (!e.active) return;

      const distance = Phaser.Math.Distance.Between(this.x, this.y, e.x, e.y);
      if (distance <= aoeRadius) {
        // Initial damage
        const result = this.scene.damageSystem.calculateDamage(
          this.damage,
          this.damageType,
          e.getData(),
          e.getArmor()
        );

        if (!result.wasEvaded) {
          e.takeDamage(result.finalDamage);
          e.applyStatusEffect('dot', dotDamage, dotDuration, this.damageType);
        }
      }
    });
  }

  private showHitEffect(): void {
    this.scene.tweens.add({
      targets: this,
      alpha: 0.3,
      duration: 100,
      yoyo: true
    });
  }

  private showExplosionEffect(radius: number): void {
    const circle = this.scene.add.circle(this.x, this.y, radius, 0xff6600, 0.5);

    this.scene.tweens.add({
      targets: circle,
      alpha: 0,
      scale: 1.5,
      duration: 300,
      onComplete: () => circle.destroy()
    });

    // Screen shake
    this.scene.cameras.main.shake(100, 0.005);
  }

  private showEMPEffect(radius: number): void {
    const circle = this.scene.add.circle(this.x, this.y, radius, 0xffff00, 0.6);

    this.scene.tweens.add({
      targets: circle,
      alpha: 0,
      scale: 1.3,
      duration: 400,
      onComplete: () => circle.destroy()
    });

    // Draw electric arcs
    const graphics = this.scene.add.graphics();
    graphics.lineStyle(2, 0xffff00, 0.8);

    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const endX = this.x + Math.cos(angle) * radius;
      const endY = this.y + Math.sin(angle) * radius;

      graphics.beginPath();
      graphics.moveTo(this.x, this.y);

      // Jagged line
      const midX = this.x + Math.cos(angle) * radius * 0.5 + Phaser.Math.Between(-10, 10);
      const midY = this.y + Math.sin(angle) * radius * 0.5 + Phaser.Math.Between(-10, 10);
      graphics.lineTo(midX, midY);
      graphics.lineTo(endX, endY);
      graphics.strokePath();
    }

    this.scene.tweens.add({
      targets: graphics,
      alpha: 0,
      duration: 200,
      onComplete: () => graphics.destroy()
    });
  }

  private destroyTrap(): void {
    if (this.effectGraphics) {
      this.effectGraphics.destroy();
    }

    // Fade out
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 200,
      onComplete: () => {
        this.setActive(false);
        this.setVisible(false);
        this.destroy();
      }
    });
  }

  public getData(): TrapData {
    return this.trapData;
  }

  public getUsesRemaining(): number {
    return this.usesRemaining;
  }
}
