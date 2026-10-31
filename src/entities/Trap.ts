import Phaser from 'phaser';
import { DEPTH, TrapType, DamageType } from '../utils/Constants';
import { GameScene } from '../scenes/GameScene';
import { getTrapData, TrapData } from '../data/traps';
import { Enemy } from './Enemy';

export class Trap extends Phaser.GameObjects.Sprite {
  public scene: GameScene;
  public trapType: TrapType;
  private trapData: TrapData;

  public damage: number;
  public damageType: DamageType;
  public triggerRadius: number;
  public cooldown: number;
  public uses: number;

  private cooldownRemaining: number = 0;
  private usesRemaining: number;
  private dying: boolean = false;

  /** Enemies that already consumed a charge (single-hit traps only). */
  private hitEnemies: Set<Enemy> = new Set();

  private effectGraphics: Phaser.GameObjects.Graphics | null = null;

  constructor(scene: GameScene, x: number, y: number, type: TrapType) {
    super(scene, x, y, `trap-${type}`);

    this.scene = scene;
    this.trapType = type;
    this.trapData = getTrapData(type);

    this.damage = this.trapData.damage;
    this.damageType = this.trapData.damageType;
    this.triggerRadius = this.trapData.triggerRadius;
    this.cooldown = this.trapData.cooldown;
    this.uses = this.trapData.uses;
    this.usesRemaining = this.uses;

    this.setDepth(DEPTH.TRAP);
    this.setAlpha(0.8);

    if (this.trapType === TrapType.SLOWFIELD || this.trapType === TrapType.FIRE) {
      this.createEffectArea();
    }
  }

  private createEffectArea(): void {
    this.effectGraphics = this.scene.add.graphics();
    this.effectGraphics.setDepth(DEPTH.TRAP - 1);
    this.scene.getCameraManager().addGameObject(this.effectGraphics);

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

    const dt = this.scene.getSimDelta(delta);
    if (this.cooldownRemaining > 0) {
      this.cooldownRemaining -= dt;
    }
  }

  public isReady(): boolean {
    if (this.dying) return false;
    if (this.usesRemaining === 0) return false;
    return this.cooldownRemaining <= 0;
  }

  /** True if walking over the trap should consume a charge for this enemy. */
  public canTrigger(enemy: Enemy): boolean {
    if (!this.isReady()) return false;
    if (this.trapType === TrapType.SPIKE && this.hitEnemies.has(enemy)) return false;
    return true;
  }

  public trigger(enemy: Enemy, allEnemies: Enemy[]): void {
    if (!this.canTrigger(enemy)) return;

    switch (this.trapType) {
      case TrapType.SPIKE:
        this.hitEnemies.add(enemy);
        this.triggerSpike(enemy);
        break;
      case TrapType.SLOWFIELD:
        this.triggerSlowField(allEnemies);
        break;
      case TrapType.MINE:
        this.triggerMine(allEnemies);
        break;
      case TrapType.EMP:
        this.triggerEMP(allEnemies);
        break;
      case TrapType.FIRE:
        this.triggerFire(allEnemies);
        break;
    }

    if (this.usesRemaining > 0) {
      this.usesRemaining--;
    }
    this.cooldownRemaining = this.cooldown;

    if (this.usesRemaining === 0 && this.uses !== -1) {
      this.destroyTrap();
    }
  }

  private forEachEnemyInRadius(allEnemies: Enemy[], radius: number, fn: (enemy: Enemy, distance: number) => void): void {
    for (const e of allEnemies) {
      if (!e.active) continue;
      const distance = Phaser.Math.Distance.Between(this.x, this.y, e.x, e.y);
      if (distance <= radius) fn(e, distance);
    }
  }

  private triggerSpike(enemy: Enemy): void {
    const result = this.scene.damageSystem.calculateDamage(this.damage, this.damageType, enemy.getData(), enemy.getArmor());
    if (!result.wasEvaded) {
      enemy.takeDamage(result.finalDamage);
    }
    this.scene.tweens.add({ targets: this, alpha: 0.3, duration: 100, yoyo: true });
  }

  private triggerSlowField(allEnemies: Enemy[]): void {
    const aoeRadius = this.trapData.effect?.aoe || this.triggerRadius;
    const slow = this.trapData.effect?.slow || 0.4;
    this.forEachEnemyInRadius(allEnemies, aoeRadius, (e) => {
      e.applyStatusEffect('slow', slow, 500);
    });
  }

  private triggerMine(allEnemies: Enemy[]): void {
    const aoeRadius = this.trapData.effect?.aoe || 70;
    this.forEachEnemyInRadius(allEnemies, aoeRadius, (e, distance) => {
      const result = this.scene.damageSystem.calculateAOEDamage(
        this.damage, this.damageType, distance, aoeRadius, e.getData(), e.getArmor()
      );
      if (!result.wasEvaded) e.takeDamage(result.finalDamage);
    });
    this.showExplosionEffect(aoeRadius);
  }

  private triggerEMP(allEnemies: Enemy[]): void {
    const aoeRadius = this.trapData.effect?.aoe || 60;
    const stunDuration = this.trapData.effect?.stun || 1500;
    this.forEachEnemyInRadius(allEnemies, aoeRadius, (e) => {
      const result = this.scene.damageSystem.calculateDamage(this.damage, this.damageType, e.getData(), e.getArmor());
      if (!result.wasEvaded) {
        e.takeDamage(result.finalDamage);
        if (e.active) e.applyStatusEffect('stun', 1, stunDuration);
      }
    });
    this.showEMPEffect(aoeRadius);
  }

  private triggerFire(allEnemies: Enemy[]): void {
    const aoeRadius = this.trapData.effect?.aoe || 45;
    const dotDamage = this.trapData.effect?.dot || 3;
    const dotDuration = this.trapData.effect?.dotDuration || 3000;
    this.forEachEnemyInRadius(allEnemies, aoeRadius, (e) => {
      const result = this.scene.damageSystem.calculateDamage(this.damage, this.damageType, e.getData(), e.getArmor());
      if (!result.wasEvaded) {
        e.takeDamage(result.finalDamage);
        if (e.active) e.applyStatusEffect('dot', dotDamage, dotDuration, this.damageType);
      }
    });
  }

  private showExplosionEffect(radius: number): void {
    const circle = this.scene.add.circle(this.x, this.y, radius, 0xff6600, 0.5).setDepth(DEPTH.EFFECTS);
    this.scene.tweens.add({
      targets: circle,
      alpha: 0,
      scale: 1.5,
      duration: 300,
      onComplete: () => circle.destroy()
    });
    this.scene.cameras.main.shake(100, 0.005);
  }

  private showEMPEffect(radius: number): void {
    const circle = this.scene.add.circle(this.x, this.y, radius, 0xffff00, 0.6).setDepth(DEPTH.EFFECTS);
    this.scene.tweens.add({
      targets: circle,
      alpha: 0,
      scale: 1.3,
      duration: 400,
      onComplete: () => circle.destroy()
    });

    const graphics = this.scene.add.graphics().setDepth(DEPTH.EFFECTS);
    graphics.lineStyle(2, 0xffff00, 0.8);
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const endX = this.x + Math.cos(angle) * radius;
      const endY = this.y + Math.sin(angle) * radius;
      const midX = this.x + Math.cos(angle) * radius * 0.5 + Phaser.Math.Between(-10, 10);
      const midY = this.y + Math.sin(angle) * radius * 0.5 + Phaser.Math.Between(-10, 10);
      graphics.beginPath();
      graphics.moveTo(this.x, this.y);
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
    if (this.dying) return;
    this.dying = true;
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 200,
      onComplete: () => this.destroy()
    });
  }

  /** Phaser calls this from destroy(); drop the detached effect graphics. */
  public preDestroy(): void {
    this.effectGraphics?.destroy();
    this.effectGraphics = null;
  }

  public getData(): TrapData {
    return this.trapData;
  }

  public getUsesRemaining(): number {
    return this.usesRemaining;
  }
}
