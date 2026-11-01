import Phaser from 'phaser';
import { MaterialType, STARTING_BASIC_RESOURCES } from '../utils/Constants';

// Materials interface using MaterialType enum
export interface Materials {
  [MaterialType.CARBOX]: number;
  [MaterialType.HYDRON]: number;
  [MaterialType.TITAGEN]: number;
  [MaterialType.OXYON]: number;
  [MaterialType.PLUTONIA]: number;
  [MaterialType.XITANIUM]: number;
  [MaterialType.NANON]: number;
}

// Complete resource state (Energy + Materials)
export interface ResourceState {
  energy: number;
  materials: Materials;
}

// Legacy Resources interface for backward compatibility during transition
export interface Resources {
  energy: number;
  carbox: number;
  hydron: number;
  titagen: number;
  oxyon: number;
  plutonia: number;
  xitanium: number;
  nanon: number;
}

export class ResourceManager {
  private scene: Phaser.Scene;
  private dropResources: ResourceState;
  private sessionResources: ResourceState;
  private unlockedPlanets: Set<string>;
  /** While true, materials are read from and spent out of the drop ledger only. */
  private dropMode: boolean = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Get session resources from registry - make a COPY so we don't modify the registry directly
    const registryResources = scene.registry.get('sessionResources');
    this.sessionResources = this.isNewResourceFormat(registryResources)
      ? this.copyResourceState(registryResources)
      : this.getDefaultResources();

    // Initialize drop resources (earned during this extraction)
    this.dropResources = this.getEmptyResources();

    // Get unlocked planets from registry (first planet always unlocked)
    this.unlockedPlanets = new Set(scene.registry.get('unlockedPlanets') || ['kepler']);
  }

  private isNewResourceFormat(resources: unknown): resources is ResourceState {
    if (!resources || typeof resources !== 'object') return false;
    const r = resources as Record<string, unknown>;
    return 'energy' in r && 'materials' in r && typeof r.materials === 'object';
  }

  private copyResourceState(state: ResourceState): ResourceState {
    return {
      energy: state.energy,
      materials: { ...state.materials }
    };
  }

  private getDefaultResources(): ResourceState {
    return {
      energy: 0,
      materials: {
        [MaterialType.CARBOX]: STARTING_BASIC_RESOURCES,
        [MaterialType.HYDRON]: STARTING_BASIC_RESOURCES,
        [MaterialType.TITAGEN]: 0,
        [MaterialType.OXYON]: 0,
        [MaterialType.PLUTONIA]: 0,
        [MaterialType.XITANIUM]: 0,
        [MaterialType.NANON]: 0
      }
    };
  }

  private getEmptyResources(): ResourceState {
    return {
      energy: 0,
      materials: {
        [MaterialType.CARBOX]: 0,
        [MaterialType.HYDRON]: 0,
        [MaterialType.TITAGEN]: 0,
        [MaterialType.OXYON]: 0,
        [MaterialType.PLUTONIA]: 0,
        [MaterialType.XITANIUM]: 0,
        [MaterialType.NANON]: 0
      }
    };
  }

  // ============== Energy Methods ==============

  public getEnergy(): number {
    return this.sessionResources.energy + this.dropResources.energy;
  }

  public getSessionEnergy(): number {
    return this.sessionResources.energy;
  }

  public getDropEnergy(): number {
    return this.dropResources.energy;
  }

  public addEnergy(amount: number): void {
    this.dropResources.energy += amount;
    this.emitChange();
  }

  public spendEnergy(amount: number): boolean {
    if (this.getEnergy() < amount) return false;

    let remaining = amount;

    // Spend from drop first
    if (this.dropResources.energy >= remaining) {
      this.dropResources.energy -= remaining;
    } else {
      remaining -= this.dropResources.energy;
      this.dropResources.energy = 0;
      this.sessionResources.energy -= remaining;
    }

    this.emitChange();
    return true;
  }

  /** Credit energy straight to the persistent stockpile (bypasses the drop ledger). */
  public addSessionEnergy(amount: number): void {
    this.sessionResources.energy += amount;
    this.emitChange();
  }

  public canAffordEnergy(amount: number): boolean {
    return this.getEnergy() >= amount;
  }

  // Alias for canAffordEnergy
  public hasEnergy(amount: number): boolean {
    return this.canAffordEnergy(amount);
  }

  // ============== Material Methods ==============

  public getMaterial(type: MaterialType): number {
    if (this.dropMode) return this.dropResources.materials[type] || 0;
    return (this.sessionResources.materials[type] || 0) +
           (this.dropResources.materials[type] || 0);
  }

  public isDropMode(): boolean {
    return this.dropMode;
  }

  /**
   * Start a drop: move up to `cargo[type]` of each material from the stockpile
   * into the drop ledger and switch to drop mode, where only the drop ledger
   * can be spent. Returns what was actually loaded.
   */
  public beginDrop(
    cargo: { [key in MaterialType]?: number },
    freeAllowance: { [key in MaterialType]?: number } = {}
  ): { [key in MaterialType]?: number } {
    const loaded: { [key in MaterialType]?: number } = {};
    for (const type of Object.values(MaterialType)) {
      const cap = cargo[type] || 0;
      const free = Math.min(cap, freeAllowance[type] || 0);
      const fromStock = Math.min(cap - free, this.sessionResources.materials[type] || 0);
      const amount = free + fromStock;
      if (amount <= 0) continue;
      this.sessionResources.materials[type] -= fromStock;
      this.dropResources.materials[type] += amount;
      loaded[type] = amount;
    }
    this.dropMode = true;
    this.emitChange();
    return loaded;
  }

  /** What beginDrop would load right now, without changing anything. */
  public previewCargo(
    cargo: { [key in MaterialType]?: number },
    freeAllowance: { [key in MaterialType]?: number } = {}
  ): { [key in MaterialType]?: number } {
    const preview: { [key in MaterialType]?: number } = {};
    for (const type of Object.values(MaterialType)) {
      const cap = cargo[type] || 0;
      const free = Math.min(cap, freeAllowance[type] || 0);
      const amount = free + Math.min(cap - free, this.sessionResources.materials[type] || 0);
      if (amount > 0) preview[type] = amount;
    }
    return preview;
  }

  /**
   * Defeat: recover a fraction of the unspent drop materials into the
   * stockpile, discard the rest, and persist. Energy is handled by the caller.
   * Returns what was salvaged.
   */
  public salvageDrop(fraction: number): { [key in MaterialType]?: number } {
    const salvaged: { [key in MaterialType]?: number } = {};
    for (const type of Object.values(MaterialType)) {
      const amount = Math.floor((this.dropResources.materials[type] || 0) * fraction);
      this.dropResources.materials[type] = 0;
      if (amount > 0) {
        this.sessionResources.materials[type] += amount;
        salvaged[type] = amount;
      }
    }
    this.scene.registry.set('sessionResources', this.copyResourceState(this.sessionResources));
    return salvaged;
  }

  public getSessionMaterial(type: MaterialType): number {
    return this.sessionResources.materials[type] || 0;
  }

  public getDropMaterial(type: MaterialType): number {
    return this.dropResources.materials[type] || 0;
  }

  public addMaterial(type: MaterialType, amount: number): void {
    this.dropResources.materials[type] += amount;
    this.emitChange();
  }

  public getAllMaterials(): Materials {
    const result: Materials = {
      [MaterialType.CARBOX]: 0,
      [MaterialType.HYDRON]: 0,
      [MaterialType.TITAGEN]: 0,
      [MaterialType.OXYON]: 0,
      [MaterialType.PLUTONIA]: 0,
      [MaterialType.XITANIUM]: 0,
      [MaterialType.NANON]: 0
    };

    for (const type of Object.values(MaterialType)) {
      result[type] = this.getMaterial(type);
    }

    return result;
  }

  // ============== Generic Resource Access ==============

  public getResource(type: string): number {
    if (type === 'energy') {
      return this.getEnergy();
    }
    return this.getMaterial(type as MaterialType);
  }

  public getSessionResource(type: string): number {
    if (type === 'energy') {
      return this.getSessionEnergy();
    }
    return this.getSessionMaterial(type as MaterialType);
  }

  public getDropResource(type: string): number {
    if (type === 'energy') {
      return this.getDropEnergy();
    }
    return this.getDropMaterial(type as MaterialType);
  }

  public getFullResourceState(): ResourceState {
    return {
      energy: this.getEnergy(),
      materials: this.getAllMaterials()
    };
  }

  public getDropResources(): ResourceState {
    return this.copyResourceState(this.dropResources);
  }

  public getSessionResources(): ResourceState {
    return this.copyResourceState(this.sessionResources);
  }

  // Legacy method for backward compatibility
  public getAllResources(): Resources {
    return {
      energy: this.getEnergy(),
      carbox: this.getMaterial(MaterialType.CARBOX),
      hydron: this.getMaterial(MaterialType.HYDRON),
      titagen: this.getMaterial(MaterialType.TITAGEN),
      oxyon: this.getMaterial(MaterialType.OXYON),
      plutonia: this.getMaterial(MaterialType.PLUTONIA),
      xitanium: this.getMaterial(MaterialType.XITANIUM),
      nanon: this.getMaterial(MaterialType.NANON)
    };
  }

  // ============== Add/Spend Resources ==============

  public add(resources: { [key: string]: number }): void {
    Object.entries(resources).forEach(([key, value]) => {
      if (key === 'energy') {
        this.dropResources.energy += value;
      } else if (Object.values(MaterialType).includes(key as MaterialType)) {
        this.dropResources.materials[key as MaterialType] += value;
      }
    });

    this.emitChange();
  }

  public spend(costs: { [key: string]: number }): boolean {
    if (!this.canAfford(costs)) {
      return false;
    }

    // Spend from drop resources first, then session resources
    Object.entries(costs).forEach(([key, cost]) => {
      let remaining = cost;

      if (key === 'energy') {
        // Spend energy
        if (this.dropResources.energy >= remaining) {
          this.dropResources.energy -= remaining;
        } else {
          remaining -= this.dropResources.energy;
          this.dropResources.energy = 0;
          this.sessionResources.energy -= remaining;
        }
      } else if (Object.values(MaterialType).includes(key as MaterialType)) {
        // Spend material
        const matType = key as MaterialType;
        if (this.dropResources.materials[matType] >= remaining) {
          this.dropResources.materials[matType] -= remaining;
        } else {
          remaining -= this.dropResources.materials[matType];
          this.dropResources.materials[matType] = 0;
          this.sessionResources.materials[matType] -= remaining;
        }
      }
    });

    this.emitChange();
    return true;
  }

  /**
   * Return a fraction of a cost map to the drop ledger (used when selling).
   * Returns the amounts actually refunded.
   */
  public refund(costs: { [key: string]: number }, fraction: number): { [key: string]: number } {
    const refunded: { [key: string]: number } = {};
    Object.entries(costs).forEach(([key, value]) => {
      const amount = Math.floor(value * fraction);
      if (amount > 0) refunded[key] = amount;
    });
    this.add(refunded);
    return refunded;
  }

  public canAfford(costs: { [key: string]: number }): boolean {
    for (const [key, cost] of Object.entries(costs)) {
      const available = this.getResource(key);
      if (available < cost) {
        return false;
      }
    }
    return true;
  }

  public getMissingResources(costs: { [key: string]: number }): { [key: string]: number } {
    const missing: { [key: string]: number } = {};

    for (const [key, cost] of Object.entries(costs)) {
      const available = this.getResource(key);
      if (available < cost) {
        missing[key] = cost - available;
      }
    }

    return missing;
  }

  private emitChange(): void {
    this.scene.events.emit('resourcesChanged', this.getAllResources());
  }

  public formatCost(costs: { [key: string]: number }): string {
    return Object.entries(costs)
      .map(([key, value]) => `${value} ${this.getResourceName(key)}`)
      .join(', ');
  }

  private getResourceName(key: string): string {
    const names: { [key: string]: string } = {
      energy: 'Energy',
      [MaterialType.CARBOX]: 'Carbox',
      [MaterialType.HYDRON]: 'Hydron',
      [MaterialType.TITAGEN]: 'Titagen',
      [MaterialType.OXYON]: 'Oxyon',
      [MaterialType.PLUTONIA]: 'Plutonia',
      [MaterialType.XITANIUM]: 'Xitanium',
      [MaterialType.NANON]: 'Nanon'
    };
    return names[key] || key;
  }

  // ============== Planet Unlock Methods ==============

  public isPlanetUnlocked(planetId: string): boolean {
    return this.unlockedPlanets.has(planetId);
  }

  public unlockPlanet(planetId: string, cost: { [key: string]: number }): boolean {
    if (this.unlockedPlanets.has(planetId)) {
      return false; // Already unlocked
    }

    if (!this.canAfford(cost)) {
      return false;
    }

    // Spend resources from session only (ship upgrades are permanent)
    Object.entries(cost).forEach(([key, value]) => {
      if (key === 'energy') {
        this.sessionResources.energy -= value;
      } else {
        this.sessionResources.materials[key as MaterialType] -= value;
      }
    });

    this.unlockedPlanets.add(planetId);
    this.scene.registry.set('unlockedPlanets', Array.from(this.unlockedPlanets));
    this.scene.registry.set('sessionResources', this.copyResourceState(this.sessionResources));

    this.emitChange();
    return true;
  }

  public getUnlockedPlanets(): string[] {
    return Array.from(this.unlockedPlanets);
  }

  /**
   * Persist the session stockpile to the registry without touching the drop
   * ledger. Used on defeat: whatever was spent from the stockpile stays spent,
   * and everything earned during the drop is forfeited.
   */
  public saveSessionToRegistry(): void {
    this.scene.registry.set('sessionResources', this.copyResourceState(this.sessionResources));
  }

  /**
   * Merge drop resources into session resources (call on victory) and persist.
   * Clears the drop ledger so a second call cannot double-credit.
   */
  public mergeDropToSession(): void {
    this.sessionResources.energy += this.dropResources.energy;
    for (const type of Object.values(MaterialType)) {
      this.sessionResources.materials[type] += this.dropResources.materials[type];
    }
    this.dropResources = this.getEmptyResources();
    this.scene.registry.set('sessionResources', this.copyResourceState(this.sessionResources));
  }
}
