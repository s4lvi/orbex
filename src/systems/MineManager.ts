import Phaser from 'phaser';
import { MaterialType } from '../utils/Constants';

/**
 * Represents a single extraction site (mine) from a successful drop.
 *
 * Mines accrue threat over real-world idle time. When threat reaches the raid
 * threshold a raid is triggered with a deadline; if the player doesn't drop in
 * to defend before the deadline, the mine takes damage and may be lost.
 */
export interface Mine {
  id: string;
  planetId: string;
  zoneName: string;
  resourceGeneration: { [key in MaterialType]?: number };
  establishedAt: number; // timestamp
  health: number;        // 0..MINE_MAX_HEALTH; if 0, mine is destroyed and removed
  threat: number;        // 0..100; raid triggers when this hits THREAT_RAID_THRESHOLD
  raid: { triggeredAt: number; deadline: number } | null; // null when no active raid
}

/** Mine health pool. Mines lose health on failed raids and on defeat-during-defense. */
export const MINE_MAX_HEALTH = 100;

/** How many in-game hours pass per real-world hour. Tunable. */
export const WORLD_TIME_SCALE = 60; // 1 real minute = 1 in-game hour

/** Real-world milliseconds in one in-game hour. */
export const MS_PER_GAME_HOUR = 3_600_000 / WORLD_TIME_SCALE;

/** Threat accrued per in-game hour of idleness. */
export const THREAT_PER_HOUR = 12;

/** Threat level at which a raid is triggered. */
export const THREAT_RAID_THRESHOLD = 100;

/** Real-world ms the player has to defend, once a raid is triggered (24 in-game hours). */
export const RAID_DEADLINE_MS = 24 * MS_PER_GAME_HOUR;

/** Health lost when a raid expires undefended. */
export const RAID_FAILURE_DAMAGE = 30;

/** Health restored when a raid is successfully defended. */
export const RAID_DEFENSE_HEAL = 25;

/**
 * Baseline resources granted per wave (before mine bonuses)
 */
export const BASELINE_RESUPPLY: { [key in MaterialType]?: number } = {
  [MaterialType.CARBOX]: 40,
  [MaterialType.HYDRON]: 40
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
   * Load mines from registry. Defensively backfills raid fields on mines saved
   * before the raid system existed.
   */
  private loadMines(): void {
    const savedMines = this.scene.registry.get('mines');
    if (savedMines && Array.isArray(savedMines)) {
      this.mines = savedMines.map((m: Partial<Mine>) => ({
        id: m.id!,
        planetId: m.planetId!,
        zoneName: m.zoneName!,
        resourceGeneration: m.resourceGeneration || {},
        establishedAt: m.establishedAt || Date.now(),
        health: m.health ?? MINE_MAX_HEALTH,
        threat: m.threat ?? 0,
        raid: m.raid ?? null,
      }));
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
      establishedAt: Date.now(),
      health: MINE_MAX_HEALTH,
      threat: 0,
      raid: null,
    };

    this.mines.push(mine);
    this.saveMines();
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

  /**
   * Look up a mine by id.
   */
  public getMine(id: string): Mine | null {
    return this.mines.find(m => m.id === id) || null;
  }

  /**
   * Tick the world clock based on real-world time elapsed since the last tick.
   * Raises threat on idle mines and triggers / expires raids accordingly.
   * Idempotent — call this every time the player enters Hangar.
   *
   * Returns a list of events that happened (for surfacing in the UI):
   *   - "raid_triggered" when a mine just entered raid state
   *   - "raid_failed"    when a mine's raid expired undefended (and may be lost)
   *   - "mine_lost"      when a mine reached 0 hp and was removed
   */
  public tickWorldClock(now: number = Date.now()): Array<{ type: 'raid_triggered' | 'raid_failed' | 'mine_lost'; mineId: string; mineName: string }> {
    const events: Array<{ type: 'raid_triggered' | 'raid_failed' | 'mine_lost'; mineId: string; mineName: string }> = [];

    const lastTick = this.scene.registry.get('worldClock') as number | undefined;
    const elapsedMs = lastTick ? Math.max(0, now - lastTick) : 0;
    const elapsedGameHours = elapsedMs / MS_PER_GAME_HOUR;

    const lostIds: string[] = [];
    for (const mine of this.mines) {
      // Threat creeps up while no active raid is in flight.
      if (!mine.raid) {
        mine.threat = Math.min(THREAT_RAID_THRESHOLD, mine.threat + elapsedGameHours * THREAT_PER_HOUR);

        if (mine.threat >= THREAT_RAID_THRESHOLD) {
          mine.raid = { triggeredAt: now, deadline: now + RAID_DEADLINE_MS };
          events.push({ type: 'raid_triggered', mineId: mine.id, mineName: mine.zoneName });
        }
      } else if (now > mine.raid.deadline) {
        // Raid expired undefended.
        mine.health = Math.max(0, mine.health - RAID_FAILURE_DAMAGE);
        mine.raid = null;
        mine.threat = 0;
        events.push({ type: 'raid_failed', mineId: mine.id, mineName: mine.zoneName });

        if (mine.health <= 0) {
          lostIds.push(mine.id);
          events.push({ type: 'mine_lost', mineId: mine.id, mineName: mine.zoneName });
        }
      }
    }

    // Remove destroyed mines.
    if (lostIds.length > 0) {
      this.mines = this.mines.filter(m => !lostIds.includes(m.id));
    }

    this.scene.registry.set('worldClock', now);
    this.saveMines();
    return events;
  }

  /**
   * Mark a raid as successfully defended. Called by GameScene on victory of a
   * defense mission.
   */
  public defendMine(mineId: string): void {
    const mine = this.getMine(mineId);
    if (!mine) return;
    mine.raid = null;
    mine.threat = 0;
    mine.health = Math.min(MINE_MAX_HEALTH, mine.health + RAID_DEFENSE_HEAL);
    this.saveMines();
  }

  /**
   * Called when the player tried to defend but lost. Mine takes extra damage.
   */
  public failDefense(mineId: string): void {
    const mine = this.getMine(mineId);
    if (!mine) return;
    mine.health = Math.max(0, mine.health - RAID_FAILURE_DAMAGE * 1.5);
    mine.raid = null;
    mine.threat = THREAT_RAID_THRESHOLD * 0.5; // partial reset
    if (mine.health <= 0) {
      this.mines = this.mines.filter(m => m.id !== mineId);
    }
    this.saveMines();
  }
}
