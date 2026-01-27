import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, TILE_SIZE } from '../utils/Constants';

/**
 * CameraManager - Centers the camera on the game world
 *
 * Note: Pan/zoom is disabled for now to avoid UI input issues.
 * The camera is centered on the map at zoom 1.
 */
export class CameraManager {
  private camera: Phaser.Cameras.Scene2D.Camera;

  // Map bounds
  private worldWidth: number;
  private worldHeight: number;

  constructor(scene: Phaser.Scene, gridWidth: number, gridHeight: number) {
    this.camera = scene.cameras.main;

    // Calculate world size based on grid
    this.worldWidth = gridWidth * TILE_SIZE;
    this.worldHeight = gridHeight * TILE_SIZE;

    this.setupCamera();
  }

  private setupCamera(): void {
    // Keep zoom at 1 and no scroll for now
    // This ensures UI input works correctly
    this.camera.setZoom(1);
    this.camera.setScroll(0, 0);
  }

  /**
   * Convert screen coordinates to world coordinates
   * With no scroll, these are the same
   */
  public screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return { x: screenX, y: screenY };
  }

  /**
   * Convert world coordinates to screen coordinates
   * With no scroll, these are the same
   */
  public worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return { x: worldX, y: worldY };
  }

  /**
   * Center camera on a specific world position
   */
  public centerOn(worldX: number, worldY: number): void {
    this.camera.setScroll(
      worldX - GAME_WIDTH / 2,
      worldY - GAME_HEIGHT / 2
    );
  }

  /**
   * Get current zoom level (always 1)
   */
  public getZoom(): number {
    return 1;
  }

  /**
   * Check if panning is currently active (always false for now)
   */
  public isPanningActive(): boolean {
    return false;
  }

  /**
   * Get the visible world bounds
   */
  public getVisibleBounds(): { x: number; y: number; width: number; height: number } {
    return {
      x: this.camera.scrollX,
      y: this.camera.scrollY,
      width: GAME_WIDTH,
      height: GAME_HEIGHT
    };
  }

  /**
   * Reset camera to default view
   */
  public reset(): void {
    this.centerOn(this.worldWidth / 2, this.worldHeight / 2);
  }

  /**
   * Destroy and clean up
   */
  public destroy(): void {
    // Nothing to clean up
  }
}
