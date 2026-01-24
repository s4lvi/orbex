import Phaser from 'phaser';
import {
  SCENES, GRID_WIDTH, GRID_HEIGHT, GAME_WIDTH, GAME_HEIGHT,
  TILE_SIZE, UI_MARGIN_X, UI_MARGIN_Y, BASE_HEALTH, DEPTH, TurretType, TrapType, MaterialType
} from '../utils/Constants';
import { PlanetData } from '../data/planets';
import { LandingZone } from './LandingZoneSelectScene';
import { ResourceManager } from '../systems/ResourceManager';
import { PathManager } from '../systems/PathManager';
import { WaveManager } from '../systems/WaveManager';
import { DamageSystem } from '../systems/DamageSystem';
import { MineManager } from '../systems/MineManager';
import { Enemy } from '../entities/Enemy';
import { Turret } from '../entities/Turret';
import { Projectile } from '../entities/Projectile';
import { Trap } from '../entities/Trap';
import { HUD } from '../ui/HUD';
import { TurretMenu } from '../ui/TurretMenu';
import { UpgradeMenu } from '../ui/UpgradeMenu';
import { ObjectPool } from '../utils/ObjectPool';
import { SpatialGrid } from '../utils/SpatialGrid';

export class GameScene extends Phaser.Scene {
  // Game state
  private planet!: PlanetData;
  private zone!: LandingZone;
  private baseHealth!: number;
  private isPaused: boolean = false;
  private gameOver: boolean = false;
  private enemiesKilled: number = 0;
  private turretsBuilt: number = 0;

  // Systems
  public resourceManager!: ResourceManager;
  public pathManager!: PathManager;
  public waveManager!: WaveManager;
  public damageSystem!: DamageSystem;
  public mineManager!: MineManager;

  // Entity groups
  public enemies!: Phaser.GameObjects.Group;
  public turrets!: Phaser.GameObjects.Group;
  public projectiles!: Phaser.GameObjects.Group;
  public traps!: Phaser.GameObjects.Group;

  // Object pooling for projectiles (performance optimization)
  private projectilePool!: ObjectPool<Projectile>;

  // Spatial grid for efficient collision detection (reduces O(n*m) to ~O(n+m))
  private enemySpatialGrid!: SpatialGrid<Enemy>;

  // UI
  private hud!: HUD;
  private turretMenu!: TurretMenu;
  private upgradeMenu!: UpgradeMenu;

  // Grid
  private gridContainer!: Phaser.GameObjects.Container;
  private tileSprites: Phaser.GameObjects.Sprite[][] = [];

  // Selection
  private selectedTurret: Turret | null = null;
  private placingTurretType: TurretType | null = null;
  private placingTrapType: TrapType | null = null;
  private previewSprite: Phaser.GameObjects.Sprite | null = null;

  constructor() {
    super({ key: SCENES.GAME });
  }

  create(): void {
    // Clean up UI from previous session (Phaser reuses scene instances)
    this.hud?.destroy();
    this.turretMenu?.destroy();
    this.upgradeMenu?.destroy();

    // Clean up grid from previous session
    if (this.gridContainer) {
      this.gridContainer.destroy();
    }
    this.tileSprites = [];

    // Clean up entity groups from previous session
    if (this.enemies) this.enemies.destroy(true);
    if (this.turrets) this.turrets.destroy(true);
    if (this.projectiles) this.projectiles.destroy(true);
    if (this.traps) this.traps.destroy(true);

    // Reset all state from previous runs
    this.selectedTurret = null;
    this.placingTurretType = null;
    this.placingTrapType = null;
    if (this.previewSprite) {
      this.previewSprite.destroy();
      this.previewSprite = null;
    }

    // Get selected planet and zone
    this.planet = this.registry.get('selectedPlanet');
    this.zone = this.registry.get('selectedZone');

    if (!this.planet || !this.zone) {
      this.scene.start(SCENES.PLANET_SELECT);
      return;
    }

    // Initialize game state
    this.baseHealth = BASE_HEALTH;
    this.isPaused = false;
    this.gameOver = false;
    this.enemiesKilled = 0;
    this.turretsBuilt = 0;

    // Initialize systems
    this.resourceManager = new ResourceManager(this);
    this.pathManager = new PathManager(this, this.zone);
    this.waveManager = new WaveManager(this, this.planet);
    this.damageSystem = new DamageSystem();
    this.mineManager = new MineManager(this);

    // Apply initial resupply (baseline + mine bonuses)
    this.applyWaveResupply();

    // Initialize entity groups
    this.enemies = this.add.group({ runChildUpdate: true });
    this.turrets = this.add.group({ runChildUpdate: true });
    this.projectiles = this.add.group({ runChildUpdate: true });
    this.traps = this.add.group({ runChildUpdate: true });

    // Initialize projectile pool (pre-allocate 20, max 200)
    this.projectilePool = new ObjectPool<Projectile>(
      () => {
        const proj = new Projectile(this, -100, -100);
        this.projectiles.add(proj);
        this.add.existing(proj);
        return proj;
      },
      20,
      200
    );

    // Initialize spatial grid for collision detection (cell size = 64px = TILE_SIZE)
    this.enemySpatialGrid = new SpatialGrid<Enemy>(TILE_SIZE);

    // Create game world
    this.createGrid();
    this.createBase();

    // Create UI
    this.hud = new HUD(this);
    this.turretMenu = new TurretMenu(this);
    this.upgradeMenu = new UpgradeMenu(this);

    // Setup input
    this.setupInput();

    // Listen for wave complete to apply resupply
    this.events.on('waveComplete', this.onWaveCompleteResupply, this);

    // Start first wave after delay
    this.time.delayedCall(2000, () => {
      this.waveManager.startNextWave();
    });
  }

  /**
   * Apply wave resupply - baseline resources plus mine bonuses
   */
  private applyWaveResupply(): void {
    const resupply = this.mineManager.calculateWaveResupply();

    // Convert to the format ResourceManager expects
    Object.entries(resupply).forEach(([material, amount]) => {
      if (amount && amount > 0) {
        this.resourceManager.addMaterial(material as MaterialType, amount);
      }
    });

    console.log('[GameScene] Wave resupply applied:', resupply);
  }

  /**
   * Called when a wave completes - apply resupply for next wave
   */
  private onWaveCompleteResupply(): void {
    // Only apply resupply if there are more waves
    if (!this.waveManager.isComplete()) {
      this.applyWaveResupply();

      // Show resupply notification
      const resupply = this.mineManager.calculateWaveResupply();
      const resupplyText = Object.entries(resupply)
        .filter(([_, amount]) => amount && amount > 0)
        .map(([mat, amount]) => `+${amount} ${mat}`)
        .join('  ');

      const notification = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50, `RESUPPLY: ${resupplyText}`, {
        fontSize: '20px',
        color: '#00ffff',
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(DEPTH.UI + 10);

      this.tweens.add({
        targets: notification,
        alpha: 0,
        y: GAME_HEIGHT / 2 - 100,
        duration: 2000,
        ease: 'Power2',
        onComplete: () => notification.destroy()
      });
    }
  }

  update(time: number, delta: number): void {
    if (this.isPaused || this.gameOver) return;

    // Update systems
    this.waveManager.update(time, delta);

    // Update turret targeting
    const turretList = this.turrets.getChildren() as unknown as Turret[];
    const enemyList = this.enemies.getChildren() as unknown as Enemy[];
    turretList.forEach((turret) => {
      turret.updateTargeting(enemyList);
    });

    // Check projectile collisions
    this.checkProjectileCollisions();

    // Check trap triggers
    this.checkTrapTriggers();

    // Update UI
    this.hud.update();

    // Check victory condition
    if (this.waveManager.isComplete() && this.enemies.getLength() === 0) {
      this.handleVictory();
    }
  }

  private createGrid(): void {
    this.gridContainer = this.add.container(UI_MARGIN_X, UI_MARGIN_Y);
    this.gridContainer.setDepth(DEPTH.GROUND);

    const buildableMap = this.pathManager.getBuildableMap();

    for (let y = 0; y < GRID_HEIGHT; y++) {
      this.tileSprites[y] = [];
      for (let x = 0; x < GRID_WIDTH; x++) {
        const worldX = x * TILE_SIZE + TILE_SIZE / 2;
        const worldY = y * TILE_SIZE + TILE_SIZE / 2;

        let textureKey = 'tile-ground';
        if (this.pathManager.isPath(x, y)) {
          textureKey = 'tile-path';
        } else if (buildableMap[y][x]) {
          textureKey = 'tile-buildable';
        }

        const tile = this.add.sprite(worldX, worldY, textureKey);
        tile.setAlpha(0.8);
        this.tileSprites[y][x] = tile;
        this.gridContainer.add(tile);
      }
    }
  }

  private createBase(): void {
    const baseX = UI_MARGIN_X + (GRID_WIDTH - 1) * TILE_SIZE + TILE_SIZE / 2;
    const baseY = UI_MARGIN_Y + Math.floor(GRID_HEIGHT / 2) * TILE_SIZE + TILE_SIZE / 2;

    const base = this.add.sprite(baseX, baseY, 'base');
    base.setDepth(DEPTH.TURRET);
    base.setScale(0.8);
  }

  private setupInput(): void {
    // Remove any existing handlers from previous scene runs
    this.input.off('pointerdown');
    this.input.off('pointermove');
    this.input.keyboard?.off('keydown-ESC');
    this.input.keyboard?.off('keydown-SPACE');
    this.input.keyboard?.off('keydown-P');

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.gameOver) return;

      // Check if click is within the upgrade menu area (don't deselect if clicking menu)
      if (this.upgradeMenu.isVisible()) {
        const menuX = GAME_WIDTH - 220;
        const menuY = 80;
        const menuWidth = 200;
        const menuHeight = 350;

        if (pointer.x >= menuX && pointer.x <= menuX + menuWidth &&
            pointer.y >= menuY && pointer.y <= menuY + menuHeight) {
          // Click is within upgrade menu, let the menu handle it
          return;
        }
      }

      // Check if click is within the turret menu area (bottom bar)
      const turretMenuY = GAME_HEIGHT - 120;
      const turretMenuHeight = 110;
      if (pointer.y >= turretMenuY && pointer.y <= turretMenuY + turretMenuHeight) {
        // Click is within turret menu, let the menu handle it
        return;
      }

      const gridPos = this.screenToGrid(pointer.x, pointer.y);

      if (!gridPos) {
        // Clicked outside grid - deselect
        this.deselectTurret();
        return;
      }

      if (this.placingTurretType) {
        this.tryPlaceTurret(gridPos.x, gridPos.y);
      } else if (this.placingTrapType) {
        this.tryPlaceTrap(gridPos.x, gridPos.y);
      } else {
        // Check if clicked on existing turret
        const turret = this.getTurretAt(gridPos.x, gridPos.y);
        if (turret) {
          this.selectTurret(turret);
        } else {
          this.deselectTurret();
        }
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.placingTurretType || this.placingTrapType) {
        this.updatePreview(pointer.x, pointer.y);
      }
    });

    // Keyboard shortcuts
    this.input.keyboard?.on('keydown-ESC', () => {
      this.cancelPlacement();
      this.deselectTurret();
    });

    this.input.keyboard?.on('keydown-SPACE', () => {
      if (!this.waveManager.isWaveInProgress() && !this.waveManager.isComplete()) {
        this.waveManager.startNextWave();
      }
    });

    this.input.keyboard?.on('keydown-P', () => {
      this.togglePause();
    });
  }

  public screenToGrid(screenX: number, screenY: number): { x: number; y: number } | null {
    const localX = screenX - UI_MARGIN_X;
    const localY = screenY - UI_MARGIN_Y;

    if (localX < 0 || localY < 0 || localX >= GRID_WIDTH * TILE_SIZE || localY >= GRID_HEIGHT * TILE_SIZE) {
      return null;
    }

    return {
      x: Math.floor(localX / TILE_SIZE),
      y: Math.floor(localY / TILE_SIZE)
    };
  }

  public gridToScreen(gridX: number, gridY: number): { x: number; y: number } {
    return {
      x: UI_MARGIN_X + gridX * TILE_SIZE + TILE_SIZE / 2,
      y: UI_MARGIN_Y + gridY * TILE_SIZE + TILE_SIZE / 2
    };
  }

  public startPlacingTurret(type: TurretType): void {
    this.cancelPlacement();
    this.placingTurretType = type;
    this.createPreviewSprite(`turret-${type}`);
  }

  public startPlacingTrap(type: TrapType): void {
    this.cancelPlacement();
    this.placingTrapType = type;
    this.createPreviewSprite(`trap-${type}`);
  }

  private createPreviewSprite(texture: string): void {
    this.previewSprite = this.add.sprite(0, 0, texture);
    this.previewSprite.setAlpha(0.5);
    this.previewSprite.setDepth(DEPTH.EFFECTS);
    this.previewSprite.setVisible(false);
  }

  private updatePreview(screenX: number, screenY: number): void {
    if (!this.previewSprite) return;

    const gridPos = this.screenToGrid(screenX, screenY);
    if (!gridPos) {
      this.previewSprite.setVisible(false);
      return;
    }

    const worldPos = this.gridToScreen(gridPos.x, gridPos.y);
    this.previewSprite.setPosition(worldPos.x, worldPos.y);
    this.previewSprite.setVisible(true);

    // Color based on validity
    const canPlace = this.placingTurretType
      ? this.canPlaceTurret(gridPos.x, gridPos.y)
      : this.canPlaceTrap(gridPos.x, gridPos.y);

    this.previewSprite.setTint(canPlace ? 0x00ff00 : 0xff0000);
  }

  public cancelPlacement(): void {
    this.placingTurretType = null;
    this.placingTrapType = null;
    if (this.previewSprite) {
      this.previewSprite.destroy();
      this.previewSprite = null;
    }
  }

  private canPlaceTurret(gridX: number, gridY: number): boolean {
    if (!this.pathManager.isBuildable(gridX, gridY)) return false;
    if (this.getTurretAt(gridX, gridY)) return false;
    return true;
  }

  private canPlaceTrap(gridX: number, gridY: number): boolean {
    if (!this.pathManager.isPath(gridX, gridY)) return false;
    if (this.getTrapAt(gridX, gridY)) return false;
    return true;
  }

  private tryPlaceTurret(gridX: number, gridY: number): void {
    if (!this.placingTurretType || !this.canPlaceTurret(gridX, gridY)) return;

    const cost = this.turretMenu.getTurretCost(this.placingTurretType);
    if (!this.resourceManager.canAfford(cost)) return;

    this.resourceManager.spend(cost);

    const worldPos = this.gridToScreen(gridX, gridY);
    const turret = new Turret(this, worldPos.x, worldPos.y, this.placingTurretType, gridX, gridY);
    this.turrets.add(turret);
    this.add.existing(turret);

    // Mark tile as occupied
    this.pathManager.setOccupied(gridX, gridY, true);

    // Track stats
    this.turretsBuilt++;

    this.cancelPlacement();
  }

  private tryPlaceTrap(gridX: number, gridY: number): void {
    if (!this.placingTrapType || !this.canPlaceTrap(gridX, gridY)) return;

    const cost = this.turretMenu.getTrapCost(this.placingTrapType);
    if (!this.resourceManager.canAfford(cost)) return;

    this.resourceManager.spend(cost);

    const worldPos = this.gridToScreen(gridX, gridY);
    const trap = new Trap(this, worldPos.x, worldPos.y, this.placingTrapType);
    this.traps.add(trap);
    this.add.existing(trap);

    this.cancelPlacement();
  }

  private getTurretAt(gridX: number, gridY: number): Turret | null {
    const turrets = this.turrets.getChildren() as unknown as Turret[];
    return turrets.find(t => t.gridX === gridX && t.gridY === gridY) || null;
  }

  private getTrapAt(gridX: number, gridY: number): Trap | null {
    const traps = this.traps.getChildren() as unknown as Trap[];
    const worldPos = this.gridToScreen(gridX, gridY);
    return traps.find(t =>
      Math.abs(t.x - worldPos.x) < TILE_SIZE / 2 &&
      Math.abs(t.y - worldPos.y) < TILE_SIZE / 2
    ) || null;
  }

  public selectTurret(turret: Turret): void {
    this.deselectTurret();
    this.selectedTurret = turret;
    turret.setSelected(true);
    this.upgradeMenu.show(turret);
  }

  public deselectTurret(): void {
    if (this.selectedTurret) {
      this.selectedTurret.setSelected(false);
      this.selectedTurret = null;
    }
    this.upgradeMenu.hide();
  }

  public spawnEnemy(type: string, pathIndex: number): void {
    const path = this.zone.paths[pathIndex];
    if (!path) return;

    const startPos = this.gridToScreen(0, path.startY);
    const enemy = new Enemy(this, startPos.x - TILE_SIZE, startPos.y, type);
    enemy.setPath(path, pathIndex);
    this.enemies.add(enemy);
    this.add.existing(enemy);
  }

  public spawnProjectile(x: number, y: number, targetX: number, targetY: number, data: {
    damage: number;
    damageType: string;
    speed: number;
    texture: string;
    aoe?: number;
    slow?: number;
    slowDuration?: number;
  }): void {
    // Use object pool instead of creating new instances (performance optimization)
    const projectile = this.projectilePool.get();
    projectile.setPosition(x, y);
    projectile.fire(targetX, targetY, data);
  }

  private checkProjectileCollisions(): void {
    const projectiles = this.projectiles.getChildren() as unknown as Projectile[];
    const allEnemies = this.enemies.getChildren() as unknown as Enemy[];

    // Rebuild spatial grid with current enemy positions (O(n))
    this.enemySpatialGrid.clear();
    this.enemySpatialGrid.insertAll(allEnemies);

    // Check each projectile against only nearby enemies (O(n) average instead of O(n*m))
    for (const projectile of projectiles) {
      if (!projectile.active) continue;

      // Query only enemies in nearby cells
      const nearbyEnemies = this.enemySpatialGrid.getNearby(projectile.x, projectile.y);

      for (const enemy of nearbyEnemies) {
        if (!enemy.active) continue;

        const dx = projectile.x - enemy.x;
        const dy = projectile.y - enemy.y;
        const distSq = dx * dx + dy * dy;

        // Use squared distance to avoid sqrt (20^2 = 400)
        if (distSq < 400) {
          projectile.hit(enemy, allEnemies);
          break; // Projectile can only hit one enemy (unless piercing, handled in hit())
        }
      }
    }
  }

  private checkTrapTriggers(): void {
    const traps = this.traps.getChildren() as unknown as Trap[];
    const allEnemies = this.enemies.getChildren() as unknown as Enemy[];

    // Spatial grid already built in checkProjectileCollisions, reuse it
    for (const trap of traps) {
      if (!trap.active || !trap.isReady()) continue;

      // Query only enemies near the trap
      const nearbyEnemies = this.enemySpatialGrid.getNearby(trap.x, trap.y);
      const triggerRadiusSq = trap.triggerRadius * trap.triggerRadius;

      for (const enemy of nearbyEnemies) {
        if (!enemy.active) continue;

        const dx = trap.x - enemy.x;
        const dy = trap.y - enemy.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < triggerRadiusSq) {
          trap.trigger(enemy, allEnemies);
          break; // Trap triggered, exit inner loop
        }
      }
    }
  }

  public damageBase(amount: number): void {
    this.baseHealth -= amount;
    this.hud.updateBaseHealth(this.baseHealth);

    // Screen shake
    this.cameras.main.shake(200, 0.01);

    if (this.baseHealth <= 0) {
      this.handleDefeat();
    }
  }

  /**
   * Award energy from killing enemies (enemies no longer drop materials)
   */
  public awardEnergy(amount: number): void {
    this.resourceManager.addEnergy(amount);
  }

  public onEnemyKilled(): void {
    this.enemiesKilled++;
  }

  private togglePause(): void {
    this.isPaused = !this.isPaused;
    // TODO: Show pause overlay
  }

  private handleVictory(): void {
    if (this.gameOver) return;
    this.gameOver = true;

    // Register the new mine from this successful drop
    const mine = this.mineManager.registerMine(
      this.planet.id,
      `${this.planet.name} Site ${this.zone.id}`,
      this.zone.resourceGeneration
    );

    // Calculate energy earned (from drop resources)
    const dropResources = this.resourceManager.getDropResources();
    const energyEarned = dropResources.energy;

    this.time.delayedCall(1500, () => {
      this.registry.set('gameResult', {
        victory: true,
        energyEarned,
        mineEstablished: mine,
        wavesCompleted: this.waveManager.getCurrentWave(),
        baseHealth: this.baseHealth,
        enemiesKilled: this.enemiesKilled,
        turretsBuilt: this.turretsBuilt
      });
      this.scene.start(SCENES.RESULTS);
    });
  }

  private handleDefeat(): void {
    if (this.gameOver) return;
    this.gameOver = true;

    // On defeat, spent session resources are lost - save the modified session to registry
    this.resourceManager.saveSessionToRegistry();

    // Apply defeat penalty (lose 50% of energy earned)
    const dropResources = this.resourceManager.getDropResources();
    const penalizedEnergy = Math.floor(dropResources.energy * 0.5);

    this.time.delayedCall(1500, () => {
      this.registry.set('gameResult', {
        victory: false,
        energyEarned: penalizedEnergy,
        mineEstablished: null, // No mine on defeat
        wavesCompleted: this.waveManager.getCurrentWave(),
        baseHealth: 0,
        enemiesKilled: this.enemiesKilled,
        turretsBuilt: this.turretsBuilt
      });
      this.scene.start(SCENES.RESULTS);
    });
  }

  public getBaseHealth(): number {
    return this.baseHealth;
  }

  public getPlanet(): PlanetData {
    return this.planet;
  }

  public getZone(): LandingZone {
    return this.zone;
  }

  /**
   * Called when the scene is being shut down (before transitioning to another scene).
   * Cleans up event listeners and UI components to prevent memory leaks and
   * interference with subsequent game sessions.
   */
  shutdown(): void {
    // Clean up UI components
    this.hud?.destroy();
    this.turretMenu?.destroy();
    this.upgradeMenu?.destroy();

    // Clean up event listeners
    this.events.off('waveComplete', this.onWaveCompleteResupply, this);

    // Clean up scene input listeners
    this.input.off('pointerdown');
    this.input.off('pointermove');
    this.input.keyboard?.off('keydown-ESC');
    this.input.keyboard?.off('keydown-SPACE');
    this.input.keyboard?.off('keydown-P');
  }
}
