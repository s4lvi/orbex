import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, TILE_SIZE, UI_INSETS } from '../utils/Constants';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.0;
const ZOOM_STEP = 0.1;

/**
 * CameraManager - dual camera system for game world and UI.
 *
 * - Main camera renders the map and supports drag-pan, wheel zoom and pinch zoom.
 * - UI camera renders HUD elements and never moves.
 *
 * The map is fitted and clamped to the "play area": the screen minus the HUD
 * insets. Maps smaller than the play area are centred inside it.
 */
export class CameraManager {
  private scene: Phaser.Scene;
  private gameCamera: Phaser.Cameras.Scene2D.Camera;
  private uiCamera: Phaser.Cameras.Scene2D.Camera;

  private worldWidth: number;
  private worldHeight: number;

  private isPanning: boolean = false;
  private panPending: boolean = false;
  private panJustEnded: boolean = false;
  private panStartX: number = 0;
  private panStartY: number = 0;
  private cameraStartX: number = 0;
  private cameraStartY: number = 0;
  private readonly panThreshold: number = 6;

  private pinchActive: boolean = false;
  private pinchStartDistance: number = 0;
  private pinchStartZoom: number = 1;

  private canPanPredicate?: (pointer: Phaser.Input.Pointer) => boolean;

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
    const pointers = this.getPinchPointers();
    if (pointers) {
      this.panPending = false;
      this.isPanning = false;
      this.updatePinch(pointers[0], pointers[1]);
      return;
    }

    if (this.pinchActive) {
      this.pinchActive = false;
      this.panJustEnded = true;
    }

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
    if (this.pinchActive && !this.getPinchPointers()) {
      this.pinchActive = false;
      this.panJustEnded = true;
    }
    this.panPending = false;
    this.endPan();
  };

  private readonly handleWheel = (
    pointer: Phaser.Input.Pointer,
    _gameObjects: Phaser.GameObjects.GameObject[],
    _deltaX: number,
    deltaY: number
  ): void => {
    const oldZoom = this.gameCamera.zoom;
    const newZoom = deltaY > 0
      ? Math.max(MIN_ZOOM, oldZoom - ZOOM_STEP)
      : Math.min(MAX_ZOOM, oldZoom + ZOOM_STEP);
    this.zoomAround(newZoom, pointer.x, pointer.y);
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

    // Enable a second touch pointer for pinch zoom.
    this.scene.input.addPointer(1);

    this.worldWidth = gridWidth * TILE_SIZE;
    this.worldHeight = gridHeight * TILE_SIZE;

    this.gameCamera = scene.cameras.main;
    this.uiCamera = scene.cameras.add(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.uiCamera.setName('uiCamera');
    this.uiCamera.setScroll(0, 0);
    this.uiCamera.setZoom(1);

    this.reset();
    this.setupInput();

    // Everything added to the scene is a world object unless flagged as UI.
    this.scene.sys.events.on('addedtoscene', this.onAddedToScene, this);
    this.scene.children.list.forEach((child) => this.onAddedToScene(child));
  }

  // ---------------------------------------------------------------- geometry

  private playArea(): { x: number; y: number; width: number; height: number } {
    return {
      x: UI_INSETS.left,
      y: UI_INSETS.top,
      width: GAME_WIDTH - UI_INSETS.left - UI_INSETS.right,
      height: GAME_HEIGHT - UI_INSETS.top - UI_INSETS.bottom
    };
  }

  /** Scroll value that places `world` at screen coordinate `screen` on one axis. */
  private scrollFor(world: number, screen: number, zoom: number, viewSize: number): number {
    return world - viewSize / 2 - (screen - viewSize / 2) / zoom;
  }

  /** Clamp a scroll position so the map stays inside the play area (or centred if smaller). */
  private clampScroll(x: number, y: number): { x: number; y: number } {
    const zoom = this.gameCamera.zoom;
    const area = this.playArea();

    const clampAxis = (value: number, worldSize: number, areaStart: number, areaSize: number, viewSize: number): number => {
      const atStart = this.scrollFor(0, areaStart, zoom, viewSize);                 // world edge on area's near edge
      const atEnd = this.scrollFor(worldSize, areaStart + areaSize, zoom, viewSize); // world far edge on area's far edge
      if (atEnd <= atStart) {
        // World is smaller than the area: centre it.
        return this.scrollFor(worldSize / 2, areaStart + areaSize / 2, zoom, viewSize);
      }
      return Phaser.Math.Clamp(value, atStart, atEnd);
    };

    return {
      x: clampAxis(x, this.worldWidth, area.x, area.width, GAME_WIDTH),
      y: clampAxis(y, this.worldHeight, area.y, area.height, GAME_HEIGHT)
    };
  }

  private applyScroll(x: number, y: number): void {
    const clamped = this.clampScroll(x, y);
    this.gameCamera.setScroll(clamped.x, clamped.y);
  }

  private centerOnWorld(): void {
    this.applyScroll(0, 0); // clampScroll centres when the world fits; otherwise:
    const area = this.playArea();
    const zoom = this.gameCamera.zoom;
    this.applyScroll(
      this.scrollFor(this.worldWidth / 2, area.x + area.width / 2, zoom, GAME_WIDTH),
      this.scrollFor(this.worldHeight / 2, area.y + area.height / 2, zoom, GAME_HEIGHT)
    );
  }

  /** Zoom so the whole map fits in the play area (never zooming in past 1:1). */
  public fitToPlayArea(): void {
    const area = this.playArea();
    const fit = Math.min(area.width / this.worldWidth, area.height / this.worldHeight);
    this.gameCamera.setZoom(Phaser.Math.Clamp(fit, MIN_ZOOM, 1));
    this.centerOnWorld();
  }

  private zoomAround(newZoom: number, screenX: number, screenY: number): void {
    if (newZoom === this.gameCamera.zoom) return;
    const anchor = this.gameCamera.getWorldPoint(screenX, screenY);
    this.gameCamera.setZoom(newZoom);
    this.applyScroll(
      this.scrollFor(anchor.x, screenX, newZoom, GAME_WIDTH),
      this.scrollFor(anchor.y, screenY, newZoom, GAME_HEIGHT)
    );
  }

  // ---------------------------------------------------------------- input

  private setupInput(): void {
    this.scene.input.on('pointerdown', this.handlePointerDown);
    this.scene.input.on('pointermove', this.handlePointerMove);
    this.scene.input.on('pointerup', this.handlePointerUp);
    this.scene.input.on('wheel', this.handleWheel);
    this.scene.game.canvas.addEventListener('contextmenu', this.handleContextMenu);
  }

  private canPan(pointer: Phaser.Input.Pointer): boolean {
    return this.canPanPredicate ? this.canPanPredicate(pointer) : true;
  }

  private updatePan(screenX: number, screenY: number): void {
    if (!this.isPanning) return;
    const zoom = this.gameCamera.zoom;
    this.applyScroll(
      this.cameraStartX + (this.panStartX - screenX) / zoom,
      this.cameraStartY + (this.panStartY - screenY) / zoom
    );
  }

  private endPan(): void {
    if (this.isPanning) {
      this.panJustEnded = true;
    }
    this.isPanning = false;
  }

  private getPinchPointers(): [Phaser.Input.Pointer, Phaser.Input.Pointer] | null {
    const input = this.scene.input;
    const p1 = input.pointer1;
    const p2 = input.pointer2;
    if (p1 && p2 && p1.isDown && p2.isDown) {
      return [p1, p2];
    }
    return null;
  }

  private updatePinch(p1: Phaser.Input.Pointer, p2: Phaser.Input.Pointer): void {
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    const distance = Math.hypot(p1.x - p2.x, p1.y - p2.y);

    if (!this.pinchActive) {
      this.pinchActive = true;
      this.pinchStartDistance = distance;
      this.pinchStartZoom = this.gameCamera.zoom;
      return;
    }
    if (this.pinchStartDistance <= 0) return;

    const newZoom = Phaser.Math.Clamp(this.pinchStartZoom * (distance / this.pinchStartDistance), MIN_ZOOM, MAX_ZOOM);
    this.zoomAround(newZoom, midX, midY);
  }

  // ---------------------------------------------------------------- camera assignment

  private onAddedToScene(gameObject: Phaser.GameObjects.GameObject): void {
    const obj = gameObject as Phaser.GameObjects.GameObject & {
      getData?: (key: string) => unknown;
      parentContainer?: Phaser.GameObjects.Container | null;
      cameraFilter?: number;
    };

    if (obj.getData && obj.getData('isUI')) return;

    if (obj.parentContainer && obj.parentContainer.getData && obj.parentContainer.getData('isUI')) {
      this.markAsUI(obj);
      return;
    }

    if (typeof obj.cameraFilter === 'number') {
      obj.cameraFilter |= this.uiCamera.id;
    }
  }

  /** Register a UI object: rendered by the UI camera only. */
  public addUIObject(obj: Phaser.GameObjects.GameObject | Phaser.GameObjects.Container): void {
    this.markAsUI(obj);
    this.gameCamera.ignore(obj);
    if (obj instanceof Phaser.GameObjects.Container) {
      obj.each((child: Phaser.GameObjects.GameObject) => this.gameCamera.ignore(child));
    }
  }

  /** Register a world object: rendered by the game camera only. */
  public addGameObject(obj: Phaser.GameObjects.GameObject | Phaser.GameObjects.Container): void {
    this.uiCamera.ignore(obj);
    if (obj instanceof Phaser.GameObjects.Container) {
      obj.each((child: Phaser.GameObjects.GameObject) => this.uiCamera.ignore(child));
    }
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
        entry.each((child: Phaser.GameObjects.GameObject) => clearUIIgnore(child));
      }
    };
    clearUIIgnore(obj);
  }

  // ---------------------------------------------------------------- queries

  public screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const p = this.gameCamera.getWorldPoint(screenX, screenY);
    return { x: p.x, y: p.y };
  }

  public worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    const zoom = this.gameCamera.zoom;
    return {
      x: GAME_WIDTH / 2 + (worldX - this.gameCamera.scrollX - GAME_WIDTH / 2) * zoom,
      y: GAME_HEIGHT / 2 + (worldY - this.gameCamera.scrollY - GAME_HEIGHT / 2) * zoom
    };
  }

  public centerOn(worldX: number, worldY: number): void {
    const area = this.playArea();
    const zoom = this.gameCamera.zoom;
    this.applyScroll(
      this.scrollFor(worldX, area.x + area.width / 2, zoom, GAME_WIDTH),
      this.scrollFor(worldY, area.y + area.height / 2, zoom, GAME_HEIGHT)
    );
  }

  public getZoom(): number {
    return this.gameCamera.zoom;
  }

  public isPanningActive(): boolean {
    return this.isPanning;
  }

  /** Reset to the default fitted view. */
  public reset(): void {
    this.fitToPlayArea();
  }

  public getUICamera(): Phaser.Cameras.Scene2D.Camera {
    return this.uiCamera;
  }

  public getGameCamera(): Phaser.Cameras.Scene2D.Camera {
    return this.gameCamera;
  }

  /** True once if a pan or pinch just finished (so the release isn't treated as a click). */
  public consumePanFlag(): boolean {
    const didPan = this.panJustEnded;
    this.panJustEnded = false;
    return didPan;
  }

  public destroy(): void {
    this.isPanning = false;
    this.panPending = false;
    this.scene.sys.events.off('addedtoscene', this.onAddedToScene, this);
    this.scene.input.off('pointerdown', this.handlePointerDown);
    this.scene.input.off('pointermove', this.handlePointerMove);
    this.scene.input.off('pointerup', this.handlePointerUp);
    this.scene.input.off('wheel', this.handleWheel);
    this.scene.game.canvas.removeEventListener('contextmenu', this.handleContextMenu);
    if (this.uiCamera) {
      this.scene.cameras.remove(this.uiCamera);
    }
  }
}
