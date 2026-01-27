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

import { MaterialType, STARTING_BASIC_RESOURCES } from '../utils/Constants';
import { ResourceState, Materials } from './ResourceManager';
import { PlayerStats } from '../scenes/HangarScene';
import { PlanetData } from '../data/planets';
import { LandingZone } from '../scenes/LandingZoneSelectScene';
import { ResearchProgress } from '../types/GameData';

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
  // Research system
  RESEARCH_PROGRESS: 'researchProgress',
  // Turret persistence
  TURRET_INVENTORY: 'turretInventory',
  // Orbital weapons
  ORBITAL_WEAPONS_STATE: 'orbitalWeaponsState',
} as const;

/**
 * Type-safe access to game state stored in Phaser registry
 */
export class GameState {
  private registry: Phaser.Data.DataManager;

  constructor(scene: Phaser.Scene) {
    this.registry = scene.registry;
  }

  // ============== Session Resources ==============

  getSessionResources(): ResourceState {
    const stored = this.registry.get(REGISTRY_KEYS.SESSION_RESOURCES);
    if (stored && typeof stored === 'object' && 'materials' in stored) {
      return stored as ResourceState;
    }
    return this.getDefaultResources();
  }

  setSessionResources(resources: ResourceState): void {
    // Create a deep copy to ensure event emission on changes
    this.registry.set(REGISTRY_KEYS.SESSION_RESOURCES, {
      energy: resources.energy,
      materials: { ...resources.materials }
    });
  }

  // ============== Research Progress ==============

  getResearchProgress(): ResearchProgress {
    const stored = this.registry.get(REGISTRY_KEYS.RESEARCH_PROGRESS);
    if (stored && typeof stored === 'object') {
      return stored as ResearchProgress;
    }
    return this.getDefaultResearchProgress();
  }

  setResearchProgress(progress: ResearchProgress): void {
    this.registry.set(REGISTRY_KEYS.RESEARCH_PROGRESS, {
      completedNodes: [...progress.completedNodes],
      currentlyResearching: progress.currentlyResearching
    });
  }

  isResearchCompleted(nodeId: string): boolean {
    const progress = this.getResearchProgress();
    return progress.completedNodes.includes(nodeId);
  }

  completeResearch(nodeId: string): void {
    const progress = this.getResearchProgress();
    if (!progress.completedNodes.includes(nodeId)) {
      progress.completedNodes.push(nodeId);
      progress.currentlyResearching = null;
      this.setResearchProgress(progress);
    }
  }

  // ============== Player Stats ==============

  getPlayerStats(): PlayerStats {
    return this.registry.get(REGISTRY_KEYS.PLAYER_STATS) || this.getDefaultStats();
  }

  setPlayerStats(stats: PlayerStats): void {
    this.registry.set(REGISTRY_KEYS.PLAYER_STATS, { ...stats });
  }

  // ============== Completed Drops ==============

  getCompletedDrops(): number {
    return this.registry.get(REGISTRY_KEYS.COMPLETED_DROPS) || 0;
  }

  incrementCompletedDrops(): void {
    this.registry.set(REGISTRY_KEYS.COMPLETED_DROPS, this.getCompletedDrops() + 1);
  }

  // ============== Selected Planet ==============

  getSelectedPlanet(): PlanetData | null {
    return this.registry.get(REGISTRY_KEYS.SELECTED_PLANET) || null;
  }

  setSelectedPlanet(planet: PlanetData): void {
    this.registry.set(REGISTRY_KEYS.SELECTED_PLANET, planet);
  }

  // ============== Selected Zone ==============

  getSelectedZone(): LandingZone | null {
    return this.registry.get(REGISTRY_KEYS.SELECTED_ZONE) || null;
  }

  setSelectedZone(zone: LandingZone): void {
    this.registry.set(REGISTRY_KEYS.SELECTED_ZONE, zone);
  }

  // ============== Zone Wave Count ==============

  getZoneWaveCount(): number {
    return this.registry.get(REGISTRY_KEYS.ZONE_WAVE_COUNT) || 10;
  }

  setZoneWaveCount(count: number): void {
    this.registry.set(REGISTRY_KEYS.ZONE_WAVE_COUNT, count);
  }

  // ============== Game Result ==============

  getGameResult(): GameResult | null {
    return this.registry.get(REGISTRY_KEYS.GAME_RESULT) || null;
  }

  setGameResult(result: GameResult): void {
    this.registry.set(REGISTRY_KEYS.GAME_RESULT, { ...result });
  }

  // ============== Unlocked Planets ==============

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

  // ============== Event Listeners ==============

  onStateChange(key: string, callback: (value: unknown) => void): void {
    this.registry.events.on(`changedata-${key}`, (_parent: unknown, value: unknown) => {
      callback(value);
    });
  }

  // ============== Default Values ==============

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
      } as Materials
    };
  }

  private getDefaultResearchProgress(): ResearchProgress {
    return {
      completedNodes: [],
      currentlyResearching: null
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
