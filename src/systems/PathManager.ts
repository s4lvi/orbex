import Phaser from 'phaser';
import { GRID_WIDTH, GRID_HEIGHT, TILE_SIZE, UI_MARGIN_X, UI_MARGIN_Y } from '../utils/Constants';
import { LandingZone } from '../scenes/LandingZoneSelectScene';

export interface PathPoint {
  x: number;
  y: number;
  worldX: number;
  worldY: number;
}

export class PathManager {
  private zone: LandingZone;
  private pathMap: boolean[][];
  private buildableMap: boolean[][];
  private occupiedMap: boolean[][];
  private paths: PathPoint[][];

  constructor(_scene: Phaser.Scene, zone: LandingZone) {
    this.zone = zone;

    // Initialize maps
    this.pathMap = this.createEmptyMap();
    this.buildableMap = this.createEmptyMap();
    this.occupiedMap = this.createEmptyMap();
    this.paths = [];

    // Generate paths and buildable areas
    this.generatePaths();
    this.calculateBuildableAreas();
  }

  private createEmptyMap(): boolean[][] {
    const map: boolean[][] = [];
    for (let y = 0; y < GRID_HEIGHT; y++) {
      map[y] = [];
      for (let x = 0; x < GRID_WIDTH; x++) {
        map[y][x] = false;
      }
    }
    return map;
  }

  private generatePaths(): void {
    this.zone.paths.forEach((pathData) => {
      const path: PathPoint[] = [];

      // Starting point (off-screen left)
      let prevX = -1;
      let prevY = pathData.startY;

      // Add starting point
      path.push(this.createPathPoint(0, pathData.startY));

      // Mark starting cell
      this.markPathCell(0, pathData.startY);

      // Process waypoints
      pathData.waypoints.forEach(waypoint => {
        // Create path from previous point to waypoint
        const cellsToMark = this.getPathCells(prevX, prevY, waypoint.x, waypoint.y);
        cellsToMark.forEach(cell => {
          this.markPathCell(cell.x, cell.y);
        });

        path.push(this.createPathPoint(waypoint.x, waypoint.y));

        prevX = waypoint.x;
        prevY = waypoint.y;
      });

      this.paths.push(path);
    });
  }

  private getPathCells(x1: number, y1: number, x2: number, y2: number): { x: number; y: number }[] {
    const cells: { x: number; y: number }[] = [];

    // Bresenham-like path with some vertical movement
    let currentX = Math.max(0, x1);
    let currentY = y1;
    const targetX = Math.min(GRID_WIDTH - 1, x2);
    const targetY = y2;

    while (currentX <= targetX) {
      cells.push({ x: currentX, y: currentY });

      // Move horizontally
      if (currentX < targetX) {
        currentX++;
      }

      // Gradually adjust Y
      if (currentY < targetY) {
        currentY++;
        cells.push({ x: currentX, y: currentY });
      } else if (currentY > targetY) {
        currentY--;
        cells.push({ x: currentX, y: currentY });
      }

      if (currentX >= targetX && currentY === targetY) {
        break;
      }
    }

    return cells;
  }

  private markPathCell(x: number, y: number): void {
    if (x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT) {
      this.pathMap[y][x] = true;
    }
  }

  private createPathPoint(gridX: number, gridY: number): PathPoint {
    return {
      x: gridX,
      y: gridY,
      worldX: UI_MARGIN_X + gridX * TILE_SIZE + TILE_SIZE / 2,
      worldY: UI_MARGIN_Y + gridY * TILE_SIZE + TILE_SIZE / 2
    };
  }

  private calculateBuildableAreas(): void {
    // Mark all non-path cells as buildable
    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        if (!this.pathMap[y][x]) {
          this.buildableMap[y][x] = true;
        }
      }
    }

    // Block the rightmost columns for the base
    for (let y = 0; y < GRID_HEIGHT; y++) {
      this.buildableMap[y][GRID_WIDTH - 1] = false;
      this.buildableMap[y][GRID_WIDTH - 2] = false;
    }
  }

  public isPath(x: number, y: number): boolean {
    if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) {
      return false;
    }
    return this.pathMap[y][x];
  }

  public isBuildable(x: number, y: number): boolean {
    if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) {
      return false;
    }
    return this.buildableMap[y][x] && !this.pathMap[y][x] && !this.occupiedMap[y][x];
  }

  public setOccupied(x: number, y: number, occupied: boolean): void {
    if (x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT) {
      this.occupiedMap[y][x] = occupied;
    }
  }

  public isOccupied(x: number, y: number): boolean {
    if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) {
      return true;
    }
    return this.occupiedMap[y][x];
  }

  public getPath(index: number): PathPoint[] {
    return this.paths[index] || this.paths[0];
  }

  public getPathCount(): number {
    return this.paths.length;
  }

  public getPathMap(): boolean[][] {
    return this.pathMap;
  }

  public getBuildableMap(): boolean[][] {
    return this.buildableMap;
  }

  public gridToWorld(gridX: number, gridY: number): { x: number; y: number } {
    return {
      x: UI_MARGIN_X + gridX * TILE_SIZE + TILE_SIZE / 2,
      y: UI_MARGIN_Y + gridY * TILE_SIZE + TILE_SIZE / 2
    };
  }

  public worldToGrid(worldX: number, worldY: number): { x: number; y: number } | null {
    const localX = worldX - UI_MARGIN_X;
    const localY = worldY - UI_MARGIN_Y;

    if (localX < 0 || localY < 0 || localX >= GRID_WIDTH * TILE_SIZE || localY >= GRID_HEIGHT * TILE_SIZE) {
      return null;
    }

    return {
      x: Math.floor(localX / TILE_SIZE),
      y: Math.floor(localY / TILE_SIZE)
    };
  }

  public getBasePosition(): { x: number; y: number } {
    return this.gridToWorld(GRID_WIDTH - 1, Math.floor(GRID_HEIGHT / 2));
  }
}
