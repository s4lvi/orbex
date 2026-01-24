import { TurretType, TrapType, DamageType, MaterialType } from '../utils/Constants';
import {
  MaterialDefinition,
  MaterialsConfig,
  ResearchNode,
  ResearchConfig,
  TurretConfig,
  TurretsConfig,
  TrapConfig,
  TrapsConfig,
  UpgradeConfig,
  UpgradesConfig
} from '../types/GameData';

// Import JSON data
import materialsData from '../data/json/materials.json';
import researchData from '../data/json/research.json';
import turretsData from '../data/json/turrets.json';
import trapsData from '../data/json/traps.json';
import upgradesData from '../data/json/upgrades.json';

/**
 * DataLoader singleton - loads and caches all JSON configuration data
 * Provides type-safe access to game configuration
 */
class DataLoaderClass {
  private static instance: DataLoaderClass;
  private loaded: boolean = false;

  // Cached data
  private materialsConfig: MaterialsConfig;
  private researchConfig: ResearchConfig;
  private turretsConfig: TurretsConfig;
  private trapsConfig: TrapsConfig;
  private upgradesConfig: UpgradesConfig;

  private constructor() {
    // Private constructor for singleton
    this.materialsConfig = materialsData as MaterialsConfig;
    this.researchConfig = researchData as ResearchConfig;
    this.turretsConfig = turretsData as TurretsConfig;
    this.trapsConfig = trapsData as TrapsConfig;
    this.upgradesConfig = upgradesData as unknown as UpgradesConfig;
  }

  public static getInstance(): DataLoaderClass {
    if (!DataLoaderClass.instance) {
      DataLoaderClass.instance = new DataLoaderClass();
    }
    return DataLoaderClass.instance;
  }

  /**
   * Initialize the data loader (call on boot)
   */
  public async init(): Promise<void> {
    if (this.loaded) return;

    // Data is already loaded via imports, but this method exists
    // for future API-based loading
    this.loaded = true;
    console.log('[DataLoader] Configuration loaded');
  }

  // ============== Materials ==============

  public getMaterial(id: MaterialType): MaterialDefinition | undefined {
    return this.materialsConfig.materials[id];
  }

  public getAllMaterials(): MaterialDefinition[] {
    return Object.values(this.materialsConfig.materials);
  }

  public getMaterialColor(id: MaterialType | string): string {
    const material = this.materialsConfig.materials[id];
    return material?.color || '#888888';
  }

  // ============== Research ==============

  public getResearchNode(id: string): ResearchNode | undefined {
    return this.researchConfig.nodes.find(n => n.id === id);
  }

  public getAllResearchNodes(): ResearchNode[] {
    return this.researchConfig.nodes;
  }

  public getResearchNodesByCategory(category: 'turrets' | 'traps' | 'upgrades'): ResearchNode[] {
    return this.researchConfig.nodes.filter(n => n.category === category);
  }

  public getResearchNodesByTier(tier: number): ResearchNode[] {
    return this.researchConfig.nodes.filter(n => n.tier === tier);
  }

  // ============== Turrets ==============

  public getTurret(id: string): TurretConfig | undefined {
    return this.turretsConfig.turrets[id];
  }

  public getTurretByType(type: TurretType): TurretConfig | undefined {
    const key = type.toUpperCase();
    return this.turretsConfig.turrets[key];
  }

  public getAllTurrets(): TurretConfig[] {
    return Object.values(this.turretsConfig.turrets);
  }

  public getStartingTurrets(): TurretConfig[] {
    return this.getAllTurrets().filter(t => t.availableAtStart);
  }

  public getTurretDamageType(id: string): DamageType {
    const turret = this.getTurret(id);
    return (turret?.damageType as DamageType) || DamageType.KINETIC;
  }

  // ============== Traps ==============

  public getTrap(id: string): TrapConfig | undefined {
    return this.trapsConfig.traps[id];
  }

  public getTrapByType(type: TrapType): TrapConfig | undefined {
    const key = type.toUpperCase();
    return this.trapsConfig.traps[key];
  }

  public getAllTraps(): TrapConfig[] {
    return Object.values(this.trapsConfig.traps);
  }

  public getStartingTraps(): TrapConfig[] {
    return this.getAllTraps().filter(t => t.availableAtStart);
  }

  // ============== Upgrades ==============

  public getGlobalUpgrade(id: string): UpgradeConfig | undefined {
    return this.upgradesConfig.globalUpgrades.find(u => u.id === id);
  }

  public getAllGlobalUpgrades(): UpgradeConfig[] {
    return this.upgradesConfig.globalUpgrades;
  }

  public getTurretUpgrades(turretType: string): UpgradeConfig[] {
    return this.upgradesConfig.turretUpgrades[turretType] || [];
  }

  public getUpgradeById(id: string): UpgradeConfig | undefined {
    // Check global upgrades
    const globalUpgrade = this.upgradesConfig.globalUpgrades.find(u => u.id === id);
    if (globalUpgrade) return globalUpgrade;

    // Check turret-specific upgrades
    for (const turretUpgrades of Object.values(this.upgradesConfig.turretUpgrades)) {
      const found = turretUpgrades.find(u => u.id === id);
      if (found) return found;
    }

    return undefined;
  }

  public getUpgradesForTurret(turretType: string, level: number): UpgradeConfig[] {
    const specific = (this.upgradesConfig.turretUpgrades[turretType] || [])
      .filter(u => u.requiredLevel <= level);
    const global = this.upgradesConfig.globalUpgrades.filter(u => u.requiredLevel <= level);
    return [...specific, ...global];
  }

  // ============== Helper Methods ==============

  /**
   * Get the research node that unlocks a specific turret
   */
  public getResearchForTurret(turretId: string): ResearchNode | undefined {
    return this.researchConfig.nodes.find(n =>
      n.unlocks.turrets?.includes(turretId)
    );
  }

  /**
   * Get the research node that unlocks a specific trap
   */
  public getResearchForTrap(trapId: string): ResearchNode | undefined {
    return this.researchConfig.nodes.find(n =>
      n.unlocks.traps?.includes(trapId)
    );
  }

  /**
   * Get the research node that unlocks a specific upgrade
   */
  public getResearchForUpgrade(upgradeId: string): ResearchNode | undefined {
    return this.researchConfig.nodes.find(n =>
      n.unlocks.upgrades?.includes(upgradeId)
    );
  }

  /**
   * Calculate total cost from a cost object
   */
  public getTotalCost(cost: { [key: string]: number }): number {
    return Object.values(cost).reduce((sum, val) => sum + val, 0);
  }

  /**
   * Format cost for display
   */
  public formatCost(cost: { [key: string]: number }): string {
    return Object.entries(cost)
      .map(([material, amount]) => {
        const mat = this.getMaterial(material as MaterialType);
        return `${mat?.name || material}: ${amount}`;
      })
      .join(', ');
  }
}

// Export singleton instance
export const DataLoader = DataLoaderClass.getInstance();
