import Phaser from 'phaser';
import { STARTING_BASIC_RESOURCES } from '../utils/Constants';

export interface Resources {
  minerals: number;
  energy: number;
  alloys: number;
  plasma: number;
  crystals: number;
  darkMatter: number;
  antimatter: number;
  quantumFlux: number;
}

export class ResourceManager {
  private scene: Phaser.Scene;
  private dropResources: Resources;
  private sessionResources: Resources;
  private unlockedPlanets: Set<string>;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Get session resources from registry - make a COPY so we don't modify the registry directly
    // This is important because on victory, spent resources should be "kept" (not permanently deducted)
    const registryResources = scene.registry.get('sessionResources');
    this.sessionResources = registryResources
      ? { ...registryResources }
      : this.getDefaultResources();

    // Initialize drop resources (earned during this extraction)
    this.dropResources = {
      minerals: 0,
      energy: 0,
      alloys: 0,
      plasma: 0,
      crystals: 0,
      darkMatter: 0,
      antimatter: 0,
      quantumFlux: 0
    };

    // Get unlocked planets from registry (first planet always unlocked)
    this.unlockedPlanets = new Set(scene.registry.get('unlockedPlanets') || ['kepler']);
  }

  private getDefaultResources(): Resources {
    return {
      minerals: STARTING_BASIC_RESOURCES,
      energy: STARTING_BASIC_RESOURCES,
      alloys: 50,
      plasma: 0,
      crystals: 0,
      darkMatter: 0,
      antimatter: 0,
      quantumFlux: 0
    };
  }

  public getResource(type: string): number {
    const key = type as keyof Resources;
    return (this.sessionResources[key] || 0) + (this.dropResources[key] || 0);
  }

  public getSessionResource(type: string): number {
    return this.sessionResources[type as keyof Resources] || 0;
  }

  public getDropResource(type: string): number {
    return this.dropResources[type as keyof Resources] || 0;
  }

  public getAllResources(): Resources {
    return {
      minerals: this.sessionResources.minerals + this.dropResources.minerals,
      energy: this.sessionResources.energy + this.dropResources.energy,
      alloys: this.sessionResources.alloys + this.dropResources.alloys,
      plasma: this.sessionResources.plasma + this.dropResources.plasma,
      crystals: this.sessionResources.crystals + this.dropResources.crystals,
      darkMatter: this.sessionResources.darkMatter + this.dropResources.darkMatter,
      antimatter: this.sessionResources.antimatter + this.dropResources.antimatter,
      quantumFlux: this.sessionResources.quantumFlux + this.dropResources.quantumFlux
    };
  }

  public getDropResources(): Resources {
    return { ...this.dropResources };
  }

  public getSessionResources(): Resources {
    return { ...this.sessionResources };
  }

  public add(resources: { [key: string]: number }): void {
    Object.entries(resources).forEach(([key, value]) => {
      if (key in this.dropResources) {
        this.dropResources[key as keyof Resources] += value;
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
      const resourceKey = key as keyof Resources;
      let remaining = cost;

      // First try to spend from drop resources
      if (this.dropResources[resourceKey] >= remaining) {
        this.dropResources[resourceKey] -= remaining;
        remaining = 0;
      } else {
        remaining -= this.dropResources[resourceKey];
        this.dropResources[resourceKey] = 0;
      }

      // Then spend from session resources
      if (remaining > 0) {
        this.sessionResources[resourceKey] -= remaining;
      }
    });

    this.emitChange();
    return true;
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
      minerals: 'Minerals',
      energy: 'Energy',
      alloys: 'Alloys',
      plasma: 'Plasma',
      crystals: 'Crystals',
      darkMatter: 'Dark Matter',
      antimatter: 'Antimatter',
      quantumFlux: 'Quantum Flux'
    };
    return names[key] || key;
  }

  // Ship upgrade / planet unlock methods
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
      const resourceKey = key as keyof Resources;
      this.sessionResources[resourceKey] -= value;
    });

    this.unlockedPlanets.add(planetId);
    this.scene.registry.set('unlockedPlanets', Array.from(this.unlockedPlanets));
    this.scene.registry.set('sessionResources', this.sessionResources);

    this.emitChange();
    return true;
  }

  public getUnlockedPlanets(): string[] {
    return Array.from(this.unlockedPlanets);
  }

  /**
   * Save the current session resources to the registry.
   * Call this on defeat to persist the spent resources (which are lost on defeat).
   * On victory, don't call this - spent resources are "kept" by not updating the registry.
   */
  public saveSessionToRegistry(): void {
    this.scene.registry.set('sessionResources', { ...this.sessionResources });
  }
}
