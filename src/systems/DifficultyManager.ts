import Phaser from 'phaser';
import { PlanetData } from '../data/planets';
import { LandingZone } from '../scenes/LandingZoneSelectScene';
import { REGISTRY_KEYS } from './GameState';

/**
 * Difficulty factors that determine enemy scaling
 */
export interface DifficultyFactors {
  planetMultiplier: number;     // From planet data (1.0+)
  zoneDifficulty: number;       // From landing zone (0.3-1.0)
  completedDrops: number;       // Player progression
  successRate: number;          // Adaptive (0-1)
  waveNumber: number;           // Current wave in mission
  enemyLevel: number;           // Enemy level based on planet
}

/**
 * Configuration applied to waves based on difficulty
 */
export interface WaveDifficultyConfig {
  healthMultiplier: number;
  armorMultiplier: number;
  speedMultiplier: number;
  countMultiplier: number;
  eliteChance: number;          // 0-0.20 (0-20%)
  energyMultiplier: number;
}

/**
 * Elite enemy modifiers
 */
export const ELITE_MODIFIERS = {
  healthMultiplier: 1.5,        // 50% more health
  armorMultiplier: 1.5,         // 50% more armor
  energyMultiplier: 2.0,        // 2x energy reward
  scale: 1.2,                   // 20% larger visually
  tint: 0xff8800                // Orange tint
} as const;

/**
 * Performance history for adaptive difficulty
 */
interface PerformanceHistory {
  recentResults: boolean[];     // Last N mission results (true = victory)
  totalVictories: number;
  totalDefeats: number;
}

const PERFORMANCE_KEY = 'performanceHistory';
const MAX_HISTORY = 10;

/**
 * DifficultyManager - Manages multi-factor difficulty calculation
 *
 * Features:
 * - Planet-based difficulty scaling
 * - Zone difficulty (landing zone selection)
 * - Player progression scaling
 * - Adaptive difficulty based on success rate
 * - Elite enemy spawning
 */
export class DifficultyManager {
  private registry: Phaser.Data.DataManager;

  private planet: PlanetData;
  private zone: LandingZone;
  private completedDrops: number;
  private performanceHistory: PerformanceHistory;

  constructor(scene: Phaser.Scene, planet: PlanetData, zone: LandingZone) {
    this.registry = scene.registry;
    this.planet = planet;
    this.zone = zone;

    // Get completed drops
    this.completedDrops = this.registry.get(REGISTRY_KEYS.COMPLETED_DROPS) || 0;

    // Load performance history
    this.performanceHistory = this.loadPerformanceHistory();
  }

  private loadPerformanceHistory(): PerformanceHistory {
    const stored = this.registry.get(PERFORMANCE_KEY);
    if (stored && typeof stored === 'object') {
      return stored as PerformanceHistory;
    }
    return {
      recentResults: [],
      totalVictories: 0,
      totalDefeats: 0
    };
  }

  private savePerformanceHistory(): void {
    this.registry.set(PERFORMANCE_KEY, this.performanceHistory);
  }

  /**
   * Record mission result for adaptive difficulty
   */
  public recordMissionResult(victory: boolean): void {
    this.performanceHistory.recentResults.push(victory);

    // Keep only the last N results
    if (this.performanceHistory.recentResults.length > MAX_HISTORY) {
      this.performanceHistory.recentResults.shift();
    }

    if (victory) {
      this.performanceHistory.totalVictories++;
    } else {
      this.performanceHistory.totalDefeats++;
    }

    this.savePerformanceHistory();
  }

  /**
   * Get player's recent success rate (0-1)
   */
  public getSuccessRate(): number {
    const results = this.performanceHistory.recentResults;
    if (results.length === 0) return 0.5; // Default to 50% for new players

    const victories = results.filter(r => r).length;
    return victories / results.length;
  }

  /**
   * Get all difficulty factors
   */
  public getDifficultyFactors(waveNumber: number): DifficultyFactors {
    return {
      planetMultiplier: this.planet.difficultyMultiplier,
      zoneDifficulty: this.zone.difficulty,
      completedDrops: this.completedDrops,
      successRate: this.getSuccessRate(),
      waveNumber,
      enemyLevel: this.getEnemyLevel(waveNumber)
    };
  }

  /**
   * Get enemy level based on planet and wave
   */
  private getEnemyLevel(waveNumber: number): number {
    const levelRange = this.planet.enemyLevelRange;
    const waveProgress = waveNumber / (this.planet.waves || 10);

    // Interpolate between min and max level based on wave progress
    return Math.floor(
      levelRange.min + (levelRange.max - levelRange.min) * waveProgress
    );
  }

  /**
   * Calculate wave difficulty configuration
   */
  public getWaveDifficultyConfig(waveNumber: number): WaveDifficultyConfig {
    const factors = this.getDifficultyFactors(waveNumber);

    // Base multipliers from planet and zone
    const baseMultiplier = factors.planetMultiplier * factors.zoneDifficulty;

    // Progression scaling (slight increase per completed drop)
    const progressionScale = 1 + (factors.completedDrops * 0.02);

    // Adaptive scaling (reduce difficulty if struggling, increase if doing well)
    // Range: 0.85 (struggling) to 1.15 (dominating)
    const adaptiveScale = 0.85 + (factors.successRate * 0.3);

    // Wave scaling within mission
    const waveScale = 1 + (waveNumber - 1) * 0.1;

    // Level-based scaling
    const levelScale = 1 + (factors.enemyLevel - 1) * 0.15;

    // Combined multiplier
    const combined = baseMultiplier * progressionScale * adaptiveScale * waveScale * levelScale;

    // Calculate elite chance (increases with difficulty and wave)
    // Base 5%, up to 20% on harder content
    const baseEliteChance = 0.05;
    const eliteChance = Math.min(0.2, baseEliteChance + (baseMultiplier - 1) * 0.1 + (waveNumber - 1) * 0.01);

    return {
      healthMultiplier: combined,
      armorMultiplier: 1 + (combined - 1) * 0.5, // Armor scales slower
      speedMultiplier: 1 + (combined - 1) * 0.2, // Speed scales much slower
      countMultiplier: 1 + (combined - 1) * 0.3, // Enemy count scales slower
      eliteChance: Math.max(0, eliteChance),
      energyMultiplier: 1 + (waveNumber - 1) * 0.05 // Rewards scale with waves
    };
  }

  /**
   * Determine if an enemy should be elite
   */
  public shouldSpawnElite(config: WaveDifficultyConfig): boolean {
    return Math.random() < config.eliteChance;
  }

  /**
   * Get scaled stats for an enemy
   */
  public getScaledEnemyStats(
    baseHealth: number,
    baseArmor: number,
    baseSpeed: number,
    baseEnergy: number,
    config: WaveDifficultyConfig,
    isElite: boolean
  ): { health: number; armor: number; speed: number; energy: number } {
    let health = baseHealth * config.healthMultiplier;
    let armor = baseArmor * config.armorMultiplier;
    let speed = baseSpeed * config.speedMultiplier;
    let energy = baseEnergy * config.energyMultiplier;

    // Apply elite modifiers
    if (isElite) {
      health *= ELITE_MODIFIERS.healthMultiplier;
      armor *= ELITE_MODIFIERS.armorMultiplier;
      energy *= ELITE_MODIFIERS.energyMultiplier;
    }

    return {
      health: Math.floor(health),
      armor: Math.floor(armor),
      speed: Math.floor(speed),
      energy: Math.floor(energy)
    };
  }

  /**
   * Get scaled enemy count for a wave
   */
  public getScaledEnemyCount(baseCount: number, config: WaveDifficultyConfig): number {
    return Math.floor(baseCount * config.countMultiplier);
  }

  /**
   * Get current difficulty level description
   */
  public getDifficultyDescription(): string {
    const factors = this.getDifficultyFactors(1);
    const combined = factors.planetMultiplier * factors.zoneDifficulty;

    if (combined < 0.7) return 'Easy';
    if (combined < 1.0) return 'Normal';
    if (combined < 1.3) return 'Hard';
    if (combined < 1.6) return 'Very Hard';
    return 'Extreme';
  }
}
