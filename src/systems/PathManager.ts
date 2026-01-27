import Phaser from 'phaser';
import { TILE_SIZE, DEFAULT_GRID_WIDTH, DEFAULT_GRID_HEIGHT } from '../utils/Constants';
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

  // Grid dimensions (configurable per planet)
  private gridWidth: number;
  private gridHeight: number;

  constructor(_scene: Phaser.Scene, zone: LandingZone, gridWidth?: number, gridHeight?: number) {
    this.zone = zone;
    this.gridWidth = gridWidth || DEFAULT_GRID_WIDTH;
    this.gridHeight = gridHeight || DEFAULT_GRID_HEIGHT;

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
    for (let y = 0; y < this.gridHeight; y++) {
      map[y] = [];
      for (let x = 0; x < this.gridWidth; x++) {
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
    const targetX = Math.min(this.gridWidth - 1, x2);
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
    if (x >= 0 && x < this.gridWidth && y >= 0 && y < this.gridHeight) {
      this.pathMap[y][x] = true;
    }
  }

  private createPathPoint(gridX: number, gridY: number): PathPoint {
    // World coordinates are now at grid origin (0, 0) - no UI margin
    return {
      x: gridX,
      y: gridY,
      worldX: gridX * TILE_SIZE + TILE_SIZE / 2,
      worldY: gridY * TILE_SIZE + TILE_SIZE / 2
    };
  }

  private calculateBuildableAreas(): void {
    // Mark all non-path cells as buildable
    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        if (!this.pathMap[y][x]) {
          this.buildableMap[y][x] = true;
        }
      }
    }

    // Block the center area around the base (3x3 area)
    const centerX = Math.floor(this.gridWidth / 2);
    const centerY = Math.floor(this.gridHeight / 2);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const bx = centerX + dx;
        const by = centerY + dy;
        if (bx >= 0 && bx < this.gridWidth && by >= 0 && by < this.gridHeight) {
          this.buildableMap[by][bx] = false;
        }
      }
    }
  }

  public isPath(x: number, y: number): boolean {
    if (x < 0 || x >= this.gridWidth || y < 0 || y >= this.gridHeight) {
      return false;
    }
    return this.pathMap[y][x];
  }

  public isBuildable(x: number, y: number): boolean {
    if (x < 0 || x >= this.gridWidth || y < 0 || y >= this.gridHeight) {
      return false;
    }
    return this.buildableMap[y][x] && !this.pathMap[y][x] && !this.occupiedMap[y][x];
  }

  public setOccupied(x: number, y: number, occupied: boolean): void {
    if (x >= 0 && x < this.gridWidth && y >= 0 && y < this.gridHeight) {
      this.occupiedMap[y][x] = occupied;
    }
  }

  public isOccupied(x: number, y: number): boolean {
    if (x < 0 || x >= this.gridWidth || y < 0 || y >= this.gridHeight) {
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
    // World coordinates are now at grid origin (0, 0)
    return {
      x: gridX * TILE_SIZE + TILE_SIZE / 2,
      y: gridY * TILE_SIZE + TILE_SIZE / 2
    };
  }

  public worldToGrid(worldX: number, worldY: number): { x: number; y: number } | null {
    if (worldX < 0 || worldY < 0 ||
        worldX >= this.gridWidth * TILE_SIZE ||
        worldY >= this.gridHeight * TILE_SIZE) {
      return null;
    }

    return {
      x: Math.floor(worldX / TILE_SIZE),
      y: Math.floor(worldY / TILE_SIZE)
    };
  }

  public getBasePosition(): { x: number; y: number } {
    // Base is now at the center of the map
    const centerX = Math.floor(this.gridWidth / 2);
    const centerY = Math.floor(this.gridHeight / 2);
    return this.gridToWorld(centerX, centerY);
  }

  public getGridWidth(): number {
    return this.gridWidth;
  }

  public getGridHeight(): number {
    return this.gridHeight;
  }
}
