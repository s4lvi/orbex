import Phaser from 'phaser';
import { DEPTH, COLORS } from '../utils/Constants';
import { GameScene } from '../scenes/GameScene';
import { OrbitalWeaponType, getScaledOrbitalWeaponStats } from '../data/orbitalWeapons';

/**
 * OrbitalStrike - Visual effect for orbital weapon impacts
 */
export class OrbitalStrike extends Phaser.GameObjects.Container {
  public scene: GameScene;
  private weaponType: OrbitalWeaponType;
  private level: number;

  constructor(scene: GameScene, x: number, y: number, weaponType: OrbitalWeaponType, level: number) {
    super(scene, x, y);

    this.scene = scene;
    this.weaponType = weaponType;
    this.level = level;

    this.setDepth(DEPTH.ORBITAL_STRIKE);

    // Create visual effect based on weapon type
    this.createEffect();
  }

  private createEffect(): void {
    const scaled = getScaledOrbitalWeaponStats(this.weaponType, this.level);

    switch (this.weaponType) {
      case OrbitalWeaponType.ORBITAL_LASER:
        this.createLaserEffect();
        break;
      case OrbitalWeaponType.KINETIC_STRIKE:
        this.createKineticEffect(scaled.aoeRadius);
        break;
      case OrbitalWeaponType.CRYO_BOMB:
        this.createCryoEffect(scaled.aoeRadius);
        break;
      case OrbitalWeaponType.EMP_PULSE:
        this.createEMPEffect(scaled.aoeRadius);
        break;
      case OrbitalWeaponType.PLASMA_BARRAGE:
        this.createPlasmaEffect(scaled.aoeRadius);
        break;
      default:
        this.createDefaultEffect();
    }
  }

  private createLaserEffect(): void {
    // Beam from top of screen
    const beam = this.scene.add.graphics();
    beam.lineStyle(6, 0xff3300, 1);
    beam.lineBetween(0, -500, 0, 0);
    this.add(beam);

    // Impact flash
    const flash = this.scene.add.graphics();
    flash.fillStyle(0xff6600, 1);
    flash.fillCircle(0, 0, 20);
    this.add(flash);

    // Animate
    this.scene.tweens.add({
      targets: beam,
      alpha: 0,
      duration: 300,
      ease: 'Power2'
    });

    this.scene.tweens.add({
      targets: flash,
      scale: 2,
      alpha: 0,
      duration: 400,
      ease: 'Power2',
      onComplete: () => this.destroy()
    });

    // Screen shake
    this.scene.cameras.main.shake(100, 0.005);
  }

  private createKineticEffect(radius: number): void {
    // Impact crater
    const crater = this.scene.add.graphics();
    crater.fillStyle(0x333333, 1);
    crater.fillCircle(0, 0, radius * 0.8);
    crater.lineStyle(4, 0x666666, 1);
    crater.strokeCircle(0, 0, radius * 0.8);
    this.add(crater);

    // Shockwave
    const shockwave = this.scene.add.graphics();
    shockwave.lineStyle(8, 0xaaaaaa, 1);
    shockwave.strokeCircle(0, 0, 10);
    this.add(shockwave);

    // Debris particles
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const debris = this.scene.add.rectangle(0, 0, 8, 8, 0x555555);
      this.add(debris);

      this.scene.tweens.add({
        targets: debris,
        x: Math.cos(angle) * radius * 1.5,
        y: Math.sin(angle) * radius * 1.5,
        alpha: 0,
        rotation: Math.PI * 2,
        duration: 600,
        ease: 'Power2'
      });
    }

    // Animate shockwave
    this.scene.tweens.add({
      targets: shockwave,
      scale: radius / 10,
      alpha: 0,
      duration: 500,
      ease: 'Power2',
      onComplete: () => this.destroy()
    });

    // Heavy screen shake
    this.scene.cameras.main.shake(300, 0.02);
  }

  private createCryoEffect(radius: number): void {
    // Ice field
    const field = this.scene.add.graphics();
    field.fillStyle(0x88ddff, 0.3);
    field.fillCircle(0, 0, radius);
    field.lineStyle(3, 0x44aaff, 0.8);
    field.strokeCircle(0, 0, radius);
    this.add(field);

    // Ice crystals
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const dist = radius * 0.6;
      const crystal = this.scene.add.graphics();
      crystal.fillStyle(0xccffff, 0.8);
      crystal.fillTriangle(-5, 10, 5, 10, 0, -15);
      crystal.x = Math.cos(angle) * dist;
      crystal.y = Math.sin(angle) * dist;
      crystal.rotation = angle + Math.PI / 2;
      this.add(crystal);
    }

    // Animate
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 1500,
      ease: 'Power2',
      onComplete: () => this.destroy()
    });

    // Light screen shake
    this.scene.cameras.main.shake(150, 0.008);
  }

  private createEMPEffect(radius: number): void {
    // Electromagnetic rings
    for (let i = 0; i < 3; i++) {
      const ring = this.scene.add.graphics();
      ring.lineStyle(4, 0xffff00, 0.8);
      ring.strokeCircle(0, 0, 10);
      this.add(ring);

      this.scene.tweens.add({
        targets: ring,
        scale: radius / 10 + i * 2,
        alpha: 0,
        duration: 600 + i * 200,
        ease: 'Power2'
      });
    }

    // Center flash
    const flash = this.scene.add.graphics();
    flash.fillStyle(0xffffaa, 1);
    flash.fillCircle(0, 0, 30);
    this.add(flash);

    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 300,
      ease: 'Power2',
      onComplete: () => this.destroy()
    });

    // Screen shake
    this.scene.cameras.main.shake(200, 0.01);
  }

  private createPlasmaEffect(radius: number): void {
    // Multiple plasma impacts
    const impactCount = 5;
    for (let i = 0; i < impactCount; i++) {
      const delay = i * 150;
      const offsetX = (Math.random() - 0.5) * radius;
      const offsetY = (Math.random() - 0.5) * radius;

      this.scene.time.delayedCall(delay, () => {
        // Plasma explosion
        const explosion = this.scene.add.graphics();
        explosion.fillStyle(0xff00ff, 0.8);
        explosion.fillCircle(offsetX, offsetY, 15);
        this.add(explosion);

        // Expand and fade
        this.scene.tweens.add({
          targets: explosion,
          scale: 3,
          alpha: 0,
          duration: 400,
          ease: 'Power2'
        });

        // Screen shake on each impact
        this.scene.cameras.main.shake(100, 0.005);
      });
    }

    // Cleanup after all impacts
    this.scene.time.delayedCall(impactCount * 150 + 500, () => {
      this.destroy();
    });
  }

  private createDefaultEffect(): void {
    // Generic impact
    const impact = this.scene.add.graphics();
    impact.fillStyle(COLORS.PRIMARY, 1);
    impact.fillCircle(0, 0, 20);
    this.add(impact);

    this.scene.tweens.add({
      targets: impact,
      scale: 3,
      alpha: 0,
      duration: 500,
      ease: 'Power2',
      onComplete: () => this.destroy()
    });

    this.scene.cameras.main.shake(100, 0.005);
  }
}
