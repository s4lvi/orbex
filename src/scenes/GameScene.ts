import Phaser from 'phaser';
import {
  SCENES, GRID_WIDTH, GRID_HEIGHT, GAME_WIDTH, GAME_HEIGHT,
  TILE_SIZE, UI_MARGIN_X, UI_MARGIN_Y, BASE_HEALTH, DEPTH, TurretType, TrapType
} from '../utils/Constants';
import { PlanetData } from '../data/planets';
import { LandingZone } from './LandingZoneSelectScene';
import { ResourceManager, Resources } from '../systems/ResourceManager';
import { PathManager } from '../systems/PathManager';
import { WaveManager } from '../systems/WaveManager';
import { DamageSystem } from '../systems/DamageSystem';
import { Enemy } from '../entities/Enemy';
import { Turret } from '../entities/Turret';
import { Projectile } from '../entities/Projectile';
import { Trap } from '../entities/Trap';
import { HUD } from '../ui/HUD';
import { TurretMenu } from '../ui/TurretMenu';
import { UpgradeMenu } from '../ui/UpgradeMenu';

export class GameScene extends Phaser.Scene {
  // Game state
  private planet!: PlanetData;
  private zone!: LandingZone;
  private baseHealth!: number;
  private isPaused: boolean = false;
  private gameOver: boolean = false;

  // Systems
  public resourceManager!: ResourceManager;
  public pathManager!: PathManager;
  public waveManager!: WaveManager;
  public damageSystem!: DamageSystem;

  // Entity groups
  public enemies!: Phaser.GameObjects.Group;
  public turrets!: Phaser.GameObjects.Group;
  public projectiles!: Phaser.GameObjects.Group;
  public traps!: Phaser.GameObjects.Group;

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

    // Initialize systems
    this.resourceManager = new ResourceManager(this);
    this.pathManager = new PathManager(this, this.zone);
    this.waveManager = new WaveManager(this, this.planet);
    this.damageSystem = new DamageSystem();

    // Initialize entity groups
    this.enemies = this.add.group({ runChildUpdate: true });
    this.turrets = this.add.group({ runChildUpdate: true });
    this.projectiles = this.add.group({ runChildUpdate: true });
    this.traps = this.add.group({ runChildUpdate: true });

    // Create game world
    this.createGrid();
    this.createBase();

    // Create UI
    this.hud = new HUD(this);
    this.turretMenu = new TurretMenu(this);
    this.upgradeMenu = new UpgradeMenu(this);

    // Setup input
    this.setupInput();

    // Start first wave after delay
    this.time.delayedCall(2000, () => {
      this.waveManager.startNextWave();
    });
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
    const projectile = new Projectile(this, x, y);
    projectile.fire(targetX, targetY, data);
    this.projectiles.add(projectile);
    this.add.existing(projectile);
  }

  private checkProjectileCollisions(): void {
    const projectiles = this.projectiles.getChildren() as unknown as Projectile[];
    const enemies = this.enemies.getChildren() as unknown as Enemy[];

    projectiles.forEach(projectile => {
      if (!projectile.active) return;

      enemies.forEach(enemy => {
        if (!enemy.active) return;

        const dist = Phaser.Math.Distance.Between(projectile.x, projectile.y, enemy.x, enemy.y);
        if (dist < 20) {
          projectile.hit(enemy, enemies);
        }
      });
    });
  }

  private checkTrapTriggers(): void {
    const traps = this.traps.getChildren() as unknown as Trap[];
    const enemies = this.enemies.getChildren() as unknown as Enemy[];

    traps.forEach(trap => {
      if (!trap.active || !trap.isReady()) return;

      enemies.forEach(enemy => {
        if (!enemy.active) return;

        const dist = Phaser.Math.Distance.Between(trap.x, trap.y, enemy.x, enemy.y);
        if (dist < trap.triggerRadius) {
          trap.trigger(enemy, enemies);
        }
      });
    });
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

  public awardResources(resources: { [key: string]: number }): void {
    this.resourceManager.add(resources);
  }

  private togglePause(): void {
    this.isPaused = !this.isPaused;
    // TODO: Show pause overlay
  }

  private handleVictory(): void {
    if (this.gameOver) return;
    this.gameOver = true;

    // Calculate rewards
    const dropResources = this.resourceManager.getDropResources();

    this.time.delayedCall(1500, () => {
      this.registry.set('gameResult', {
        victory: true,
        resources: dropResources,
        wavesCompleted: this.waveManager.getCurrentWave(),
        baseHealth: this.baseHealth
      });
      this.scene.start(SCENES.RESULTS);
    });
  }

  private handleDefeat(): void {
    if (this.gameOver) return;
    this.gameOver = true;

    // On defeat, spent session resources are lost - save the modified session to registry
    this.resourceManager.saveSessionToRegistry();

    // Apply defeat penalty (lose 50% of drop resources)
    const dropResources = this.resourceManager.getDropResources();
    const penalizedResources: Resources = {
      minerals: Math.floor(dropResources.minerals * 0.5),
      energy: Math.floor(dropResources.energy * 0.5),
      alloys: Math.floor(dropResources.alloys * 0.5),
      plasma: Math.floor(dropResources.plasma * 0.5),
      crystals: Math.floor(dropResources.crystals * 0.5),
      darkMatter: Math.floor(dropResources.darkMatter * 0.5),
      antimatter: Math.floor(dropResources.antimatter * 0.5),
      quantumFlux: Math.floor(dropResources.quantumFlux * 0.5)
    };

    this.time.delayedCall(1500, () => {
      this.registry.set('gameResult', {
        victory: false,
        resources: penalizedResources,
        wavesCompleted: this.waveManager.getCurrentWave(),
        baseHealth: 0
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

    // Clean up scene input listeners
    this.input.off('pointerdown');
    this.input.off('pointermove');
    this.input.keyboard?.off('keydown-ESC');
    this.input.keyboard?.off('keydown-SPACE');
    this.input.keyboard?.off('keydown-P');
  }
}
