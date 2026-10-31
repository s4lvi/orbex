import Phaser from 'phaser';
import {
  SCENES, GAME_WIDTH, GAME_HEIGHT,
  TILE_SIZE, BASE_HEALTH, DEPTH, TurretType, TrapType, MaterialType,
  DamageType, DEFAULT_GRID_WIDTH, DEFAULT_GRID_HEIGHT, FONTS, TEXT_COLORS
} from '../utils/Constants';
import { PlanetData } from '../data/planets';
import { LandingZone } from './LandingZoneSelectScene';
import { ResourceManager } from '../systems/ResourceManager';
import { PathManager } from '../systems/PathManager';
import { WaveManager } from '../systems/WaveManager';
import { DamageSystem } from '../systems/DamageSystem';
import { MineManager, Mine } from '../systems/MineManager';
import { CameraManager } from '../systems/CameraManager';
import { TurretInventoryManager } from '../systems/TurretInventoryManager';
import { OrbitalWeaponManager } from '../systems/OrbitalWeaponManager';
import { DifficultyManager, WaveDifficultyConfig } from '../systems/DifficultyManager';
import { DataLoader } from '../systems/DataLoader';
import { Enemy } from '../entities/Enemy';
import { Turret } from '../entities/Turret';
import { Projectile, ProjectileData } from '../entities/Projectile';
import { Trap } from '../entities/Trap';
import { HUD } from '../ui/HUD';
import { TurretMenu } from '../ui/TurretMenu';
import { UpgradeMenu } from '../ui/UpgradeMenu';
import { OrbitalWeaponMenu } from '../ui/OrbitalWeaponMenu';
import { ObjectPool } from '../utils/ObjectPool';
import { SpatialGrid } from '../utils/SpatialGrid';
import { GameResult, TurretInstance } from '../types/GameData';
import { ModifierData, MODIFIERS } from '../data/modifiers';
import { CONTRACTS, ContractData, ContractProgress, isContractSuccessful } from '../data/contracts';
import { PlayerStats } from './HangarScene';

export interface SpawnOrigin {
  x: number;
  y: number;
  waypointIndex: number;
}

export class GameScene extends Phaser.Scene {
  private planet!: PlanetData;
  private zone!: LandingZone;
  private totalWaves: number = 10;
  private defendingMineId: string | null = null;
  private baseHealth: number = BASE_HEALTH;
  private isPaused: boolean = false;
  private gameSpeed: number = 1;
  private gameOver: boolean = false;
  private enemiesKilled: number = 0;
  private turretsBuilt: number = 0;
  private initialized: boolean = false;
  /** Roster units deployed this drop. Removed from the inventory only when the drop resolves. */
  private rosterIdsInUse: Set<string> = new Set();

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

  public activeModifiers: ModifierData[] = [];
  public activeContract: ContractData = CONTRACTS.STANDARD;
  public contractProgress: ContractProgress = {
    contractId: 'STANDARD',
    baseDamageTaken: 0,
    eliteKills: 0,
    turretsBuilt: 0,
    failed: false
  };

  // Entity groups
  public enemies!: Phaser.GameObjects.Group;
  public turrets!: Phaser.GameObjects.Group;
  public projectiles!: Phaser.GameObjects.Group;
  public traps!: Phaser.GameObjects.Group;

  private projectilePool!: ObjectPool<Projectile>;
  private enemySpatialGrid!: SpatialGrid<Enemy>;

  // UI
  private hud!: HUD;
  private turretMenu!: TurretMenu;
  private upgradeMenu!: UpgradeMenu;
  private orbitalMenu!: OrbitalWeaponMenu;
  private pauseOverlay!: Phaser.GameObjects.Container;

  // Grid
  private gridContainer!: Phaser.GameObjects.Container;
  private pathGraphics!: Phaser.GameObjects.Graphics;

  // Selection / placement
  private selectedTurret: Turret | null = null;
  private placingTurretType: TurretType | null = null;
  private placingTrapType: TrapType | null = null;
  private previewSprite: Phaser.GameObjects.Sprite | null = null;
  private pendingClick: boolean = false;
  private pendingRightClick: boolean = false;

  private readonly handlePointerDown = (pointer: Phaser.Input.Pointer): void => {
    if (this.gameOver || !this.initialized) return;

    if (pointer.rightButtonDown()) {
      if (!this.isPointerOverUI(pointer)) {
        this.pendingRightClick = true;
      }
      return;
    }

    if (!pointer.leftButtonDown() && !pointer.wasTouch) return;
    if (this.isPointerOverUI(pointer)) return;

    this.pendingClick = true;
  };

  private readonly handlePointerMove = (pointer: Phaser.Input.Pointer): void => {
    if (!this.initialized) return;
    if (this.placingTurretType || this.placingTrapType) {
      this.updatePreview(pointer.x, pointer.y);
    }
    if (this.orbitalWeaponManager.isTargetingActive()) {
      this.orbitalWeaponManager.updateTargeting(pointer.x, pointer.y);
    }
  };

  private readonly handlePointerUp = (pointer: Phaser.Input.Pointer): void => {
    if (this.gameOver || !this.initialized) return;

    const didPan = this.cameraManager.consumePanFlag();

    if (this.pendingRightClick) {
      this.pendingRightClick = false;
      if (didPan || this.isPointerOverUI(pointer)) return;
      this.cancelAllModes();
      return;
    }

    if (!this.pendingClick) return;
    this.pendingClick = false;
    if (didPan || this.isPointerOverUI(pointer)) return;

    this.handleGameClick(pointer);
  };

  constructor() {
    super({ key: SCENES.GAME });
  }

  create(): void {
    this.initialized = false;
    this.events.once('shutdown', this.onShutdown, this);

    this.planet = this.registry.get('selectedPlanet');
    this.zone = this.registry.get('selectedZone');
    if (!this.planet || !this.zone) {
      this.scene.start(SCENES.PLANET_SELECT);
      return;
    }

    const requestedWaves = this.registry.get('zoneWaveCount');
    this.totalWaves = typeof requestedWaves === 'number' && requestedWaves > 0
      ? Math.floor(requestedWaves)
      : this.planet.waves;
    this.defendingMineId = (this.registry.get('defendingMineId') as string | null) || null;

    this.activeModifiers = (this.zone.modifiers || [])
      .map(id => MODIFIERS[id])
      .filter((m): m is ModifierData => !!m);

    this.activeContract = CONTRACTS[this.zone.contract || 'STANDARD'] || CONTRACTS.STANDARD;
    this.contractProgress = {
      contractId: this.activeContract.id,
      baseDamageTaken: 0,
      eliteKills: 0,
      turretsBuilt: 0,
      failed: false
    };

    this.gridWidth = this.planet.gridSize?.width || DEFAULT_GRID_WIDTH;
    this.gridHeight = this.planet.gridSize?.height || DEFAULT_GRID_HEIGHT;

    this.baseHealth = BASE_HEALTH;
    this.isPaused = false;
    this.gameSpeed = 1;
    this.gameOver = false;
    this.enemiesKilled = 0;
    this.turretsBuilt = 0;
    this.rosterIdsInUse = new Set();
    this.selectedTurret = null;
    this.placingTurretType = null;
    this.placingTrapType = null;
    this.previewSprite = null;
    this.pendingClick = false;
    this.pendingRightClick = false;
    this.time.paused = false;
    this.time.timeScale = 1;
    this.tweens.timeScale = 1;

    this.cameraManager = new CameraManager(this, this.gridWidth, this.gridHeight, (pointer) => !this.isPointerOverUI(pointer));

    this.resourceManager = new ResourceManager(this);
    this.pathManager = new PathManager(this.zone.paths, this.gridWidth, this.gridHeight);
    this.waveManager = new WaveManager(this, this.planet, this.totalWaves);
    this.difficultyManager = new DifficultyManager(this, this.planet, this.zone, this.totalWaves);
    this.waveManager.setDifficultyManager(this.difficultyManager);
    this.damageSystem = new DamageSystem();
    this.mineManager = new MineManager(this);
    this.turretInventoryManager = new TurretInventoryManager(this);
    this.orbitalWeaponManager = new OrbitalWeaponManager(this);

    this.enemies = this.add.group();
    this.turrets = this.add.group();
    this.projectiles = this.add.group();
    this.traps = this.add.group();

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

    this.enemySpatialGrid = new SpatialGrid<Enemy>(TILE_SIZE);

    this.createGrid();
    this.createBase();

    this.hud = new HUD(this);
    this.turretMenu = new TurretMenu(this);
    this.upgradeMenu = new UpgradeMenu(this);
    this.orbitalMenu = new OrbitalWeaponMenu(this, this.orbitalWeaponManager);
    this.createPauseOverlay();

    this.cameraManager.addUIObject(this.hud.getContainer());
    this.cameraManager.addUIObject(this.turretMenu.getContainer());
    this.cameraManager.addUIObject(this.upgradeMenu.getContainer());
    this.cameraManager.addUIObject(this.orbitalMenu.getContainer());
    this.cameraManager.addUIObject(this.pauseOverlay);

    this.cameraManager.addGameObject(this.gridContainer);
    this.cameraManager.addGameObject(this.pathGraphics);

    this.setupInput();
    this.events.on('waveComplete', this.onWaveCompleteResupply, this);

    // Opening resupply, then the first wave after a short breather.
    this.applyWaveResupply();
    this.initialized = true;
    this.time.delayedCall(2000, () => this.waveManager.startNextWave());
  }

  private onShutdown(): void {
    this.initialized = false;
    this.events.off('waveComplete', this.onWaveCompleteResupply, this);
    this.input.off('pointerdown', this.handlePointerDown);
    this.input.off('pointermove', this.handlePointerMove);
    this.input.off('pointerup', this.handlePointerUp);
    this.input.keyboard?.removeAllListeners();
    this.hud?.destroy();
    this.turretMenu?.destroy();
    this.upgradeMenu?.destroy();
    this.orbitalMenu?.destroy();
    this.orbitalWeaponManager?.destroy();
    this.cameraManager?.destroy();
    this.time.paused = false;
    this.time.timeScale = 1;
    this.tweens.timeScale = 1;
  }

  // ---------------------------------------------------------------- time control

  /** Delta the simulation should advance by this frame: 0 while paused, scaled by game speed. */
  public getSimDelta(delta: number): number {
    if (this.isPaused || this.gameOver) return 0;
    return delta * this.gameSpeed;
  }

  public isGamePaused(): boolean {
    return this.isPaused;
  }

  public getGameSpeed(): number {
    return this.gameSpeed;
  }

  public togglePause(): void {
    if (this.gameOver) return;
    this.setPaused(!this.isPaused);
  }

  public setPaused(paused: boolean): void {
    if (this.isPaused === paused) return;
    this.isPaused = paused;
    this.time.paused = paused;
    if (paused) {
      this.tweens.pauseAll();
    } else {
      this.tweens.resumeAll();
    }
    this.pauseOverlay.setVisible(paused);
    this.events.emit('pauseChanged', paused);
  }

  public toggleGameSpeed(): void {
    this.gameSpeed = this.gameSpeed === 1 ? 2 : 1;
    this.time.timeScale = this.gameSpeed;
    this.tweens.timeScale = this.gameSpeed;
    this.events.emit('speedChanged', this.gameSpeed);
  }

  private createPauseOverlay(): void {
    this.pauseOverlay = this.add.container(0, 0);
    this.pauseOverlay.setDepth(DEPTH.UI + 20);
    this.pauseOverlay.setScrollFactor(0);
    this.pauseOverlay.setVisible(false);

    const shade = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6);
    shade.setInteractive();
    this.pauseOverlay.add(shade);

    const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, 'PAUSED', {
      fontSize: '48px',
      fontFamily: FONTS.HEADER,
      color: TEXT_COLORS.PRIMARY
    }).setOrigin(0.5);
    this.pauseOverlay.add(title);

    const hint = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20, 'Tap anywhere or press P to resume', {
      fontSize: '18px',
      fontFamily: FONTS.BODY,
      color: TEXT_COLORS.SECONDARY
    }).setOrigin(0.5);
    this.pauseOverlay.add(hint);

    shade.on('pointerup', () => this.setPaused(false));
  }

  // ---------------------------------------------------------------- resupply

  private applyWaveResupply(): void {
    const resupply = this.mineManager.calculateWaveResupply();
    Object.entries(resupply).forEach(([material, amount]) => {
      if (amount && amount > 0) {
        this.resourceManager.addMaterial(material as MaterialType, amount);
      }
    });
  }

  private onWaveCompleteResupply(): void {
    if (this.waveManager.isComplete()) return;
    this.applyWaveResupply();

    const resupply = this.mineManager.calculateWaveResupply();
    const resupplyText = Object.entries(resupply)
      .filter(([, amount]) => amount && amount > 0)
      .map(([mat, amount]) => `+${amount} ${mat}`)
      .join('  ');

    const notification = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50, `RESUPPLY: ${resupplyText}`, {
      fontSize: '20px',
      fontFamily: FONTS.HEADER,
      color: '#00ffff'
    }).setOrigin(0.5).setDepth(DEPTH.UI + 10).setScrollFactor(0);
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

  // ---------------------------------------------------------------- frame

  update(_time: number, delta: number): void {
    if (!this.initialized) return;

    const dt = this.getSimDelta(delta);
    if (dt > 0) {
      this.waveManager.update(dt);
      this.orbitalWeaponManager.update(dt);

      const turretList = this.turrets.getChildren() as unknown as Turret[];
      const enemyList = this.enemies.getChildren() as unknown as Enemy[];
      for (const turret of turretList) {
        if (turret.active) turret.updateTargeting(enemyList);
      }

      this.checkProjectileCollisions();
      this.checkTrapTriggers();
    }

    this.hud.update();
    this.orbitalMenu.update();

    if (!this.gameOver && this.waveManager.isComplete() && this.enemies.getLength() === 0) {
      this.finishMission(true);
    }
  }

  // ---------------------------------------------------------------- world

  private createGrid(): void {
    this.gridContainer = this.add.container(0, 0);
    this.gridContainer.setDepth(DEPTH.GROUND);

    const buildableMap = this.pathManager.getBuildableMap();
    const pathMap = this.pathManager.getPathMap();

    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        const worldX = x * TILE_SIZE + TILE_SIZE / 2;
        const worldY = y * TILE_SIZE + TILE_SIZE / 2;
        const textureKey = pathMap[y][x] ? 'tile-path' : buildableMap[y][x] ? 'tile-buildable' : 'tile-ground';
        const tile = this.add.sprite(worldX, worldY, textureKey);
        tile.setAlpha(0.8);
        this.gridContainer.add(tile);
      }
    }

    this.drawPathLines();
  }

  private drawPathLines(): void {
    this.pathGraphics = this.add.graphics();
    this.pathGraphics.setDepth(DEPTH.GROUND + 1);
    this.pathGraphics.lineStyle(10, 0xff3333, 0.9);

    for (let i = 0; i < this.pathManager.getPathCount(); i++) {
      const points = this.pathManager.getPath(i);
      if (points.length === 0) continue;
      const spawn = this.pathManager.getSpawnWorldPosition(i);
      this.pathGraphics.beginPath();
      this.pathGraphics.moveTo(spawn.x, spawn.y);
      points.forEach(p => this.pathGraphics.lineTo(p.worldX, p.worldY));
      this.pathGraphics.strokePath();
    }
  }

  private createBase(): void {
    const basePos = this.pathManager.getBasePosition();
    const base = this.add.sprite(basePos.x, basePos.y, 'base');
    base.setDepth(DEPTH.TURRET);
    base.setScale(0.8);
    this.cameraManager.addGameObject(base);
  }

  // ---------------------------------------------------------------- input

  private setupInput(): void {
    this.input.off('pointerdown', this.handlePointerDown);
    this.input.off('pointermove', this.handlePointerMove);
    this.input.off('pointerup', this.handlePointerUp);
    this.input.on('pointerdown', this.handlePointerDown);
    this.input.on('pointermove', this.handlePointerMove);
    this.input.on('pointerup', this.handlePointerUp);

    this.input.keyboard?.removeAllListeners();
    this.input.keyboard?.on('keydown-ESC', () => this.cancelAllModes());
    this.input.keyboard?.on('keydown-SPACE', () => {
      if (this.isPaused) return;
      this.waveManager.startNextWave();
    });
    this.input.keyboard?.on('keydown-P', () => this.togglePause());
    this.input.keyboard?.on('keydown-F', () => this.toggleGameSpeed());
  }

  private cancelAllModes(): void {
    this.cancelPlacement();
    this.deselectTurret();
    this.orbitalWeaponManager.cancelTargeting();
    this.turretMenu.clearSelection();
  }

  /**
   * True when a pointer is over HUD chrome: any interactive UI element under
   * the pointer, or any opaque UI panel rectangle.
   */
  public isPointerOverUI(pointer: Phaser.Input.Pointer): boolean {
    if (this.isPaused) return true;

    const hits = this.input.hitTestPointer(pointer);
    for (const obj of hits) {
      if (this.isUIObject(obj)) return true;
    }

    const rects: Phaser.Geom.Rectangle[] = [
      this.hud.getTopBarBounds(),
      ...this.hud.getControlBounds(),
      this.turretMenu.getBarBounds(),
      this.orbitalMenu.getBounds()
    ];
    const modal = this.turretMenu.getModalBounds();
    if (modal) rects.push(modal);
    const upgrade = this.upgradeMenu.getBounds();
    if (upgrade) rects.push(upgrade);

    return rects.some(r => r.contains(pointer.x, pointer.y));
  }

  private isUIObject(obj: Phaser.GameObjects.GameObject): boolean {
    let current: Phaser.GameObjects.GameObject | null = obj;
    while (current) {
      if (current.getData && current.getData('isUI')) return true;
      current = (current as Phaser.GameObjects.GameObject & { parentContainer?: Phaser.GameObjects.Container }).parentContainer || null;
    }
    return false;
  }

  private handleGameClick(pointer: Phaser.Input.Pointer): void {
    if (this.orbitalWeaponManager.isTargetingActive()) {
      this.orbitalWeaponManager.fireAtTarget(pointer.x, pointer.y);
      return;
    }

    const gridPos = this.screenToGrid(pointer.x, pointer.y);
    if (!gridPos) {
      this.deselectTurret();
      return;
    }

    if (this.placingTurretType) {
      this.tryPlaceTurret(gridPos.x, gridPos.y);
    } else if (this.placingTrapType) {
      this.tryPlaceTrap(gridPos.x, gridPos.y);
    } else {
      const turret = this.getTurretAt(gridPos.x, gridPos.y);
      if (turret) {
        this.selectTurret(turret);
      } else {
        this.deselectTurret();
      }
    }
  }

  public screenToGrid(screenX: number, screenY: number): { x: number; y: number } | null {
    const worldPos = this.cameraManager.screenToWorld(screenX, screenY);
    return this.pathManager.worldToGrid(worldPos.x, worldPos.y);
  }

  public gridToWorld(gridX: number, gridY: number): { x: number; y: number } {
    return this.pathManager.gridToWorld(gridX, gridY);
  }

  // ---------------------------------------------------------------- placement

  public startPlacingTurret(type: TurretType): void {
    this.cancelPlacement();
    this.deselectTurret();
    this.orbitalWeaponManager.cancelTargeting();
    this.placingTurretType = type;
    this.createPreviewSprite(`turret-${type}`);
  }

  public startPlacingTrap(type: TrapType): void {
    this.cancelPlacement();
    this.deselectTurret();
    this.orbitalWeaponManager.cancelTargeting();
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

    const worldPos = this.gridToWorld(gridPos.x, gridPos.y);
    this.previewSprite.setPosition(worldPos.x, worldPos.y);
    this.previewSprite.setVisible(true);

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

  public isPlacing(): boolean {
    return this.placingTurretType !== null || this.placingTrapType !== null;
  }

  private canPlaceTurret(gridX: number, gridY: number): boolean {
    return this.pathManager.isBuildable(gridX, gridY) && !this.getTurretAt(gridX, gridY);
  }

  private canPlaceTrap(gridX: number, gridY: number): boolean {
    return this.pathManager.isPath(gridX, gridY) && !this.getTrapAt(gridX, gridY);
  }

  /**
   * Highest-level roster turret of this type, if any. Roster turrets are placed
   * for free instead of being bought.
   */
  public getRosterTurretForType(type: TurretType): TurretInstance | null {
    const candidates = this.turretInventoryManager.getTurretsByType(type)
      .filter(t => !this.rosterIdsInUse.has(t.id));
    if (candidates.length === 0) return null;
    return candidates.reduce((best, t) => (t.level > best.level ? t : best), candidates[0]);
  }

  /** Roster units of this type not yet deployed in this drop. */
  public getAvailableRosterTurrets(type: TurretType): TurretInstance[] {
    return this.turretInventoryManager.getTurretsByType(type).filter(t => !this.rosterIdsInUse.has(t.id));
  }

  public getTurretCost(type: TurretType): { [key: string]: number } {
    return DataLoader.getTurretByType(type)?.cost || {};
  }

  public getTrapCost(type: TrapType): { [key: string]: number } {
    return DataLoader.getTrapByType(type)?.cost || {};
  }

  private tryPlaceTurret(gridX: number, gridY: number): void {
    if (!this.placingTurretType || !this.canPlaceTurret(gridX, gridY)) return;
    const type = this.placingTurretType;

    const roster = this.getRosterTurretForType(type);
    if (roster) {
      this.placeTurret(type, gridX, gridY, roster);
    } else {
      const cost = this.getTurretCost(type);
      if (!this.resourceManager.spend(cost)) return;
      this.placeTurret(type, gridX, gridY, null);
    }

    // Keep placing while the player still has turrets of this type on the roster
    // or can afford another; otherwise drop back to selection mode.
    const again = this.getRosterTurretForType(type) || this.resourceManager.canAfford(this.getTurretCost(type));
    if (!again) this.cancelPlacement();
  }

  private placeTurret(type: TurretType, gridX: number, gridY: number, rosterInstance: TurretInstance | null): Turret {
    const worldPos = this.gridToWorld(gridX, gridY);
    const turret = new Turret(this, worldPos.x, worldPos.y, type, gridX, gridY);

    if (rosterInstance) {
      turret.restoreFromInstance(rosterInstance);
      this.rosterIdsInUse.add(rosterInstance.id);
    } else {
      turret.identity = this.turretInventoryManager.createIdentity();
    }

    this.turrets.add(turret);
    this.add.existing(turret);
    this.cameraManager.addGameObject(turret);
    this.pathManager.setOccupied(gridX, gridY, true);

    this.turretsBuilt++;
    this.contractProgress.turretsBuilt++;
    if (this.activeContract.id === 'PURIST' && this.contractProgress.turretsBuilt > 3) {
      this.contractProgress.failed = true;
    }

    this.events.emit('turretPlaced', turret);
    return turret;
  }

  private tryPlaceTrap(gridX: number, gridY: number): void {
    if (!this.placingTrapType || !this.canPlaceTrap(gridX, gridY)) return;

    const cost = this.getTrapCost(this.placingTrapType);
    if (!this.resourceManager.spend(cost)) return;

    const worldPos = this.gridToWorld(gridX, gridY);
    const trap = new Trap(this, worldPos.x, worldPos.y, this.placingTrapType);
    this.traps.add(trap);
    this.add.existing(trap);
    this.cameraManager.addGameObject(trap);

    if (!this.resourceManager.canAfford(cost)) this.cancelPlacement();
  }

  private getTurretAt(gridX: number, gridY: number): Turret | null {
    const turrets = this.turrets.getChildren() as unknown as Turret[];
    return turrets.find(t => t.active && t.gridX === gridX && t.gridY === gridY) || null;
  }

  private getTrapAt(gridX: number, gridY: number): Trap | null {
    const traps = this.traps.getChildren() as unknown as Trap[];
    const worldPos = this.gridToWorld(gridX, gridY);
    return traps.find(t =>
      t.active &&
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

  public sellTurret(turret: Turret): void {
    if (this.selectedTurret === turret) {
      this.selectedTurret = null;
      this.upgradeMenu.hide();
    }
    turret.sell();
  }

  // ---------------------------------------------------------------- spawning

  public spawnEnemy(
    type: string,
    pathIndex: number,
    difficultyConfig?: WaveDifficultyConfig | null,
    isElite: boolean = false,
    origin?: SpawnOrigin
  ): void {
    if (this.gameOver || pathIndex >= this.pathManager.getPathCount()) return;

    const path = this.pathManager.getPath(pathIndex);
    const spawnPos = origin ?? { ...this.pathManager.getSpawnWorldPosition(pathIndex), waypointIndex: 0 };

    const enemy = new Enemy(this, spawnPos.x, spawnPos.y, type, difficultyConfig || undefined, isElite);
    enemy.setPath(path, pathIndex, spawnPos.waypointIndex);
    this.enemies.add(enemy);
    this.add.existing(enemy);
    this.cameraManager.addGameObject(enemy);
  }

  public spawnProjectile(x: number, y: number, targetX: number, targetY: number, data: ProjectileData): void {
    const projectile = this.projectilePool.get();
    projectile.setPosition(x, y);
    projectile.fire(targetX, targetY, data);
  }

  private checkProjectileCollisions(): void {
    const projectiles = this.projectiles.getChildren() as unknown as Projectile[];
    const allEnemies = this.enemies.getChildren() as unknown as Enemy[];

    this.enemySpatialGrid.clear();
    this.enemySpatialGrid.insertAll(allEnemies);

    for (const projectile of projectiles) {
      if (!projectile.active) continue;
      const nearby = this.enemySpatialGrid.getNearby(projectile.x, projectile.y);
      for (const enemy of nearby) {
        if (!enemy.active) continue;
        if (projectile.overlaps(enemy)) {
          projectile.hit(enemy, allEnemies);
          break;
        }
      }
    }
  }

  private checkTrapTriggers(): void {
    const traps = this.traps.getChildren() as unknown as Trap[];
    const allEnemies = this.enemies.getChildren() as unknown as Enemy[];

    for (const trap of traps) {
      if (!trap.active || !trap.isReady()) continue;
      const nearby = this.enemySpatialGrid.getNearby(trap.x, trap.y);
      const triggerRadiusSq = trap.triggerRadius * trap.triggerRadius;

      for (const enemy of nearby) {
        if (!enemy.active || !trap.canTrigger(enemy)) continue;
        const dx = trap.x - enemy.x;
        const dy = trap.y - enemy.y;
        if (dx * dx + dy * dy < triggerRadiusSq) {
          trap.trigger(enemy, allEnemies);
          break;
        }
      }
    }
  }

  // ---------------------------------------------------------------- scoring

  public damageBase(amount: number): void {
    if (this.gameOver) return;
    this.baseHealth = Math.max(0, this.baseHealth - amount);
    this.hud.updateBaseHealth(this.baseHealth);

    this.contractProgress.baseDamageTaken += amount;
    if (this.activeContract.id === 'SURVEY' && this.contractProgress.baseDamageTaken > 0) {
      this.contractProgress.failed = true;
    }

    this.cameras.main.shake(200, 0.01);

    if (this.baseHealth <= 0) {
      this.finishMission(false);
    }
  }

  public awardEnergy(amount: number): void {
    this.resourceManager.addEnergy(amount);
  }

  public onEnemyKilled(wasElite: boolean = false): void {
    this.enemiesKilled++;
    if (wasElite) this.contractProgress.eliteKills++;
  }

  /**
   * Resolve the drop. All persistent state (stockpile, mines, roster, stats)
   * is updated here, once; ResultsScene only displays the summary.
   */
  private finishMission(victory: boolean): void {
    if (this.gameOver) return;
    this.gameOver = true;
    this.setPaused(false);
    this.cancelAllModes();

    this.difficultyManager.recordMissionResult(victory);

    // Mines
    let mine: Mine | null = null;
    let defendedMineName: string | null = null;
    if (this.defendingMineId) {
      const defended = this.mineManager.getMine(this.defendingMineId);
      defendedMineName = defended?.zoneName || null;
      if (victory) {
        this.mineManager.defendMine(this.defendingMineId);
      } else {
        this.mineManager.failDefense(this.defendingMineId);
      }
      this.registry.set('defendingMineId', null);
    } else if (victory) {
      const siteNumber = this.mineManager.getMinesForPlanet(this.planet.id).length + 1;
      mine = this.mineManager.registerMine(
        this.planet.id,
        `${this.planet.name} Site ${siteNumber}`,
        this.zone.resourceGeneration
      );
    }

    // Contract bonus (victory only) is credited to the drop ledger before the merge.
    const contractSucceeded = victory && isContractSuccessful(this.contractProgress);
    let contractBonusMaterial: { type: string; amount: number } | null = null;
    let contractBonusEnergy = 0;
    if (contractSucceeded) {
      const bonus = this.activeContract.bonus;
      if (bonus.bonusMaterial) {
        this.resourceManager.add({ [bonus.bonusMaterial.type]: bonus.bonusMaterial.amount });
        contractBonusMaterial = { ...bonus.bonusMaterial };
      }
      if (bonus.rewardMultiplier && bonus.rewardMultiplier > 1) {
        contractBonusEnergy = Math.floor(this.resourceManager.getDropEnergy() * (bonus.rewardMultiplier - 1));
        if (contractBonusEnergy > 0) this.resourceManager.addEnergy(contractBonusEnergy);
      }
    }

    // Stockpile
    const drop = this.resourceManager.getDropResources();
    let energyEarned: number;
    const materialsEarned: { [key in MaterialType]?: number } = {};
    if (victory) {
      energyEarned = drop.energy;
      for (const type of Object.values(MaterialType)) {
        if (drop.materials[type] > 0) materialsEarned[type] = drop.materials[type];
      }
      this.resourceManager.mergeDropToSession();
    } else {
      // Everything spent stays spent; half the energy earned is salvaged.
      energyEarned = Math.floor(drop.energy * 0.5);
      this.resourceManager.addSessionEnergy(energyEarned);
      this.resourceManager.saveSessionToRegistry();
    }

    // Roster: victory keeps every survivor; defeat only returns roster turrets.
    const turretList = (this.turrets.getChildren() as unknown as Turret[]).filter(t => t.active);
    const survivors = victory ? turretList : turretList.filter(t => t.isFromInventory());
    for (const turret of survivors) turret.identity.dropsSurvived++;
    const instances = survivors.map(t => t.toInventoryInstance());
    // Deployed roster units leave the inventory now (sold or destroyed ones are gone for good);
    // survivors are re-added with their updated kills/levels.
    for (const id of this.rosterIdsInUse) this.turretInventoryManager.removeTurret(id);
    const turretsCollected = this.turretInventoryManager.collectSurvivingTurrets(instances);
    const turretsLost = turretList.length - turretsCollected;

    // Player stats
    const stats: PlayerStats = this.registry.get('playerStats') || {
      totalDrops: 0, successfulDrops: 0, failedDrops: 0, enemiesKilled: 0, turretsBuilt: 0, wavesCompleted: 0
    };
    const wavesCompleted = victory ? this.waveManager.getCurrentWave() : Math.max(0, this.waveManager.getCurrentWave() - 1);
    this.registry.set('playerStats', {
      ...stats,
      totalDrops: stats.totalDrops + 1,
      successfulDrops: stats.successfulDrops + (victory ? 1 : 0),
      failedDrops: stats.failedDrops + (victory ? 0 : 1),
      enemiesKilled: stats.enemiesKilled + this.enemiesKilled,
      turretsBuilt: stats.turretsBuilt + this.turretsBuilt,
      wavesCompleted: stats.wavesCompleted + wavesCompleted
    });
    if (victory) {
      this.registry.set('completedDrops', (this.registry.get('completedDrops') || 0) + 1);
    }

    const result: GameResult = {
      victory,
      energyEarned,
      materialsEarned,
      mineEstablished: mine,
      defendedMineName,
      wavesCompleted,
      totalWaves: this.totalWaves,
      baseHealth: this.baseHealth,
      enemiesKilled: this.enemiesKilled,
      turretsBuilt: this.turretsBuilt,
      turretsCollected,
      turretsLost,
      contract: this.activeContract.id === 'STANDARD' ? null : {
        id: this.activeContract.id,
        name: this.activeContract.name,
        objective: this.activeContract.objective,
        succeeded: contractSucceeded,
        bonusMaterial: contractBonusMaterial,
        bonusEnergy: contractBonusEnergy
      }
    };
    this.registry.set('gameResult', result);

    this.events.emit('missionEnded', victory);
    this.time.delayedCall(1500, () => this.scene.start(SCENES.RESULTS));
  }

  // ---------------------------------------------------------------- accessors

  public getBaseHealth(): number {
    return this.baseHealth;
  }

  public getPlanet(): PlanetData {
    return this.planet;
  }

  public getZone(): LandingZone {
    return this.zone;
  }

  public getCameraManager(): CameraManager {
    return this.cameraManager;
  }

  // ---------------------------------------------------------------- modifiers

  public isOrbitalDisabled(): boolean {
    return this.activeModifiers.some(m => m.effects.orbitalWeaponsDisabled);
  }

  public getEnemySpeedMultiplier(): number {
    let mul = 1;
    for (const m of this.activeModifiers) {
      if (m.effects.enemySpeedMul) mul *= m.effects.enemySpeedMul;
    }
    return mul;
  }

  public getTurretMultipliers(damageType: DamageType): { range: number; fireRate: number; damage: number } {
    let range = 1, fireRate = 1, damage = 1;
    for (const m of this.activeModifiers) {
      const types = m.effects.affectsDamageTypes;
      if (types && !types.includes(damageType)) continue;
      if (m.effects.turretRangeMul) range *= m.effects.turretRangeMul;
      if (m.effects.turretFireRateMul) fireRate *= m.effects.turretFireRateMul;
      if (m.effects.turretDamageMul) damage *= m.effects.turretDamageMul;
    }
    return { range, fireRate, damage };
  }
}
