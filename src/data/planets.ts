import { PlanetDifficulty, EnemyType, WavePattern } from '../utils/Constants';

export interface WaveDefinition {
  enemies: { type: EnemyType; count: number }[];
  pattern: WavePattern;
  spawnDelay: number; // ms between spawns
  pathDistribution: 'single' | 'distributed' | 'random';
}

export interface PlanetData {
  id: string;
  name: string;
  description: string;
  difficulty: PlanetDifficulty;
  waves: number;
  minPaths: number;
  maxPaths: number;
  rewardMultiplier: number;
  difficultyMultiplier: number;
  availableEnemies: EnemyType[];
  wavePatterns: WaveDefinition[];
  exoticResourceChance: number;
  bossWaves: number[]; // which waves have bosses
}

export const PLANETS: PlanetData[] = [
  {
    id: 'kepler',
    name: 'Kepler-442b',
    description: 'A temperate world with moderate alien presence. Ideal for new extractors.',
    difficulty: PlanetDifficulty.EASY,
    waves: 10,
    minPaths: 1,
    maxPaths: 2,
    rewardMultiplier: 1.0,
    difficultyMultiplier: 1.0,
    availableEnemies: [
      EnemyType.DRONE,
      EnemyType.SOLDIER,
      EnemyType.SPEEDER
    ],
    wavePatterns: [
      { enemies: [{ type: EnemyType.DRONE, count: 5 }], pattern: WavePattern.STANDARD, spawnDelay: 1000, pathDistribution: 'single' },
      { enemies: [{ type: EnemyType.DRONE, count: 8 }], pattern: WavePattern.STANDARD, spawnDelay: 800, pathDistribution: 'distributed' },
      { enemies: [{ type: EnemyType.DRONE, count: 6 }, { type: EnemyType.SOLDIER, count: 2 }], pattern: WavePattern.STANDARD, spawnDelay: 900, pathDistribution: 'distributed' },
      { enemies: [{ type: EnemyType.SPEEDER, count: 5 }], pattern: WavePattern.SWARM, spawnDelay: 500, pathDistribution: 'random' },
      { enemies: [{ type: EnemyType.SOLDIER, count: 6 }, { type: EnemyType.DRONE, count: 4 }], pattern: WavePattern.STANDARD, spawnDelay: 800, pathDistribution: 'distributed' },
      { enemies: [{ type: EnemyType.DRONE, count: 15 }], pattern: WavePattern.SWARM, spawnDelay: 300, pathDistribution: 'single' },
      { enemies: [{ type: EnemyType.SOLDIER, count: 8 }], pattern: WavePattern.ELITE, spawnDelay: 1200, pathDistribution: 'distributed' },
      { enemies: [{ type: EnemyType.SPEEDER, count: 10 }, { type: EnemyType.DRONE, count: 5 }], pattern: WavePattern.SWARM, spawnDelay: 400, pathDistribution: 'random' },
      { enemies: [{ type: EnemyType.SOLDIER, count: 10 }, { type: EnemyType.SPEEDER, count: 5 }], pattern: WavePattern.STANDARD, spawnDelay: 700, pathDistribution: 'distributed' },
      { enemies: [{ type: EnemyType.SOLDIER, count: 12 }, { type: EnemyType.SPEEDER, count: 8 }], pattern: WavePattern.ELITE, spawnDelay: 600, pathDistribution: 'distributed' }
    ],
    exoticResourceChance: 0.1,
    bossWaves: []
  },
  {
    id: 'proxima',
    name: 'Proxima Centauri b',
    description: 'Hostile desert world with entrenched alien forces. Moderate challenge.',
    difficulty: PlanetDifficulty.MEDIUM,
    waves: 15,
    minPaths: 2,
    maxPaths: 3,
    rewardMultiplier: 1.5,
    difficultyMultiplier: 1.5,
    availableEnemies: [
      EnemyType.DRONE,
      EnemyType.SOLDIER,
      EnemyType.TANK,
      EnemyType.SPEEDER,
      EnemyType.FLYER,
      EnemyType.TELEPORTER
    ],
    wavePatterns: [
      { enemies: [{ type: EnemyType.DRONE, count: 8 }], pattern: WavePattern.STANDARD, spawnDelay: 800, pathDistribution: 'distributed' },
      { enemies: [{ type: EnemyType.SOLDIER, count: 5 }, { type: EnemyType.DRONE, count: 5 }], pattern: WavePattern.STANDARD, spawnDelay: 700, pathDistribution: 'distributed' },
      { enemies: [{ type: EnemyType.FLYER, count: 6 }], pattern: WavePattern.STANDARD, spawnDelay: 900, pathDistribution: 'single' },
      { enemies: [{ type: EnemyType.SPEEDER, count: 10 }], pattern: WavePattern.SWARM, spawnDelay: 400, pathDistribution: 'random' },
      { enemies: [{ type: EnemyType.TANK, count: 3 }], pattern: WavePattern.ELITE, spawnDelay: 2000, pathDistribution: 'distributed' },
      { enemies: [{ type: EnemyType.SOLDIER, count: 8 }, { type: EnemyType.FLYER, count: 4 }], pattern: WavePattern.STANDARD, spawnDelay: 600, pathDistribution: 'distributed' },
      { enemies: [{ type: EnemyType.TELEPORTER, count: 4 }], pattern: WavePattern.ELITE, spawnDelay: 1500, pathDistribution: 'random' },
      { enemies: [{ type: EnemyType.DRONE, count: 20 }], pattern: WavePattern.SWARM, spawnDelay: 200, pathDistribution: 'single' },
      { enemies: [{ type: EnemyType.TANK, count: 4 }, { type: EnemyType.SOLDIER, count: 6 }], pattern: WavePattern.STANDARD, spawnDelay: 800, pathDistribution: 'distributed' },
      { enemies: [{ type: EnemyType.FLYER, count: 8 }, { type: EnemyType.TELEPORTER, count: 3 }], pattern: WavePattern.STANDARD, spawnDelay: 700, pathDistribution: 'distributed' },
      { enemies: [{ type: EnemyType.SPEEDER, count: 15 }, { type: EnemyType.DRONE, count: 10 }], pattern: WavePattern.SWARM, spawnDelay: 300, pathDistribution: 'random' },
      { enemies: [{ type: EnemyType.TANK, count: 5 }, { type: EnemyType.TELEPORTER, count: 5 }], pattern: WavePattern.ELITE, spawnDelay: 1000, pathDistribution: 'distributed' },
      { enemies: [{ type: EnemyType.SOLDIER, count: 15 }, { type: EnemyType.FLYER, count: 8 }], pattern: WavePattern.STANDARD, spawnDelay: 500, pathDistribution: 'distributed' },
      { enemies: [{ type: EnemyType.TANK, count: 6 }, { type: EnemyType.SPEEDER, count: 10 }], pattern: WavePattern.ELITE, spawnDelay: 600, pathDistribution: 'distributed' },
      { enemies: [{ type: EnemyType.BOSS, count: 1 }, { type: EnemyType.SOLDIER, count: 10 }], pattern: WavePattern.ELITE, spawnDelay: 1000, pathDistribution: 'distributed' }
    ],
    exoticResourceChance: 0.2,
    bossWaves: [15]
  },
  {
    id: 'trappist',
    name: 'TRAPPIST-1e',
    description: 'Alien homeworld. Extreme danger, extreme rewards.',
    difficulty: PlanetDifficulty.HARD,
    waves: 20,
    minPaths: 3,
    maxPaths: 4,
    rewardMultiplier: 2.5,
    difficultyMultiplier: 2.0,
    availableEnemies: [
      EnemyType.DRONE,
      EnemyType.SOLDIER,
      EnemyType.TANK,
      EnemyType.SPEEDER,
      EnemyType.FLYER,
      EnemyType.TELEPORTER,
      EnemyType.SPAWNER,
      EnemyType.BOSS
    ],
    wavePatterns: [
      { enemies: [{ type: EnemyType.SOLDIER, count: 10 }], pattern: WavePattern.STANDARD, spawnDelay: 600, pathDistribution: 'distributed' },
      { enemies: [{ type: EnemyType.DRONE, count: 15 }, { type: EnemyType.FLYER, count: 5 }], pattern: WavePattern.SWARM, spawnDelay: 400, pathDistribution: 'distributed' },
      { enemies: [{ type: EnemyType.TANK, count: 4 }, { type: EnemyType.SOLDIER, count: 6 }], pattern: WavePattern.STANDARD, spawnDelay: 700, pathDistribution: 'distributed' },
      { enemies: [{ type: EnemyType.SPEEDER, count: 15 }], pattern: WavePattern.SWARM, spawnDelay: 300, pathDistribution: 'random' },
      { enemies: [{ type: EnemyType.SPAWNER, count: 2 }], pattern: WavePattern.ELITE, spawnDelay: 3000, pathDistribution: 'distributed' },
      { enemies: [{ type: EnemyType.TELEPORTER, count: 6 }, { type: EnemyType.FLYER, count: 8 }], pattern: WavePattern.STANDARD, spawnDelay: 600, pathDistribution: 'distributed' },
      { enemies: [{ type: EnemyType.TANK, count: 6 }, { type: EnemyType.DRONE, count: 15 }], pattern: WavePattern.STANDARD, spawnDelay: 500, pathDistribution: 'distributed' },
      { enemies: [{ type: EnemyType.SOLDIER, count: 20 }], pattern: WavePattern.SWARM, spawnDelay: 300, pathDistribution: 'distributed' },
      { enemies: [{ type: EnemyType.SPAWNER, count: 3 }, { type: EnemyType.TELEPORTER, count: 4 }], pattern: WavePattern.ELITE, spawnDelay: 1500, pathDistribution: 'distributed' },
      { enemies: [{ type: EnemyType.BOSS, count: 1 }], pattern: WavePattern.ELITE, spawnDelay: 0, pathDistribution: 'single' },
      { enemies: [{ type: EnemyType.FLYER, count: 12 }, { type: EnemyType.SPEEDER, count: 12 }], pattern: WavePattern.SWARM, spawnDelay: 250, pathDistribution: 'random' },
      { enemies: [{ type: EnemyType.TANK, count: 8 }, { type: EnemyType.SOLDIER, count: 10 }], pattern: WavePattern.STANDARD, spawnDelay: 500, pathDistribution: 'distributed' },
      { enemies: [{ type: EnemyType.SPAWNER, count: 4 }], pattern: WavePattern.ELITE, spawnDelay: 2000, pathDistribution: 'distributed' },
      { enemies: [{ type: EnemyType.TELEPORTER, count: 10 }], pattern: WavePattern.SWARM, spawnDelay: 400, pathDistribution: 'random' },
      { enemies: [{ type: EnemyType.BOSS, count: 1 }, { type: EnemyType.TANK, count: 4 }], pattern: WavePattern.ELITE, spawnDelay: 1500, pathDistribution: 'distributed' },
      { enemies: [{ type: EnemyType.DRONE, count: 30 }, { type: EnemyType.SPEEDER, count: 15 }], pattern: WavePattern.SWARM, spawnDelay: 150, pathDistribution: 'distributed' },
      { enemies: [{ type: EnemyType.SPAWNER, count: 5 }, { type: EnemyType.FLYER, count: 10 }], pattern: WavePattern.ELITE, spawnDelay: 800, pathDistribution: 'distributed' },
      { enemies: [{ type: EnemyType.TANK, count: 10 }, { type: EnemyType.TELEPORTER, count: 8 }], pattern: WavePattern.ELITE, spawnDelay: 600, pathDistribution: 'distributed' },
      { enemies: [{ type: EnemyType.SOLDIER, count: 25 }, { type: EnemyType.FLYER, count: 15 }], pattern: WavePattern.SWARM, spawnDelay: 200, pathDistribution: 'distributed' },
      { enemies: [{ type: EnemyType.BOSS, count: 2 }, { type: EnemyType.SPAWNER, count: 3 }, { type: EnemyType.TANK, count: 5 }], pattern: WavePattern.ELITE, spawnDelay: 1000, pathDistribution: 'distributed' }
    ],
    exoticResourceChance: 0.4,
    bossWaves: [10, 15, 20]
  }
];

export function getPlanetById(id: string): PlanetData | undefined {
  return PLANETS.find(p => p.id === id);
}

export function getWaveDefinition(planet: PlanetData, waveNumber: number): WaveDefinition {
  const index = Math.min(waveNumber - 1, planet.wavePatterns.length - 1);
  return planet.wavePatterns[index];
}
