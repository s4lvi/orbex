import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, TILE_SIZE } from '../utils/Constants';

// Camera constants
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.0;
const ZOOM_STEP = 0.1;
const PAN_SPEED = 1;

/**
 * CameraManager - Dual camera system for game world and UI
 *
 * Uses two cameras:
 * - Main camera: Renders game world, supports pan/zoom
 * - UI camera: Renders UI elements, stays fixed
 *
 * Controls:
 * - Right-click drag to pan
 * - Scroll wheel to zoom
 */
export class CameraManager {
  private scene: Phaser.Scene;
  private gameCamera: Phaser.Cameras.Scene2D.Camera;
  private uiCamera: Phaser.Cameras.Scene2D.Camera;

  // Map bounds
  private worldWidth: number;
  private worldHeight: number;

  // Pan state
  private isPanning: boolean = false;
  private panStartX: number = 0;
  private panStartY: number = 0;
  private cameraStartX: number = 0;
  private cameraStartY: number = 0;

  // Track UI objects to ignore on game camera
  private uiObjects: Phaser.GameObjects.GameObject[] = [];

  private canPanPredicate?: (pointer: Phaser.Input.Pointer) => boolean;
  private panPending: boolean = false;
  private panJustEnded: boolean = false;

  private readonly panThreshold: number = 6;

  private readonly handlePointerDown = (pointer: Phaser.Input.Pointer): void => {
    if (pointer.isDown && this.canPan(pointer)) {
      this.panPending = true;
      this.panStartX = pointer.x;
      this.panStartY = pointer.y;
      this.cameraStartX = this.gameCamera.scrollX;
      this.cameraStartY = this.gameCamera.scrollY;
    }
  };

  private readonly handlePointerMove = (pointer: Phaser.Input.Pointer): void => {
    if (this.isPanning) {
      if (pointer.isDown) {
        this.updatePan(pointer.x, pointer.y);
      } else {
        this.endPan();
      }
      return;
    }

    if (this.panPending) {
      if (!pointer.isDown) {
        this.panPending = false;
        return;
      }

      const dx = pointer.x - this.panStartX;
      const dy = pointer.y - this.panStartY;
      if (Math.hypot(dx, dy) >= this.panThreshold) {
        this.isPanning = true;
        this.updatePan(pointer.x, pointer.y);
      }
    }
  };

  private readonly handlePointerUp = (): void => {
    this.panPending = false;
    this.endPan();
  };

  private readonly handleWheel = (
    pointer: Phaser.Input.Pointer,
    _gameObjects: Phaser.GameObjects.GameObject[],
    _deltaX: number,
    deltaY: number
  ): void => {
    this.handleZoom(deltaY, pointer.x, pointer.y);
  };

  private readonly handleContextMenu = (e: Event): void => {
    e.preventDefault();
  };

  constructor(
    scene: Phaser.Scene,
    gridWidth: number,
    gridHeight: number,
    canPanPredicate?: (pointer: Phaser.Input.Pointer) => boolean
  ) {
    this.scene = scene;
    this.canPanPredicate = canPanPredicate;

    // Calculate world size based on grid
    this.worldWidth = gridWidth * TILE_SIZE;
    this.worldHeight = gridHeight * TILE_SIZE;

    // Main camera is the game camera
    this.gameCamera = scene.cameras.main;

    // Create a separate UI camera
    this.uiCamera = scene.cameras.add(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.uiCamera.setName('uiCamera');

    this.setupCamera();
    this.setupInput();

    // Ignore game objects on the UI camera by default.
    this.scene.sys.events.on('addedtoscene', this.onAddedToScene, this);
    this.scene.children.list.forEach((child) => this.onAddedToScene(child));
  }

  private setupCamera(): void {
    // Game camera setup
    this.gameCamera.setZoom(1);
    this.gameCamera.setBounds(0, 0, this.worldWidth, this.worldHeight);
    this.centerOnWorld();

    // UI camera stays fixed
    this.uiCamera.setScroll(0, 0);
    this.uiCamera.setZoom(1);
  }

  private centerOnWorld(): void {
    // Center game camera on the world
    const viewWidth = GAME_WIDTH / this.gameCamera.zoom;
    const viewHeight = GAME_HEIGHT / this.gameCamera.zoom;

    const scrollX = (this.worldWidth - viewWidth) / 2;
    const scrollY = (this.worldHeight - viewHeight) / 2;

    this.gameCamera.setScroll(
      Math.max(0, scrollX),
      Math.max(0, scrollY)
    );
  }

  private setupInput(): void {
    this.scene.input.on('pointerdown', this.handlePointerDown);
    this.scene.input.on('pointermove', this.handlePointerMove);
    this.scene.input.on('pointerup', this.handlePointerUp);
    this.scene.input.on('wheel', this.handleWheel);

    // Prevent context menu on right click
    this.scene.game.canvas.addEventListener('contextmenu', this.handleContextMenu);
  }

  private canPan(pointer: Phaser.Input.Pointer): boolean {
    return this.canPanPredicate ? this.canPanPredicate(pointer) : true;
  }

  private onAddedToScene(gameObject: Phaser.GameObjects.GameObject): void {
    const obj = gameObject as Phaser.GameObjects.GameObject & {
      getData?: (key: string) => unknown;
      parentContainer?: Phaser.GameObjects.Container | null;
      cameraFilter?: number;
    };

    if (obj.getData && obj.getData('isUI')) {
      return;
    }

    if (obj.parentContainer && obj.parentContainer.getData && obj.parentContainer.getData('isUI')) {
      this.markAsUI(obj);
      return;
    }

    if (typeof obj.cameraFilter === 'number') {
      obj.cameraFilter |= this.uiCamera.id;
    }
  }

  private updatePan(screenX: number, screenY: number): void {
    if (!this.isPanning) return;

    const deltaX = (this.panStartX - screenX) / this.gameCamera.zoom * PAN_SPEED;
    const deltaY = (this.panStartY - screenY) / this.gameCamera.zoom * PAN_SPEED;

    this.gameCamera.setScroll(
      this.cameraStartX + deltaX,
      this.cameraStartY + deltaY
    );
  }

  private endPan(): void {
    if (this.isPanning) {
      this.panJustEnded = true;
    }
    this.isPanning = false;
  }

  private handleZoom(deltaY: number, screenX?: number, screenY?: number): void {
    const oldZoom = this.gameCamera.zoom;
    let newZoom: number;

    if (deltaY > 0) {
      newZoom = Math.max(MIN_ZOOM, oldZoom - ZOOM_STEP);
    } else {
      newZoom = Math.min(MAX_ZOOM, oldZoom + ZOOM_STEP);
    }

    if (newZoom !== oldZoom) {
      if (screenX !== undefined && screenY !== undefined) {
        // Keep the cursor position fixed during zoom
        const worldX = this.gameCamera.scrollX + screenX / oldZoom;
        const worldY = this.gameCamera.scrollY + screenY / oldZoom;

        this.gameCamera.setZoom(newZoom);

        const newScrollX = worldX - screenX / newZoom;
        const newScrollY = worldY - screenY / newZoom;
        const viewWidth = GAME_WIDTH / newZoom;
        const viewHeight = GAME_HEIGHT / newZoom;

        this.gameCamera.setScroll(
          Phaser.Math.Clamp(newScrollX, 0, Math.max(0, this.worldWidth - viewWidth)),
          Phaser.Math.Clamp(newScrollY, 0, Math.max(0, this.worldHeight - viewHeight))
        );
      } else {
        // Keep the center point fixed during zoom
        const centerWorldX = this.gameCamera.scrollX + (GAME_WIDTH / 2) / oldZoom;
        const centerWorldY = this.gameCamera.scrollY + (GAME_HEIGHT / 2) / oldZoom;

        this.gameCamera.setZoom(newZoom);

        const newScrollX = centerWorldX - (GAME_WIDTH / 2) / newZoom;
        const newScrollY = centerWorldY - (GAME_HEIGHT / 2) / newZoom;

        this.gameCamera.setScroll(newScrollX, newScrollY);
      }
    }
  }

  /**
   * Register a UI object - it will be rendered by UI camera only
   * Call this for all UI elements (HUD, menus, etc.)
   */
  public addUIObject(obj: Phaser.GameObjects.GameObject | Phaser.GameObjects.Container): void {
    this.uiObjects.push(obj);
    this.markAsUI(obj);
    // UI object should be ignored by the game camera
    this.gameCamera.ignore(obj);
    // And if it's a container, ignore all children too
    if (obj instanceof Phaser.GameObjects.Container) {
      obj.each((child: Phaser.GameObjects.GameObject) => {
        this.gameCamera.ignore(child);
      });
    }
  }

  /**
   * Register a game object - it will be rendered by game camera only
   * Call this for game world elements that shouldn't appear on UI camera
   */
  public addGameObject(obj: Phaser.GameObjects.GameObject | Phaser.GameObjects.Container): void {
    // Game objects should be ignored by UI camera
    this.uiCamera.ignore(obj);
    if (obj instanceof Phaser.GameObjects.Container) {
      obj.each((child: Phaser.GameObjects.GameObject) => {
        this.uiCamera.ignore(child);
      });
    }
  }

  /**
   * Convert screen coordinates to world coordinates
   */
  public screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const worldPoint = this.gameCamera.getWorldPoint(screenX, screenY);
    return { x: worldPoint.x, y: worldPoint.y };
  }

  /**
   * Convert world coordinates to screen coordinates
   */
  public worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: (worldX - this.gameCamera.scrollX) * this.gameCamera.zoom,
      y: (worldY - this.gameCamera.scrollY) * this.gameCamera.zoom
    };
  }

  /**
   * Center camera on a specific world position
   */
  public centerOn(worldX: number, worldY: number): void {
    this.gameCamera.setScroll(
      worldX - (GAME_WIDTH / 2) / this.gameCamera.zoom,
      worldY - (GAME_HEIGHT / 2) / this.gameCamera.zoom
    );
  }

  /**
   * Get current zoom level
   */
  public getZoom(): number {
    return this.gameCamera.zoom;
  }

  /**
   * Check if panning is currently active
   */
  public isPanningActive(): boolean {
    return this.isPanning;
  }

  /**
   * Get the visible world bounds
   */
  public getVisibleBounds(): { x: number; y: number; width: number; height: number } {
    return {
      x: this.gameCamera.scrollX,
      y: this.gameCamera.scrollY,
      width: GAME_WIDTH / this.gameCamera.zoom,
      height: GAME_HEIGHT / this.gameCamera.zoom
    };
  }

  /**
   * Reset camera to default view
   */
  public reset(): void {
    this.gameCamera.setZoom(1);
    this.centerOnWorld();
  }

  /**
   * Get the UI camera for manual management
   */
  public getUICamera(): Phaser.Cameras.Scene2D.Camera {
    return this.uiCamera;
  }

  /**
   * Get the game camera for manual management
   */
  public getGameCamera(): Phaser.Cameras.Scene2D.Camera {
    return this.gameCamera;
  }

  public markAsUI(obj: Phaser.GameObjects.GameObject | Phaser.GameObjects.Container): void {
    const clearUIIgnore = (entry: Phaser.GameObjects.GameObject): void => {
      const typed = entry as Phaser.GameObjects.GameObject & {
        cameraFilter?: number;
        setData?: (key: string, value: unknown) => void;
      };
      if (typeof typed.cameraFilter === 'number') {
        typed.cameraFilter &= ~this.uiCamera.id;
      }
      if (typed.setData) {
        typed.setData('isUI', true);
      }

      if (entry instanceof Phaser.GameObjects.Container) {
        entry.each((child: Phaser.GameObjects.GameObject) => {
          clearUIIgnore(child);
        });
      }
    };

    clearUIIgnore(obj);
  }

  public consumePanFlag(): boolean {
    const didPan = this.panJustEnded;
    this.panJustEnded = false;
    return didPan;
  }

  /**
   * Destroy and clean up
   */
  public destroy(): void {
    this.isPanning = false;
    this.panPending = false;
    this.uiObjects = [];
    this.scene.sys.events.off('addedtoscene', this.onAddedToScene, this);
    this.scene.input.off('pointerdown', this.handlePointerDown);
    this.scene.input.off('pointermove', this.handlePointerMove);
    this.scene.input.off('pointerup', this.handlePointerUp);
    this.scene.input.off('wheel', this.handleWheel);
    this.scene.game.canvas.removeEventListener('contextmenu', this.handleContextMenu);
    // Remove the UI camera
    if (this.uiCamera) {
      this.scene.cameras.remove(this.uiCamera);
    }
  }
}
