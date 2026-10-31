import Phaser from 'phaser';
import { DEPTH, DamageType, DOT_TICK_MS } from '../utils/Constants';
import { GameScene } from '../scenes/GameScene';
import { getEnemyData, EnemyData } from '../data/enemies';
import { PathPoint } from '../systems/PathManager';
import { ELITE_MODIFIERS, WaveDifficultyConfig } from '../systems/DifficultyManager';
import { Turret } from './Turret';

interface StatusEffect {
  type: 'slow' | 'dot' | 'stun';
  value: number;
  duration: number;
  remaining: number;
  damageType?: DamageType;
}

export class Enemy extends Phaser.GameObjects.Sprite {
  public scene: GameScene;
  public enemyType: string;
  private enemyData: EnemyData;

  public isElite: boolean = false;

  // Stats
  public maxHealth: number;
  public currentHealth: number;
  public armor: number;
  public baseSpeed: number;
  public currentSpeed: number;
  public damage: number;
  public energyReward: number;

  // Path following
  private path: PathPoint[] = [];
  private pathIndex: number = 0;
  private currentWaypointIndex: number = 0;
  private targetX: number = 0;
  private targetY: number = 0;
  private velocityX: number = 0;
  private velocityY: number = 0;

  // Status effects
  private statusEffects: StatusEffect[] = [];
  private dotTickTimer: number = 0;

  // Shield (boss)
  private shield: number = 0;
  private maxShield: number = 0;
  private lastDamageTime: number = 0;

  // Abilities
  private teleportCooldown: number = 0;
  private spawnCooldown: number = 0;

  // Visuals
  private healthBar!: Phaser.GameObjects.Graphics;
  private shieldBar: Phaser.GameObjects.Graphics | null = null;

  public isFlying: boolean = false;
  private dying: boolean = false;

  constructor(
    scene: GameScene,
    x: number,
    y: number,
    type: string,
    difficultyConfig?: WaveDifficultyConfig,
    isElite: boolean = false
  ) {
    super(scene, x, y, `enemy-${type}`);

    this.scene = scene;
    this.enemyType = type;
    this.enemyData = getEnemyData(type);
    this.isElite = isElite;

    if (difficultyConfig && scene.difficultyManager) {
      const scaled = scene.difficultyManager.getScaledEnemyStats(
        this.enemyData.health,
        this.enemyData.armor,
        this.enemyData.speed,
        this.enemyData.energyReward,
        difficultyConfig,
        isElite
      );
      this.maxHealth = scaled.health;
      this.armor = scaled.armor;
      this.baseSpeed = scaled.speed;
      this.energyReward = scaled.energy;
    } else {
      this.maxHealth = this.enemyData.health;
      this.armor = this.enemyData.armor;
      this.baseSpeed = this.enemyData.speed;
      this.energyReward = this.enemyData.energyReward;
    }

    // Drop modifiers (Unstable Ground, Overpressure, ...)
    this.baseSpeed *= scene.getEnemySpeedMultiplier();

    this.currentHealth = this.maxHealth;
    this.currentSpeed = this.baseSpeed;
    this.damage = this.enemyData.damage;
    this.isFlying = this.enemyData.abilities?.flying || false;

    if (this.enemyData.abilities?.shield) {
      this.maxShield = this.enemyData.abilities.shield.amount;
      this.shield = this.maxShield;
    }
    if (this.enemyData.abilities?.periodicSpawn) {
      this.spawnCooldown = this.enemyData.abilities.periodicSpawn.interval;
    }
    if (this.enemyData.abilities?.teleport) {
      this.teleportCooldown = this.enemyData.abilities.teleport.cooldown;
    }

    this.setDepth(DEPTH.ENEMY);
    this.setOrigin(0.5, 0.5);

    if (isElite) {
      this.setScale(ELITE_MODIFIERS.scale);
      this.setTint(ELITE_MODIFIERS.tint);
    }

    this.createHealthBar();
  }

  private createHealthBar(): void {
    this.healthBar = this.scene.add.graphics();
    this.healthBar.setDepth(DEPTH.ENEMY + 1);
    this.scene.getCameraManager().addGameObject(this.healthBar);

    if (this.maxShield > 0) {
      this.shieldBar = this.scene.add.graphics();
      this.shieldBar.setDepth(DEPTH.ENEMY + 2);
      this.scene.getCameraManager().addGameObject(this.shieldBar);
    }
  }

  /**
   * Follow a path produced by PathManager.
   * @param startIndex waypoint to head for first (used when spawned mid-path by a carrier).
   */
  public setPath(path: PathPoint[], pathIndex: number, startIndex: number = 0): void {
    this.pathIndex = pathIndex;
    this.path = path;
    this.currentWaypointIndex = Math.min(startIndex, path.length - 1);
    this.setNextWaypoint();
  }

  public getPathIndex(): number {
    return this.pathIndex;
  }

  public getWaypointIndex(): number {
    return this.currentWaypointIndex;
  }

  private setNextWaypoint(): void {
    if (this.currentWaypointIndex >= this.path.length) {
      this.reachBase();
      return;
    }
    const waypoint = this.path[this.currentWaypointIndex];
    this.targetX = waypoint.worldX;
    this.targetY = waypoint.worldY;
  }

  public preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (!this.active || this.dying) return;

    const dt = this.scene.getSimDelta(delta);
    if (dt <= 0) {
      this.updateHealthBar();
      return;
    }

    this.updateStatusEffects(dt);
    if (!this.active) return;

    this.updateAbilities(dt);
    if (!this.active) return;

    this.updateShieldRegen(time, dt);

    if (this.hasStatusEffect('stun')) {
      this.velocityX = 0;
      this.velocityY = 0;
      this.updateHealthBar();
      return;
    }

    this.currentSpeed = this.baseSpeed;
    const slowEffect = this.getStatusEffect('slow');
    if (slowEffect) {
      this.currentSpeed *= (1 - slowEffect.value);
    }

    this.moveTowardsTarget(dt);
    if (!this.active) return;

    this.updateHealthBar();
  }

  private moveTowardsTarget(dt: number): void {
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const distance = Math.hypot(dx, dy);

    if (distance < 5) {
      this.currentWaypointIndex++;
      this.setNextWaypoint();
      return;
    }

    const moveDistance = this.currentSpeed * (dt / 1000);
    const ratio = Math.min(moveDistance / distance, 1);

    this.velocityX = (dx / distance) * this.currentSpeed;
    this.velocityY = (dy / distance) * this.currentSpeed;

    this.x += dx * ratio;
    this.y += dy * ratio;
    this.rotation = Math.atan2(dy, dx);
  }

  /** Current velocity in px/s, used by turrets to lead their shots. */
  public getVelocity(): { x: number; y: number } {
    return { x: this.velocityX, y: this.velocityY };
  }

  private updateStatusEffects(dt: number): void {
    // Damage-over-time ticks on a fixed interval, not every frame.
    this.dotTickTimer += dt;
    let ticks = 0;
    while (this.dotTickTimer >= DOT_TICK_MS) {
      this.dotTickTimer -= DOT_TICK_MS;
      ticks++;
    }

    for (let i = this.statusEffects.length - 1; i >= 0; i--) {
      const effect = this.statusEffects[i];
      effect.remaining -= dt;

      if (effect.type === 'dot' && ticks > 0 && effect.remaining > -dt) {
        const damageType = effect.damageType || DamageType.KINETIC;
        for (let t = 0; t < ticks && this.active; t++) {
          const result = this.scene.damageSystem.calculateDOTDamage(
            effect.value,
            damageType,
            this.enemyData,
            this.armor
          );
          if (!result.wasEvaded) {
            this.takeDamage(result.finalDamage);
          }
        }
        if (!this.active) return;
      }

      if (effect.remaining <= 0) {
        this.statusEffects.splice(i, 1);
      }
    }
  }

  private updateAbilities(dt: number): void {
    const abilities = this.enemyData.abilities;
    if (!abilities) return;

    if (abilities.teleport) {
      this.teleportCooldown -= dt;
      if (this.teleportCooldown <= 0) {
        this.performTeleport();
        this.teleportCooldown = abilities.teleport.cooldown;
      }
    }

    if (abilities.periodicSpawn) {
      this.spawnCooldown -= dt;
      if (this.spawnCooldown <= 0) {
        this.performSpawn();
        this.spawnCooldown = abilities.periodicSpawn.interval;
      }
    }
  }

  private updateShieldRegen(time: number, dt: number): void {
    const shield = this.enemyData.abilities?.shield;
    if (!shield) return;
    if (time - this.lastDamageTime > shield.regenDelay && this.shield < this.maxShield) {
      this.shield = Math.min(this.maxShield, this.shield + shield.regenRate * (dt / 1000));
    }
  }

  private performTeleport(): void {
    const teleport = this.enemyData.abilities?.teleport;
    if (!teleport) return;

    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= 0) return;

    const jump = Math.min(teleport.range, distance);
    this.x += (dx / distance) * jump;
    this.y += (dy / distance) * jump;

    const particles = this.scene.add.particles(this.x, this.y, 'projectile-electric', {
      speed: 50,
      lifespan: 300,
      scale: { start: 0.5, end: 0 },
      emitting: false
    });
    particles.setDepth(DEPTH.EFFECTS);
    particles.explode(10);
    this.scene.time.delayedCall(350, () => particles.destroy());
  }

  private performSpawn(): void {
    const spawn = this.enemyData.abilities?.periodicSpawn;
    if (!spawn) return;
    const diffConfig = this.scene.waveManager?.getCurrentDifficultyConfig();
    this.scene.spawnEnemy(spawn.type, this.pathIndex, diffConfig, false, {
      x: this.x,
      y: this.y,
      waypointIndex: this.currentWaypointIndex
    });
  }

  private reachBase(): void {
    // destroy() clears this.scene, so grab what we need first.
    const scene = this.scene;
    const damage = this.damage;
    this.die(false);
    scene.damageBase(damage);
  }

  public takeDamage(amount: number, giveReward: boolean = true, attacker: Turret | null = null): void {
    if (!this.active || this.dying) return;

    if (this.shield > 0) {
      if (amount <= this.shield) {
        this.shield -= amount;
        this.lastDamageTime = this.scene.time.now;
        return;
      }
      amount -= this.shield;
      this.shield = 0;
    }

    this.currentHealth -= amount;
    this.lastDamageTime = this.scene.time.now;
    this.showDamageNumber(amount);

    if (this.currentHealth <= 0) {
      if (attacker && attacker.active) {
        attacker.recordKill();
      }
      this.die(giveReward);
    }
  }

  private showDamageNumber(amount: number): void {
    const text = this.scene.add.text(this.x, this.y - 20, Math.floor(amount).toString(), {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(DEPTH.EFFECTS);

    this.scene.tweens.add({
      targets: text,
      y: this.y - 50,
      alpha: 0,
      duration: 800,
      ease: 'Power2',
      onComplete: () => text.destroy()
    });
  }

  /**
   * @param killed true when destroyed by the player (rewards + death-spawn),
   *   false when the enemy reached the base.
   */
  private die(killed: boolean): void {
    if (this.dying) return;
    this.dying = true;

    if (killed) {
      const spawnData = this.enemyData.abilities?.spawn;
      if (spawnData?.onDeath) {
        const diffConfig = this.scene.waveManager?.getCurrentDifficultyConfig();
        for (let i = 0; i < spawnData.count; i++) {
          const angle = (i / spawnData.count) * Math.PI * 2;
          this.scene.spawnEnemy(spawnData.type, this.pathIndex, diffConfig, false, {
            x: this.x + Math.cos(angle) * 12,
            y: this.y + Math.sin(angle) * 12,
            waypointIndex: this.currentWaypointIndex
          });
        }
      }
      this.scene.awardEnergy(this.energyReward);
      this.scene.onEnemyKilled(this.isElite);
    }

    this.setActive(false);
    this.setVisible(false);
    this.destroy();
  }

  /** Phaser calls this from destroy(); clean up the detached bars. */
  public preDestroy(): void {
    this.healthBar?.destroy();
    this.shieldBar?.destroy();
  }

  private updateHealthBar(): void {
    const barWidth = 40;
    const barHeight = 4;
    const barY = -25;

    this.healthBar.clear();
    this.healthBar.fillStyle(0x333333);
    this.healthBar.fillRect(this.x - barWidth / 2, this.y + barY, barWidth, barHeight);

    const healthPercent = Math.max(0, this.currentHealth / this.maxHealth);
    const healthColor = healthPercent > 0.5 ? 0x00ff00 : healthPercent > 0.25 ? 0xffff00 : 0xff0000;
    this.healthBar.fillStyle(healthColor);
    this.healthBar.fillRect(this.x - barWidth / 2, this.y + barY, barWidth * healthPercent, barHeight);

    if (this.shieldBar && this.maxShield > 0) {
      this.shieldBar.clear();
      const shieldPercent = this.shield / this.maxShield;
      this.shieldBar.fillStyle(0x00aaff);
      this.shieldBar.fillRect(this.x - barWidth / 2, this.y + barY - 5, barWidth * shieldPercent, 3);
    }
  }

  public applyStatusEffect(type: 'slow' | 'dot' | 'stun', value: number, duration: number, damageType?: DamageType): void {
    if (!this.active) return;
    const existing = this.statusEffects.find(e => e.type === type);

    if (existing) {
      // Strongest value wins; duration is refreshed to the longer of the two.
      existing.value = Math.max(existing.value, value);
      existing.remaining = Math.max(existing.remaining, duration);
      if (damageType) existing.damageType = damageType;
    } else {
      this.statusEffects.push({ type, value, duration, remaining: duration, damageType });
    }
  }

  public hasStatusEffect(type: string): boolean {
    return this.statusEffects.some(e => e.type === type);
  }

  public getStatusEffect(type: string): StatusEffect | undefined {
    return this.statusEffects.find(e => e.type === type);
  }

  public getArmor(): number {
    return this.armor;
  }

  public getData(): EnemyData {
    return this.enemyData;
  }

  /** Distance left to walk before reaching the base (used for target priority). */
  public getRemainingPathDistance(): number {
    const waypoint = this.path[this.currentWaypointIndex];
    if (!waypoint) return 0;
    return waypoint.remaining + Math.hypot(this.targetX - this.x, this.targetY - this.y);
  }
}
