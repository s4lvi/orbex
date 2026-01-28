import Phaser from 'phaser';
import {
  SCENES, GAME_WIDTH, GAME_HEIGHT,
  TILE_SIZE, BASE_HEALTH, DEPTH, TurretType, TrapType, MaterialType,
  DEFAULT_GRID_WIDTH, DEFAULT_GRID_HEIGHT
} from '../utils/Constants';
import { PlanetData } from '../data/planets';
import { LandingZone } from './LandingZoneSelectScene';
import { ResourceManager } from '../systems/ResourceManager';
import { PathManager } from '../systems/PathManager';
import { WaveManager } from '../systems/WaveManager';
import { DamageSystem } from '../systems/DamageSystem';
import { MineManager } from '../systems/MineManager';
import { CameraManager } from '../systems/CameraManager';
import { TurretInventoryManager } from '../systems/TurretInventoryManager';
import { OrbitalWeaponManager } from '../systems/OrbitalWeaponManager';
import { DifficultyManager, WaveDifficultyConfig } from '../systems/DifficultyManager';
import { Enemy } from '../entities/Enemy';
import { Turret } from '../entities/Turret';
import { Projectile } from '../entities/Projectile';
import { Trap } from '../entities/Trap';
import { HUD } from '../ui/HUD';
import { TurretMenu } from '../ui/TurretMenu';
import { UpgradeMenu } from '../ui/UpgradeMenu';
import { OrbitalWeaponMenu } from '../ui/OrbitalWeaponMenu';
import { ObjectPool } from '../utils/ObjectPool';
import { SpatialGrid } from '../utils/SpatialGrid';
import { TurretInstance } from '../types/GameData';

export class GameScene extends Phaser.Scene {
  // Game state
  private planet!: PlanetData;
  private zone!: LandingZone;
  private baseHealth!: number;
  private isPaused: boolean = false;
  private gameOver: boolean = false;
  private enemiesKilled: number = 0;
  private turretsBuilt: number = 0;

  // Grid configuration (loaded from planet)
  public gridWidth: number = DEFAULT_GRID_WIDTH;
  public gridHeight: number = DEFAULT_GRID_HEIGHT;

  // Systems
  public resourceManager!: ResourceManager;
  public pathManager!: PathManager;
  public waveManager!: WaveManager;
  public damageSystem!: DamageSystem;
  public mineManager!: MineManager;
  public cameraManager!: CameraManager;
  public turretInventoryManager!: TurretInventoryManager;
  public orbitalWeaponManager!: OrbitalWeaponManager;
  public difficultyManager!: DifficultyManager;

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
  private orbitalMenu!: OrbitalWeaponMenu;

  // Grid
  private gridContainer!: Phaser.GameObjects.Container;
  private pathGraphics!: Phaser.GameObjects.Graphics;
  private tileSprites: Phaser.GameObjects.Sprite[][] = [];

  // Selection
  private selectedTurret: Turret | null = null;
  private placingTurretType: TurretType | null = null;
  private placingTrapType: TrapType | null = null;
  private previewSprite: Phaser.GameObjects.Sprite | null = null;
  private pendingClick: { x: number; y: number } | null = null;
  private pendingRightClick: boolean = false;

  private readonly handlePointerDown = (pointer: Phaser.Input.Pointer): void => {
    if (this.gameOver) return;

    if (pointer.rightButtonDown()) {
      if (!this.isPointerOverUI(pointer)) {
        this.pendingRightClick = true;
      }
      return;
    }

    if (!pointer.leftButtonDown()) {
      return;
    }

    if (this.isPointerOverUI(pointer)) {
      return;
    }

    this.pendingClick = { x: pointer.x, y: pointer.y };
  };

  private readonly handlePointerMove = (pointer: Phaser.Input.Pointer): void => {
    if (this.placingTurretType || this.placingTrapType) {
      this.updatePreview(pointer.x, pointer.y);
    }

    // Update orbital weapon targeting reticle
    if (this.orbitalWeaponManager.isTargetingActive()) {
      this.orbitalWeaponManager.updateTargeting(pointer.x, pointer.y);
    }
  };

  private readonly handlePointerUp = (pointer: Phaser.Input.Pointer): void => {
    if (this.gameOver) return;

    const didPan = this.cameraManager.consumePanFlag();
    if (this.pendingRightClick) {
      this.pendingRightClick = false;
      if (didPan) {
        return;
      }
      if (this.isPointerOverUI(pointer)) {
        return;
      }
      this.cancelPlacement();
      this.deselectTurret();
      this.orbitalWeaponManager.cancelTargeting();
      return;
    }

    if (!this.pendingClick) {
      return;
    }
    this.pendingClick = null;
    if (didPan) {
      return;
    }

    if (this.isPointerOverUI(pointer)) {
      return;
    }

    this.handleGameClick(pointer);
  };

  constructor() {
    super({ key: SCENES.GAME });
  }

  create(): void {
    // Clean up UI from previous session (Phaser reuses scene instances)
    this.hud?.destroy();
    this.turretMenu?.destroy();
    this.upgradeMenu?.destroy();
    this.orbitalMenu?.destroy();
    this.orbitalWeaponManager?.destroy();

    // Clean up grid from previous session
    if (this.gridContainer) {
      this.gridContainer.destroy();
    }
    if (this.pathGraphics) {
      this.pathGraphics.destroy();
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

    // Set grid size from planet configuration
    this.gridWidth = this.planet.gridSize?.width || DEFAULT_GRID_WIDTH;
    this.gridHeight = this.planet.gridSize?.height || DEFAULT_GRID_HEIGHT;

    // Initialize game state
    this.baseHealth = BASE_HEALTH;
    this.isPaused = false;
    this.gameOver = false;
    this.enemiesKilled = 0;
    this.turretsBuilt = 0;

    // Initialize camera manager (currently just centers the view, no pan/zoom)
    this.cameraManager = new CameraManager(this, this.gridWidth, this.gridHeight, (pointer) => {
      return !this.isPointerOverUI(pointer);
    });

    // Initialize systems
    this.resourceManager = new ResourceManager(this);
    this.pathManager = new PathManager(this, this.zone, this.gridWidth, this.gridHeight);
    this.waveManager = new WaveManager(this, this.planet);
    this.difficultyManager = new DifficultyManager(this, this.planet, this.zone);
    this.waveManager.setDifficultyManager(this.difficultyManager);
    this.damageSystem = new DamageSystem();
    this.mineManager = new MineManager(this);
    this.turretInventoryManager = new TurretInventoryManager(this);
    this.orbitalWeaponManager = new OrbitalWeaponManager(this);

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
        this.cameraManager.addGameObject(proj);
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
    this.orbitalMenu = new OrbitalWeaponMenu(this, this.orbitalWeaponManager);

    // Register UI elements with the UI camera (so they don't zoom/pan with game camera)
    this.cameraManager.addUIObject(this.hud.getContainer());
    this.cameraManager.addUIObject(this.turretMenu.getContainer());
    this.cameraManager.addUIObject(this.upgradeMenu.getContainer());
    this.cameraManager.addUIObject(this.orbitalMenu.getContainer());

    // Register game world elements with game camera (so they don't render on UI camera)
    this.cameraManager.addGameObject(this.gridContainer);
    this.cameraManager.addGameObject(this.pathGraphics);

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
      this.cameraManager.addUIObject(notification);

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
    this.orbitalWeaponManager.update(delta);

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
    this.orbitalMenu.update();

    // Check victory condition
    if (this.waveManager.isComplete() && this.enemies.getLength() === 0) {
      this.handleVictory();
    }
  }

  private createGrid(): void {
    // Grid is now at world origin (0, 0) - camera handles viewport
    this.gridContainer = this.add.container(0, 0);
    this.gridContainer.setDepth(DEPTH.GROUND);

    const buildableMap = this.pathManager.getBuildableMap();

    // Draw grid tiles (ground and buildable only, not path)
    for (let y = 0; y < this.gridHeight; y++) {
      this.tileSprites[y] = [];
      for (let x = 0; x < this.gridWidth; x++) {
        const worldX = x * TILE_SIZE + TILE_SIZE / 2;
        const worldY = y * TILE_SIZE + TILE_SIZE / 2;

        // All cells get ground texture, buildable cells get buildable overlay
        const textureKey = buildableMap[y][x] ? 'tile-buildable' : 'tile-ground';

        const tile = this.add.sprite(worldX, worldY, textureKey);
        tile.setAlpha(0.8);
        this.tileSprites[y][x] = tile;
        this.gridContainer.add(tile);
      }
    }

    // Draw path lines on top of grid
    this.drawPathLines();
  }

  private drawPathLines(): void {
    this.pathGraphics = this.add.graphics();
    this.pathGraphics.setDepth(DEPTH.GROUND + 1);

    // Draw each path as a solid red line
    this.zone.paths.forEach((pathData) => {
      this.pathGraphics.lineStyle(10, 0xff3333, 1);
      this.drawSinglePath(pathData);
    });
  }

  private drawSinglePath(pathData: { startY: number; waypoints: { x: number; y: number }[] }): void {
    // Start from edge (where enemies spawn) - now using world coordinates at origin
    const startX = TILE_SIZE / 2;
    const startY = pathData.startY * TILE_SIZE + TILE_SIZE / 2;

    this.pathGraphics.beginPath();
    this.pathGraphics.moveTo(startX, startY);

    // Draw straight lines through each waypoint (matches enemy movement)
    pathData.waypoints.forEach((waypoint) => {
      const wpX = waypoint.x * TILE_SIZE + TILE_SIZE / 2;
      const wpY = waypoint.y * TILE_SIZE + TILE_SIZE / 2;
      this.pathGraphics.lineTo(wpX, wpY);
    });

    // Draw to base (center of map)
    const basePos = this.pathManager.getBasePosition();
    this.pathGraphics.lineTo(basePos.x, basePos.y);

    this.pathGraphics.strokePath();
  }

  private createBase(): void {
    // Base is now at the center of the map
    const basePos = this.pathManager.getBasePosition();

    const base = this.add.sprite(basePos.x, basePos.y, 'base');
    base.setDepth(DEPTH.TURRET);
    base.setScale(0.8);
    this.cameraManager.addGameObject(base);
  }

  private setupInput(): void {
    // Remove any existing handlers from previous scene runs
    this.input.off('pointerdown', this.handlePointerDown);
    this.input.off('pointermove', this.handlePointerMove);
    this.input.off('pointerup', this.handlePointerUp);
    this.input.keyboard?.off('keydown-ESC');
    this.input.keyboard?.off('keydown-SPACE');
    this.input.keyboard?.off('keydown-P');

    this.input.on('pointerdown', this.handlePointerDown);
    this.input.on('pointermove', this.handlePointerMove);
    this.input.on('pointerup', this.handlePointerUp);

    // Keyboard shortcuts
    this.input.keyboard?.on('keydown-ESC', () => {
      this.cancelPlacement();
      this.deselectTurret();
      this.orbitalWeaponManager.cancelTargeting();
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

  private isPointerOverUI(pointer: Phaser.Input.Pointer): boolean {
    // Upgrade menu area
    if (this.upgradeMenu?.isVisible()) {
      const menuX = GAME_WIDTH - 220;
      const menuY = 80;
      const menuWidth = 200;
      const menuHeight = 350;

      if (pointer.x >= menuX && pointer.x <= menuX + menuWidth &&
          pointer.y >= menuY && pointer.y <= menuY + menuHeight) {
        return true;
      }
    }

    // Turret menu modal
    if (this.turretMenu?.isModalOpen()) {
      return true;
    }

    // Turret menu bar
    const turretMenuY = GAME_HEIGHT - 130;
    const turretMenuHeight = 125;
    if (pointer.y >= turretMenuY && pointer.y <= turretMenuY + turretMenuHeight) {
      return true;
    }

    // HUD area
    if (pointer.y < 130) {
      return true;
    }

    // Orbital weapon menu
    if (pointer.x < 90 && pointer.y >= 130 && pointer.y < 530) {
      return true;
    }

    return false;
  }

  private handleGameClick(pointer: Phaser.Input.Pointer): void {
    // Handle orbital weapon targeting
    if (this.orbitalWeaponManager.isTargetingActive()) {
      this.orbitalWeaponManager.fireAtTarget(pointer.x, pointer.y);
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
  }

  public screenToGrid(screenX: number, screenY: number): { x: number; y: number } | null {
    // Convert screen coordinates to world coordinates using camera
    const worldPos = this.cameraManager.screenToWorld(screenX, screenY);

    if (worldPos.x < 0 || worldPos.y < 0 ||
        worldPos.x >= this.gridWidth * TILE_SIZE ||
        worldPos.y >= this.gridHeight * TILE_SIZE) {
      return null;
    }

    return {
      x: Math.floor(worldPos.x / TILE_SIZE),
      y: Math.floor(worldPos.y / TILE_SIZE)
    };
  }

  public gridToWorld(gridX: number, gridY: number): { x: number; y: number } {
    // Convert grid coordinates to world coordinates (grid origin is at 0,0)
    return {
      x: gridX * TILE_SIZE + TILE_SIZE / 2,
      y: gridY * TILE_SIZE + TILE_SIZE / 2
    };
  }

  // Legacy alias for backward compatibility
  public gridToScreen(gridX: number, gridY: number): { x: number; y: number } {
    return this.gridToWorld(gridX, gridY);
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
    this.cameraManager.addGameObject(this.previewSprite);
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
    this.cameraManager.addGameObject(turret);

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
    this.cameraManager.addGameObject(trap);

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

  public spawnEnemy(
    type: string,
    pathIndex: number,
    difficultyConfig?: WaveDifficultyConfig | null,
    isElite: boolean = false
  ): void {
    const path = this.zone.paths[pathIndex];
    if (!path) return;

    const startPos = this.gridToScreen(0, path.startY);
    const enemy = new Enemy(
      this,
      startPos.x - TILE_SIZE,
      startPos.y,
      type,
      difficultyConfig || undefined,
      isElite
    );
    enemy.setPath(path, pathIndex);
    this.enemies.add(enemy);
    this.add.existing(enemy);
    this.cameraManager.addGameObject(enemy);
  }

  public spawnProjectile(x: number, y: number, targetX: number, targetY: number, data: {
    damage: number;
    damageType: string;
    speed: number;
    texture: string;
    aoe?: number;
    slow?: number;
    slowDuration?: number;
    chainTargets?: number;
    piercing?: boolean;
    dotDamage?: number;
    dotDuration?: number;
    critChance?: number;
    critMultiplier?: number;
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

    // Record mission result for adaptive difficulty
    this.difficultyManager.recordMissionResult(true);

    // Register the new mine from this successful drop
    const mine = this.mineManager.registerMine(
      this.planet.id,
      `${this.planet.name} Site ${this.zone.id}`,
      this.zone.resourceGeneration
    );

    // Calculate energy earned (from drop resources)
    const dropResources = this.resourceManager.getDropResources();
    const energyEarned = dropResources.energy;

    // Merge all drop resources (energy + materials) into session
    this.resourceManager.mergeDropToSession();

    // Collect ALL surviving turrets to inventory (victory = keep everything)
    const survivingTurrets = this.collectSurvivingTurrets();
    const turretsCollected = this.turretInventoryManager.collectSurvivingTurrets(survivingTurrets);

    this.time.delayedCall(1500, () => {
      this.registry.set('gameResult', {
        victory: true,
        energyEarned,
        mineEstablished: mine,
        wavesCompleted: this.waveManager.getCurrentWave(),
        baseHealth: this.baseHealth,
        enemiesKilled: this.enemiesKilled,
        turretsBuilt: this.turretsBuilt,
        turretsCollected
      });
      this.scene.start(SCENES.RESULTS);
    });
  }

  private handleDefeat(): void {
    if (this.gameOver) return;
    this.gameOver = true;

    // Record mission result for adaptive difficulty
    this.difficultyManager.recordMissionResult(false);

    // On defeat, spent session resources are lost - save the modified session to registry
    this.resourceManager.saveSessionToRegistry();

    // Apply defeat penalty (lose 50% of energy earned)
    const dropResources = this.resourceManager.getDropResources();
    const penalizedEnergy = Math.floor(dropResources.energy * 0.5);

    // On defeat, only INVENTORY turrets return (newly bought ones are lost)
    const inventoryTurrets = this.collectInventoryTurretsOnly();
    const turretsReturned = this.turretInventoryManager.collectSurvivingTurrets(inventoryTurrets);

    this.time.delayedCall(1500, () => {
      this.registry.set('gameResult', {
        victory: false,
        energyEarned: penalizedEnergy,
        mineEstablished: null, // No mine on defeat
        wavesCompleted: this.waveManager.getCurrentWave(),
        baseHealth: 0,
        enemiesKilled: this.enemiesKilled,
        turretsBuilt: this.turretsBuilt,
        turretsCollected: turretsReturned
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
   * Collect all surviving turrets as inventory instances (for victory)
   */
  private collectSurvivingTurrets(): TurretInstance[] {
    const turretList = this.turrets.getChildren() as unknown as Turret[];
    return turretList
      .filter(turret => turret.active)
      .map(turret => turret.toInventoryInstance());
  }

  /**
   * Collect only inventory turrets (for defeat - newly bought ones are lost)
   */
  private collectInventoryTurretsOnly(): TurretInstance[] {
    const turretList = this.turrets.getChildren() as unknown as Turret[];
    return turretList
      .filter(turret => turret.active && turret.isFromInventory())
      .map(turret => turret.toInventoryInstance());
  }

  /**
   * Place a turret from inventory (free placement)
   */
  public placeInventoryTurret(instance: TurretInstance, gridX: number, gridY: number): Turret | null {
    if (!this.pathManager.isBuildable(gridX, gridY)) {
      return null;
    }

    const worldPos = this.gridToWorld(gridX, gridY);
    const turret = new Turret(this, worldPos.x, worldPos.y, instance.type as TurretType, gridX, gridY);
    turret.restoreFromInstance(instance);
    this.turrets.add(turret);
    this.add.existing(turret);

    // Mark tile as occupied
    this.pathManager.setOccupied(gridX, gridY, true);

    // Remove from inventory
    this.turretInventoryManager.removeTurret(instance.id);

    return turret;
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
    this.orbitalMenu?.destroy();

    // Clean up systems
    this.cameraManager?.destroy();
    this.orbitalWeaponManager?.destroy();

    // Clean up event listeners
    this.events.off('waveComplete', this.onWaveCompleteResupply, this);

    // Clean up scene input listeners
    this.input.off('pointerdown', this.handlePointerDown);
    this.input.off('pointermove', this.handlePointerMove);
    this.input.off('pointerup', this.handlePointerUp);
    this.input.keyboard?.off('keydown-ESC');
    this.input.keyboard?.off('keydown-SPACE');
    this.input.keyboard?.off('keydown-P');
  }

  /**
   * Get camera manager for UI/entity coordinate conversion
   */
  public getCameraManager(): CameraManager {
    return this.cameraManager;
  }
}
