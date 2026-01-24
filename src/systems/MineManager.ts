import Phaser from 'phaser';
import { MaterialType } from '../utils/Constants';

/**
 * Represents a single extraction site (mine) from a successful drop
 */
export interface Mine {
  id: string;
  planetId: string;
  zoneName: string;
  resourceGeneration: { [key in MaterialType]?: number };
  establishedAt: number; // timestamp
}

/**
 * Baseline resources granted per wave (before mine bonuses)
 */
export const BASELINE_RESUPPLY: { [key in MaterialType]?: number } = {
  [MaterialType.CARBOX]: 50,
  [MaterialType.HYDRON]: 50
};

/**
 * MineManager - Tracks extraction sites from successful drops
 *
 * Each successful mission establishes a "mine" that provides
 * per-wave resource generation in future missions.
 */
export class MineManager {
  private scene: Phaser.Scene;
  private mines: Mine[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.loadMines();
  }

  /**
   * Load mines from registry
   */
  private loadMines(): void {
    const savedMines = this.scene.registry.get('mines');
    if (savedMines && Array.isArray(savedMines)) {
      this.mines = savedMines;
    }
  }

  /**
   * Save mines to registry
   */
  private saveMines(): void {
    this.scene.registry.set('mines', [...this.mines]);
  }

  /**
   * Register a new mine from a successful drop
   */
  public registerMine(
    planetId: string,
    zoneName: string,
    resourceGeneration: { [key in MaterialType]?: number }
  ): Mine {
    const mine: Mine = {
      id: `mine_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      planetId,
      zoneName,
      resourceGeneration,
      establishedAt: Date.now()
    };

    this.mines.push(mine);
    this.saveMines();

    console.log(`[MineManager] Registered new mine: ${mine.zoneName}`, mine.resourceGeneration);
    return mine;
  }

  /**
   * Get all registered mines
   */
  public getMines(): Mine[] {
    return [...this.mines];
  }

  /**
   * Get mines for a specific planet
   */
  public getMinesForPlanet(planetId: string): Mine[] {
    return this.mines.filter(m => m.planetId === planetId);
  }

  /**
   * Calculate total resource generation from all mines
   */
  public getTotalMineGeneration(): { [key in MaterialType]?: number } {
    const total: { [key in MaterialType]?: number } = {};

    this.mines.forEach(mine => {
      Object.entries(mine.resourceGeneration).forEach(([material, amount]) => {
        const matType = material as MaterialType;
        total[matType] = (total[matType] || 0) + (amount || 0);
      });
    });

    return total;
  }

  /**
   * Calculate the per-wave resupply amount (baseline + mine bonuses)
   */
  public calculateWaveResupply(): { [key in MaterialType]?: number } {
    const resupply: { [key in MaterialType]?: number } = { ...BASELINE_RESUPPLY };
    const mineBonus = this.getTotalMineGeneration();

    // Add mine bonuses to baseline
    Object.entries(mineBonus).forEach(([material, amount]) => {
      const matType = material as MaterialType;
      resupply[matType] = (resupply[matType] || 0) + (amount || 0);
    });

    return resupply;
  }

  /**
   * Get the number of established mines
   */
  public getMineCount(): number {
    return this.mines.length;
  }

  /**
   * Format resupply for display
   */
  public formatResupply(resupply: { [key in MaterialType]?: number }): string {
    return Object.entries(resupply)
      .filter(([_, amount]) => amount && amount > 0)
      .map(([material, amount]) => `+${amount} ${material}`)
      .join(', ');
  }
}
