/**
 * GameState - Type-safe wrapper around Phaser's registry for cross-scene state
 *
 * Based on Phaser best practices:
 * - Use registry for global state accessible across all scenes
 * - Event-driven updates via registry.events for reactive patterns
 * - Careful object reference handling (registry stores references, not copies)
 *
 * @see https://docs.phaser.io/phaser/concepts/data-manager
 */

import { Resources } from './ResourceManager';
import { PlayerStats } from '../scenes/HangarScene';
import { PlanetData } from '../data/planets';
import { LandingZone } from '../scenes/LandingZoneSelectScene';

// Game result passed between GameScene and ResultsScene
export interface GameResult {
  victory: boolean;
  resources: { [key: string]: number };
  wavesCompleted: number;
  baseHealth: number;
  enemiesKilled: number;
  turretsBuilt: number;
}

// Registry keys - centralized to prevent typos
export const REGISTRY_KEYS = {
  SESSION_RESOURCES: 'sessionResources',
  PLAYER_STATS: 'playerStats',
  COMPLETED_DROPS: 'completedDrops',
  SELECTED_PLANET: 'selectedPlanet',
  SELECTED_ZONE: 'selectedZone',
  ZONE_WAVE_COUNT: 'zoneWaveCount',
  GAME_RESULT: 'gameResult',
  UNLOCKED_PLANETS: 'unlockedPlanets',
} as const;

/**
 * Type-safe access to game state stored in Phaser registry
 */
export class GameState {
  private registry: Phaser.Data.DataManager;

  constructor(scene: Phaser.Scene) {
    this.registry = scene.registry;
  }

  // Session Resources
  getSessionResources(): Resources {
    return this.registry.get(REGISTRY_KEYS.SESSION_RESOURCES) || this.getDefaultResources();
  }

  setSessionResources(resources: Resources): void {
    // Create a copy to ensure event emission on changes
    this.registry.set(REGISTRY_KEYS.SESSION_RESOURCES, { ...resources });
  }

  // Player Stats
  getPlayerStats(): PlayerStats {
    return this.registry.get(REGISTRY_KEYS.PLAYER_STATS) || this.getDefaultStats();
  }

  setPlayerStats(stats: PlayerStats): void {
    this.registry.set(REGISTRY_KEYS.PLAYER_STATS, { ...stats });
  }

  // Completed Drops
  getCompletedDrops(): number {
    return this.registry.get(REGISTRY_KEYS.COMPLETED_DROPS) || 0;
  }

  incrementCompletedDrops(): void {
    this.registry.set(REGISTRY_KEYS.COMPLETED_DROPS, this.getCompletedDrops() + 1);
  }

  // Selected Planet
  getSelectedPlanet(): PlanetData | null {
    return this.registry.get(REGISTRY_KEYS.SELECTED_PLANET) || null;
  }

  setSelectedPlanet(planet: PlanetData): void {
    this.registry.set(REGISTRY_KEYS.SELECTED_PLANET, planet);
  }

  // Selected Zone
  getSelectedZone(): LandingZone | null {
    return this.registry.get(REGISTRY_KEYS.SELECTED_ZONE) || null;
  }

  setSelectedZone(zone: LandingZone): void {
    this.registry.set(REGISTRY_KEYS.SELECTED_ZONE, zone);
  }

  // Zone Wave Count
  getZoneWaveCount(): number {
    return this.registry.get(REGISTRY_KEYS.ZONE_WAVE_COUNT) || 10;
  }

  setZoneWaveCount(count: number): void {
    this.registry.set(REGISTRY_KEYS.ZONE_WAVE_COUNT, count);
  }

  // Game Result
  getGameResult(): GameResult | null {
    return this.registry.get(REGISTRY_KEYS.GAME_RESULT) || null;
  }

  setGameResult(result: GameResult): void {
    this.registry.set(REGISTRY_KEYS.GAME_RESULT, { ...result });
  }

  // Unlocked Planets
  getUnlockedPlanets(): string[] {
    return this.registry.get(REGISTRY_KEYS.UNLOCKED_PLANETS) || ['terra-nova'];
  }

  unlockPlanet(planetId: string): void {
    const unlocked = this.getUnlockedPlanets();
    if (!unlocked.includes(planetId)) {
      this.registry.set(REGISTRY_KEYS.UNLOCKED_PLANETS, [...unlocked, planetId]);
    }
  }

  isPlanetUnlocked(planetId: string): boolean {
    return this.getUnlockedPlanets().includes(planetId);
  }

  // Listen for state changes (event-driven pattern)
  onStateChange(key: string, callback: (value: unknown) => void): void {
    this.registry.events.on(`changedata-${key}`, (_parent: unknown, value: unknown) => {
      callback(value);
    });
  }

  // Default values
  private getDefaultResources(): Resources {
    return {
      minerals: 100,
      energy: 100,
      alloys: 0,
      plasma: 0,
      crystals: 0,
      darkMatter: 0,
      antimatter: 0,
      quantumFlux: 0,
    };
  }

  private getDefaultStats(): PlayerStats {
    return {
      totalDrops: 0,
      successfulDrops: 0,
      failedDrops: 0,
      enemiesKilled: 0,
      turretsBuilt: 0,
      wavesCompleted: 0,
    };
  }
}
