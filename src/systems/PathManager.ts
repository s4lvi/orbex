import { TILE_SIZE, DEFAULT_GRID_WIDTH, DEFAULT_GRID_HEIGHT } from '../utils/Constants';
import { PathData } from '../types/GameData';

export interface PathPoint {
  x: number;        // grid column
  y: number;        // grid row
  worldX: number;
  worldY: number;
  /** World-space distance remaining along the path from this point to the base. */
  remaining: number;
}

/**
 * Rasterises landing-zone paths onto the grid, derives buildable cells, and
 * hands enemies the world-space polyline they follow.
 */
export class PathManager {
  private pathMap: boolean[][];
  private buildableMap: boolean[][];
  private occupiedMap: boolean[][];
  private paths: PathPoint[][] = [];
  private gridWidth: number;
  private gridHeight: number;

  constructor(pathData: PathData[], gridWidth?: number, gridHeight?: number) {
    this.gridWidth = gridWidth || DEFAULT_GRID_WIDTH;
    this.gridHeight = gridHeight || DEFAULT_GRID_HEIGHT;

    this.pathMap = this.createEmptyMap();
    this.buildableMap = this.createEmptyMap();
    this.occupiedMap = this.createEmptyMap();

    this.generatePaths(pathData);
    this.calculateBuildableAreas();
  }

  private createEmptyMap(): boolean[][] {
    const map: boolean[][] = [];
    for (let y = 0; y < this.gridHeight; y++) {
      map[y] = new Array<boolean>(this.gridWidth).fill(false);
    }
    return map;
  }

  private generatePaths(pathData: PathData[]): void {
    pathData.forEach((data) => {
      const cells = [{ x: data.startX, y: data.startY }, ...data.waypoints]
        .map(c => this.clampCell(c.x, c.y));

      // Mark every grid cell the polyline passes through so traps can be
      // placed on it and turrets cannot.
      for (let i = 0; i < cells.length - 1; i++) {
        this.rasterizeSegment(cells[i], cells[i + 1]).forEach(c => this.markPathCell(c.x, c.y));
      }
      if (cells.length === 1) this.markPathCell(cells[0].x, cells[0].y);

      // Build the polyline with remaining-distance annotations (walked backwards).
      const points: PathPoint[] = cells.map(c => ({
        x: c.x,
        y: c.y,
        worldX: c.x * TILE_SIZE + TILE_SIZE / 2,
        worldY: c.y * TILE_SIZE + TILE_SIZE / 2,
        remaining: 0
      }));
      for (let i = points.length - 2; i >= 0; i--) {
        const a = points[i];
        const b = points[i + 1];
        a.remaining = b.remaining + Math.hypot(b.worldX - a.worldX, b.worldY - a.worldY);
      }

      this.paths.push(points);
    });
  }

  private clampCell(x: number, y: number): { x: number; y: number } {
    return {
      x: Math.max(0, Math.min(this.gridWidth - 1, Math.round(x))),
      y: Math.max(0, Math.min(this.gridHeight - 1, Math.round(y)))
    };
  }

  /** Bresenham line between two grid cells (inclusive). */
  private rasterizeSegment(a: { x: number; y: number }, b: { x: number; y: number }): { x: number; y: number }[] {
    const cells: { x: number; y: number }[] = [];
    let x0 = a.x, y0 = a.y;
    const x1 = b.x, y1 = b.y;
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;

    for (let guard = 0; guard < this.gridWidth * this.gridHeight; guard++) {
      cells.push({ x: x0, y: y0 });
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return cells;
  }

  private markPathCell(x: number, y: number): void {
    if (x >= 0 && x < this.gridWidth && y >= 0 && y < this.gridHeight) {
      this.pathMap[y][x] = true;
    }
  }

  private calculateBuildableAreas(): void {
    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        this.buildableMap[y][x] = !this.pathMap[y][x];
      }
    }

    // Reserve the 3x3 block around the base.
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
    if (x < 0 || x >= this.gridWidth || y < 0 || y >= this.gridHeight) return false;
    return this.pathMap[y][x];
  }

  public isBuildable(x: number, y: number): boolean {
    if (x < 0 || x >= this.gridWidth || y < 0 || y >= this.gridHeight) return false;
    return this.buildableMap[y][x] && !this.occupiedMap[y][x];
  }

  public setOccupied(x: number, y: number, occupied: boolean): void {
    if (x >= 0 && x < this.gridWidth && y >= 0 && y < this.gridHeight) {
      this.occupiedMap[y][x] = occupied;
    }
  }

  public isOccupied(x: number, y: number): boolean {
    if (x < 0 || x >= this.gridWidth || y < 0 || y >= this.gridHeight) return true;
    return this.occupiedMap[y][x];
  }

  public getPath(index: number): PathPoint[] {
    return this.paths[index] || this.paths[0];
  }

  public getPathCount(): number {
    return this.paths.length;
  }

  /**
   * Where an enemy on this path should appear: one tile beyond the map edge
   * the path enters from, so it walks on-screen rather than popping in.
   */
  public getSpawnWorldPosition(index: number): { x: number; y: number } {
    const start = this.getPath(index)[0];
    let x = start.worldX;
    let y = start.worldY;
    if (start.x === 0) x -= TILE_SIZE;
    else if (start.x === this.gridWidth - 1) x += TILE_SIZE;
    else if (start.y === 0) y -= TILE_SIZE;
    else if (start.y === this.gridHeight - 1) y += TILE_SIZE;
    return { x, y };
  }

  public getPathMap(): boolean[][] {
    return this.pathMap;
  }

  public getBuildableMap(): boolean[][] {
    return this.buildableMap;
  }

  public gridToWorld(gridX: number, gridY: number): { x: number; y: number } {
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
    return this.gridToWorld(Math.floor(this.gridWidth / 2), Math.floor(this.gridHeight / 2));
  }

  public getGridWidth(): number {
    return this.gridWidth;
  }

  public getGridHeight(): number {
    return this.gridHeight;
  }
}
