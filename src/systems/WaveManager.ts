import Phaser from 'phaser';
import { WavePattern, EnemyType } from '../utils/Constants';
import { PlanetData, WaveDefinition, getWaveDefinition } from '../data/planets';
import { GameScene } from '../scenes/GameScene';

interface SpawnEntry {
  type: EnemyType;
  pathIndex: number;
  delay: number;
}

export class WaveManager {
  private scene: GameScene;
  private planet: PlanetData;

  private currentWave: number = 0;
  private totalWaves: number;
  private waveInProgress: boolean = false;
  private waveComplete: boolean = false;

  private spawnQueue: SpawnEntry[] = [];
  private spawnTimer: number = 0;
  private nextSpawnIndex: number = 0;

  private timeBetweenWaves: number = 5000; // ms
  private waveEndTimer: number = 0;
  private waitingForNextWave: boolean = false;

  constructor(scene: GameScene, planet: PlanetData) {
    this.scene = scene;
    this.planet = planet;
    this.totalWaves = planet.waves;
  }

  public update(_time: number, delta: number): void {
    if (this.waveComplete) return;

    if (this.waveInProgress) {
      this.updateSpawning(delta);
    } else if (this.waitingForNextWave) {
      this.waveEndTimer -= delta;
      if (this.waveEndTimer <= 0) {
        this.waitingForNextWave = false;
        this.startNextWave();
      }
    }
  }

  private updateSpawning(delta: number): void {
    if (this.nextSpawnIndex >= this.spawnQueue.length) {
      // All enemies spawned, check if wave is complete
      if (this.scene.enemies.getLength() === 0) {
        this.onWaveComplete();
      }
      return;
    }

    this.spawnTimer += delta;

    while (this.nextSpawnIndex < this.spawnQueue.length) {
      const entry = this.spawnQueue[this.nextSpawnIndex];

      if (this.spawnTimer >= entry.delay) {
        this.spawnEnemy(entry.type, entry.pathIndex);
        this.nextSpawnIndex++;
      } else {
        break;
      }
    }
  }

  public startNextWave(): void {
    if (this.currentWave >= this.totalWaves) {
      this.waveComplete = true;
      return;
    }

    this.currentWave++;
    this.waveInProgress = true;

    // Get wave definition
    const waveDefinition = getWaveDefinition(this.planet, this.currentWave);

    // Generate spawn queue
    this.generateSpawnQueue(waveDefinition);

    // Reset spawn state
    this.spawnTimer = 0;
    this.nextSpawnIndex = 0;

    // Emit wave start event
    this.scene.events.emit('waveStart', this.currentWave);
  }

  private generateSpawnQueue(wave: WaveDefinition): void {
    this.spawnQueue = [];
    let totalDelay = 0;
    const pathCount = this.scene.getZone().paths.length;

    // Flatten enemy list
    const enemies: EnemyType[] = [];
    wave.enemies.forEach((entry: { type: EnemyType; count: number }) => {
      for (let i = 0; i < entry.count; i++) {
        enemies.push(entry.type);
      }
    });

    // Shuffle for variety
    Phaser.Utils.Array.Shuffle(enemies);

    // Assign enemies to spawn queue
    enemies.forEach((type, index) => {
      let pathIndex: number;

      switch (wave.pathDistribution) {
        case 'single':
          pathIndex = 0;
          break;
        case 'distributed':
          pathIndex = index % pathCount;
          break;
        case 'random':
        default:
          pathIndex = Phaser.Math.Between(0, pathCount - 1);
          break;
      }

      // Apply pattern-based timing
      let spawnDelay = wave.spawnDelay;
      if (wave.pattern === WavePattern.SWARM) {
        spawnDelay = Math.floor(spawnDelay * 0.5);
      } else if (wave.pattern === WavePattern.ELITE) {
        spawnDelay = Math.floor(spawnDelay * 1.5);
      }

      this.spawnQueue.push({
        type,
        pathIndex,
        delay: totalDelay
      });

      totalDelay += spawnDelay;
    });
  }

  private spawnEnemy(type: EnemyType, pathIndex: number): void {
    this.scene.spawnEnemy(type, pathIndex);
  }

  private onWaveComplete(): void {
    this.waveInProgress = false;

    // Check for final wave
    if (this.currentWave >= this.totalWaves) {
      this.waveComplete = true;
      this.scene.events.emit('allWavesComplete');
      return;
    }

    // Start timer for next wave
    this.waitingForNextWave = true;
    this.waveEndTimer = this.timeBetweenWaves;

    this.scene.events.emit('waveComplete', this.currentWave);
  }

  public getCurrentWave(): number {
    return this.currentWave;
  }

  public getTotalWaves(): number {
    return this.totalWaves;
  }

  public isWaveInProgress(): boolean {
    return this.waveInProgress;
  }

  public isComplete(): boolean {
    return this.waveComplete;
  }

  public isWaitingForNextWave(): boolean {
    return this.waitingForNextWave;
  }

  public getTimeUntilNextWave(): number {
    return Math.max(0, this.waveEndTimer);
  }

  public getSpawnProgress(): number {
    if (this.spawnQueue.length === 0) return 1;
    return this.nextSpawnIndex / this.spawnQueue.length;
  }

  public getRemainingEnemiesInQueue(): number {
    return this.spawnQueue.length - this.nextSpawnIndex;
  }

  public getDifficultyMultiplier(): number {
    return this.planet.difficultyMultiplier;
  }

  public skipWaveTimer(): void {
    if (this.waitingForNextWave) {
      this.waveEndTimer = 0;
    }
  }
}
