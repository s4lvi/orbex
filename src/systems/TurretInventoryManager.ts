import Phaser from 'phaser';
import { TurretInstance, TurretInventory } from '../types/GameData';
import { TurretType } from '../utils/Constants';

const REGISTRY_KEY = 'turretInventory';
const DEFAULT_MAX_CAPACITY = 20;

/**
 * TurretInventoryManager - Manages turret persistence across missions
 *
 * Features:
 * - Store turrets that survive missions
 * - Place inventory turrets for free in next mission
 * - Track turrets bought during mission vs inventory turrets
 * - Handle victory (all surviving turrets to inventory) vs defeat (only inventory turrets return)
 */
export class TurretInventoryManager {
  private registry: Phaser.Data.DataManager;

  constructor(scene: Phaser.Scene) {
    this.registry = scene.registry;
    this.ensureInventoryExists();
  }

  /**
   * Ensure inventory exists in registry
   */
  private ensureInventoryExists(): void {
    if (!this.registry.get(REGISTRY_KEY)) {
      this.registry.set(REGISTRY_KEY, this.getDefaultInventory());
    }
  }

  private getDefaultInventory(): TurretInventory {
    return {
      turrets: [],
      maxCapacity: DEFAULT_MAX_CAPACITY
    };
  }

  /**
   * Get current turret inventory
   */
  public getInventory(): TurretInventory {
    return this.registry.get(REGISTRY_KEY) || this.getDefaultInventory();
  }

  /**
   * Save inventory to registry
   */
  private saveInventory(inventory: TurretInventory): void {
    this.registry.set(REGISTRY_KEY, {
      turrets: [...inventory.turrets],
      maxCapacity: inventory.maxCapacity
    });
  }

  /**
   * Add a turret to inventory
   */
  public addTurret(turret: TurretInstance): boolean {
    const inventory = this.getInventory();

    if (inventory.turrets.length >= inventory.maxCapacity) {
      console.warn('[TurretInventory] Inventory full, cannot add turret');
      return false;
    }

    // Ensure unique ID
    if (!turret.id) {
      turret.id = this.generateTurretId();
    }

    inventory.turrets.push({ ...turret });
    this.saveInventory(inventory);
    return true;
  }

  /**
   * Add multiple turrets to inventory
   */
  public addTurrets(turrets: TurretInstance[]): number {
    let added = 0;
    for (const turret of turrets) {
      if (this.addTurret(turret)) {
        added++;
      }
    }
    return added;
  }

  /**
   * Remove a turret from inventory by ID
   */
  public removeTurret(turretId: string): TurretInstance | null {
    const inventory = this.getInventory();
    const index = inventory.turrets.findIndex(t => t.id === turretId);

    if (index === -1) {
      return null;
    }

    const [removed] = inventory.turrets.splice(index, 1);
    this.saveInventory(inventory);
    return removed;
  }

  /**
   * Get a turret from inventory by ID (without removing)
   */
  public getTurret(turretId: string): TurretInstance | null {
    const inventory = this.getInventory();
    return inventory.turrets.find(t => t.id === turretId) || null;
  }

  /**
   * Get all turrets of a specific type
   */
  public getTurretsByType(type: TurretType | string): TurretInstance[] {
    const inventory = this.getInventory();
    return inventory.turrets.filter(t => t.type === type);
  }

  /**
   * Get count of turrets by type
   */
  public getCountByType(type: TurretType | string): number {
    return this.getTurretsByType(type).length;
  }

  /**
   * Get total turret count
   */
  public getTotalCount(): number {
    return this.getInventory().turrets.length;
  }

  /**
   * Get available capacity
   */
  public getAvailableCapacity(): number {
    const inventory = this.getInventory();
    return inventory.maxCapacity - inventory.turrets.length;
  }

  /**
   * Check if inventory is full
   */
  public isFull(): boolean {
    return this.getAvailableCapacity() <= 0;
  }

  /**
   * Clear all turrets from inventory
   */
  public clear(): void {
    this.registry.set(REGISTRY_KEY, this.getDefaultInventory());
  }

  /**
   * Set max capacity (for upgrades)
   */
  public setMaxCapacity(capacity: number): void {
    const inventory = this.getInventory();
    inventory.maxCapacity = capacity;
    this.saveInventory(inventory);
  }

  /**
   * Generate unique turret ID
   */
  public generateTurretId(): string {
    return `turret_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create a turret instance from placement data
   */
  public createTurretInstance(type: TurretType | string, level: number = 1, appliedUpgrades: string[] = []): TurretInstance {
    return {
      id: this.generateTurretId(),
      type: type.toString(),
      level,
      appliedUpgrades: [...appliedUpgrades]
    };
  }

  /**
   * Handle mission victory - collect all surviving turrets
   */
  public collectSurvivingTurrets(turrets: TurretInstance[]): number {
    return this.addTurrets(turrets);
  }

  /**
   * Get inventory summary for UI display
   */
  public getInventorySummary(): { type: string; count: number; maxLevel: number }[] {
    const inventory = this.getInventory();
    const summary: { [key: string]: { count: number; maxLevel: number } } = {};

    for (const turret of inventory.turrets) {
      if (!summary[turret.type]) {
        summary[turret.type] = { count: 0, maxLevel: 0 };
      }
      summary[turret.type].count++;
      summary[turret.type].maxLevel = Math.max(summary[turret.type].maxLevel, turret.level);
    }

    return Object.entries(summary).map(([type, data]) => ({
      type,
      count: data.count,
      maxLevel: data.maxLevel
    }));
  }
}
