/**
 * SpatialGrid - Efficient spatial partitioning for collision detection
 * Reduces O(n*m) collision checks to O(n+m) average case by dividing
 * the game world into cells and only checking nearby entities.
 */

interface SpatialEntity {
  x: number;
  y: number;
  active: boolean;
}

export class SpatialGrid<T extends SpatialEntity> {
  private cellSize: number;
  private cells: Map<string, T[]> = new Map();

  constructor(cellSize: number = 64) {
    this.cellSize = cellSize;
  }

  /**
   * Clear all entities from the grid
   */
  public clear(): void {
    this.cells.clear();
  }

  /**
   * Get the cell key for a position
   */
  private getCellKey(x: number, y: number): string {
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);
    return `${cellX},${cellY}`;
  }

  /**
   * Insert an entity into the grid
   */
  public insert(entity: T): void {
    if (!entity.active) return;

    const key = this.getCellKey(entity.x, entity.y);
    if (!this.cells.has(key)) {
      this.cells.set(key, []);
    }
    this.cells.get(key)!.push(entity);
  }

  /**
   * Insert multiple entities into the grid
   */
  public insertAll(entities: T[]): void {
    for (const entity of entities) {
      this.insert(entity);
    }
  }

  /**
   * Get all entities in the same cell and adjacent cells
   */
  public getNearby(x: number, y: number): T[] {
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);
    const nearby: T[] = [];

    // Check 3x3 grid of cells (current + 8 neighbors)
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const key = `${cellX + dx},${cellY + dy}`;
        const cell = this.cells.get(key);
        if (cell) {
          for (const entity of cell) {
            if (entity.active) {
              nearby.push(entity);
            }
          }
        }
      }
    }

    return nearby;
  }

  /**
   * Query entities within a radius of a point
   */
  public queryRadius(x: number, y: number, radius: number): T[] {
    const nearby = this.getNearby(x, y);
    const radiusSq = radius * radius;

    return nearby.filter(entity => {
      const dx = entity.x - x;
      const dy = entity.y - y;
      return dx * dx + dy * dy <= radiusSq;
    });
  }
}
