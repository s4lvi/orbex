import Phaser from 'phaser';
import { DEPTH, TILE_SIZE, UI_MARGIN_X, UI_MARGIN_Y, EnemyType } from '../utils/Constants';
import { GameScene } from '../scenes/GameScene';
import { getEnemyData, EnemyData, getScaledEnemyStats } from '../data/enemies';
import { PathPoint } from '../systems/PathManager';

interface StatusEffect {
  type: 'slow' | 'dot' | 'stun';
  value: number;
  duration: number;
  remaining: number;
  damageType?: string;
}

export class Enemy extends Phaser.GameObjects.Sprite {
  public scene: GameScene;
  public enemyType: string;
  private enemyData: EnemyData;

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

  // Status effects
  private statusEffects: StatusEffect[] = [];

  // Shield (for boss)
  private shield: number = 0;
  private maxShield: number = 0;
  private lastDamageTime: number = 0;

  // Abilities
  private teleportCooldown: number = 0;
  private spawnCooldown: number = 0;

  // Visual
  private healthBar!: Phaser.GameObjects.Graphics;
  private shieldBar!: Phaser.GameObjects.Graphics;

  // Flying
  public isFlying: boolean = false;

  constructor(scene: GameScene, x: number, y: number, type: string) {
    super(scene, x, y, `enemy-${type}`);

    this.scene = scene;
    this.enemyType = type;
    this.enemyData = getEnemyData(type);

    // Get scaled stats based on wave number
    const waveNum = scene.waveManager?.getCurrentWave() || 1;
    const difficulty = scene.waveManager?.getDifficultyMultiplier() || 1;
    const scaled = getScaledEnemyStats(type as EnemyType, waveNum, difficulty);

    // Initialize stats
    this.maxHealth = scaled.health || this.enemyData.health;
    this.currentHealth = this.maxHealth;
    this.armor = scaled.armor || this.enemyData.armor;
    this.baseSpeed = this.enemyData.speed;
    this.currentSpeed = this.baseSpeed;
    this.damage = this.enemyData.damage;
    this.energyReward = scaled.energyReward || this.enemyData.energyReward;

    // Set up abilities
    this.isFlying = this.enemyData.abilities?.flying || false;

    // Initialize shield
    if (this.enemyData.abilities?.shield) {
      this.maxShield = this.enemyData.abilities.shield.amount;
      this.shield = this.maxShield;
    }

    // Set depth and origin
    this.setDepth(DEPTH.ENEMY);
    this.setOrigin(0.5, 0.5);

    // Create health bar
    this.createHealthBar();
  }

  private createHealthBar(): void {
    this.healthBar = this.scene.add.graphics();
    this.healthBar.setDepth(DEPTH.ENEMY + 1);

    if (this.maxShield > 0) {
      this.shieldBar = this.scene.add.graphics();
      this.shieldBar.setDepth(DEPTH.ENEMY + 2);
    }
  }

  public setPath(pathData: { startY: number; waypoints: { x: number; y: number }[] }, pathIndex: number): void {
    this.pathIndex = pathIndex;

    // Convert path data to PathPoints
    this.path = [];

    // Add starting point
    this.path.push({
      x: 0,
      y: pathData.startY,
      worldX: UI_MARGIN_X + TILE_SIZE / 2,
      worldY: UI_MARGIN_Y + pathData.startY * TILE_SIZE + TILE_SIZE / 2
    });

    // Add waypoints
    pathData.waypoints.forEach(wp => {
      this.path.push({
        x: wp.x,
        y: wp.y,
        worldX: UI_MARGIN_X + wp.x * TILE_SIZE + TILE_SIZE / 2,
        worldY: UI_MARGIN_Y + wp.y * TILE_SIZE + TILE_SIZE / 2
      });
    });

    this.currentWaypointIndex = 0;
    this.setNextWaypoint();
  }

  private setNextWaypoint(): void {
    if (this.currentWaypointIndex >= this.path.length) {
      // Reached end - damage base
      this.reachBase();
      return;
    }

    const waypoint = this.path[this.currentWaypointIndex];
    this.targetX = waypoint.worldX;
    this.targetY = waypoint.worldY;
  }

  public preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);

    if (!this.active) return;

    // Update status effects
    this.updateStatusEffects(delta);

    // Update abilities
    this.updateAbilities(time, delta);

    // Update shield regeneration
    this.updateShieldRegen(time, delta);

    // Check for stun
    if (this.hasStatusEffect('stun')) {
      this.updateHealthBar();
      return;
    }

    // Calculate effective speed
    this.currentSpeed = this.baseSpeed;
    const slowEffect = this.getStatusEffect('slow');
    if (slowEffect) {
      this.currentSpeed *= (1 - slowEffect.value);
    }

    // Move towards target
    this.moveTowardsTarget(delta);

    // Update health bar position
    this.updateHealthBar();
  }

  private moveTowardsTarget(delta: number): void {
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 5) {
      // Reached waypoint
      this.currentWaypointIndex++;
      this.setNextWaypoint();
      return;
    }

    // Normalize and move
    const moveDistance = this.currentSpeed * (delta / 1000);
    const ratio = Math.min(moveDistance / distance, 1);

    this.x += dx * ratio;
    this.y += dy * ratio;

    // Update rotation to face direction
    this.rotation = Math.atan2(dy, dx);
  }

  private updateStatusEffects(delta: number): void {
    for (let i = this.statusEffects.length - 1; i >= 0; i--) {
      const effect = this.statusEffects[i];
      effect.remaining -= delta;

      // Apply DOT damage
      if (effect.type === 'dot' && effect.remaining > 0) {
        // Damage per tick (every 500ms)
        const tickDamage = effect.value * (delta / 500);
        this.takeDamage(tickDamage, false);
      }

      // Remove expired effects
      if (effect.remaining <= 0) {
        this.statusEffects.splice(i, 1);
      }
    }
  }

  private updateAbilities(_time: number, delta: number): void {
    // Teleport ability
    if (this.enemyData.abilities?.teleport) {
      this.teleportCooldown -= delta;
      if (this.teleportCooldown <= 0) {
        this.performTeleport();
        this.teleportCooldown = this.enemyData.abilities.teleport.cooldown;
      }
    }

    // Periodic spawn ability
    if (this.enemyData.abilities?.periodicSpawn) {
      this.spawnCooldown -= delta;
      if (this.spawnCooldown <= 0) {
        this.performSpawn();
        this.spawnCooldown = this.enemyData.abilities.periodicSpawn.interval;
      }
    }
  }

  private updateShieldRegen(time: number, delta: number): void {
    if (!this.enemyData.abilities?.shield) return;

    const timeSinceDamage = time - this.lastDamageTime;
    if (timeSinceDamage > this.enemyData.abilities.shield.regenDelay) {
      if (this.shield < this.maxShield) {
        this.shield += this.enemyData.abilities.shield.regenRate * (delta / 1000);
        this.shield = Math.min(this.shield, this.maxShield);
      }
    }
  }

  private performTeleport(): void {
    if (!this.enemyData.abilities?.teleport) return;

    const range = this.enemyData.abilities.teleport.range;

    // Teleport forward along path
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 0) {
      const teleportDist = Math.min(range, distance);
      this.x += (dx / distance) * teleportDist;
      this.y += (dy / distance) * teleportDist;

      // Visual effect
      this.scene.add.particles(this.x, this.y, 'projectile-electric', {
        speed: 50,
        lifespan: 300,
        quantity: 10,
        scale: { start: 0.5, end: 0 }
      });
    }
  }

  private performSpawn(): void {
    if (!this.enemyData.abilities?.periodicSpawn) return;

    const spawnType = this.enemyData.abilities.periodicSpawn.type;
    this.scene.spawnEnemy(spawnType, this.pathIndex);
  }

  private reachBase(): void {
    this.scene.damageBase(this.damage);
    this.die(false);
  }

  public takeDamage(amount: number, giveReward: boolean = true): void {
    // Absorb with shield first
    if (this.shield > 0) {
      if (amount <= this.shield) {
        this.shield -= amount;
        this.lastDamageTime = this.scene.time.now;
        return;
      } else {
        amount -= this.shield;
        this.shield = 0;
      }
    }

    this.currentHealth -= amount;
    this.lastDamageTime = this.scene.time.now;

    // Show damage number
    this.showDamageNumber(amount);

    if (this.currentHealth <= 0) {
      this.die(giveReward);
    }
  }

  private showDamageNumber(amount: number): void {
    const text = this.scene.add.text(this.x, this.y - 20, Math.floor(amount).toString(), {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.scene.tweens.add({
      targets: text,
      y: this.y - 50,
      alpha: 0,
      duration: 800,
      ease: 'Power2',
      onComplete: () => text.destroy()
    });
  }

  private die(giveReward: boolean): void {
    // Spawn on death ability
    if (this.enemyData.abilities?.spawn?.onDeath) {
      const spawnData = this.enemyData.abilities.spawn;
      for (let i = 0; i < spawnData.count; i++) {
        this.scene.time.delayedCall(i * 100, () => {
          this.scene.spawnEnemy(spawnData.type, this.pathIndex);
        });
      }
    }

    // Give energy reward and track kill stat
    if (giveReward) {
      this.scene.awardEnergy(this.energyReward);
      this.scene.onEnemyKilled();
    }

    // Clean up
    this.healthBar.destroy();
    if (this.shieldBar) {
      this.shieldBar.destroy();
    }

    this.setActive(false);
    this.setVisible(false);
    this.destroy();
  }

  private updateHealthBar(): void {
    const barWidth = 40;
    const barHeight = 4;
    const barY = -25;

    this.healthBar.clear();

    // Background
    this.healthBar.fillStyle(0x333333);
    this.healthBar.fillRect(this.x - barWidth / 2, this.y + barY, barWidth, barHeight);

    // Health fill
    const healthPercent = this.currentHealth / this.maxHealth;
    const healthColor = healthPercent > 0.5 ? 0x00ff00 : healthPercent > 0.25 ? 0xffff00 : 0xff0000;
    this.healthBar.fillStyle(healthColor);
    this.healthBar.fillRect(this.x - barWidth / 2, this.y + barY, barWidth * healthPercent, barHeight);

    // Shield bar
    if (this.shieldBar && this.maxShield > 0) {
      this.shieldBar.clear();
      const shieldPercent = this.shield / this.maxShield;
      this.shieldBar.fillStyle(0x00aaff);
      this.shieldBar.fillRect(this.x - barWidth / 2, this.y + barY - 5, barWidth * shieldPercent, 3);
    }
  }

  public applyStatusEffect(type: 'slow' | 'dot' | 'stun', value: number, duration: number): void {
    // Check for existing effect of same type
    const existing = this.statusEffects.find(e => e.type === type);

    if (existing) {
      // Refresh duration if new is stronger or longer
      if (value >= existing.value || duration > existing.remaining) {
        existing.value = Math.max(existing.value, value);
        existing.remaining = Math.max(existing.remaining, duration);
      }
    } else {
      this.statusEffects.push({
        type,
        value,
        duration,
        remaining: duration
      });
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

  public getDistanceToBase(): number {
    const basePos = this.scene.pathManager.getBasePosition();
    return Phaser.Math.Distance.Between(this.x, this.y, basePos.x, basePos.y);
  }
}
