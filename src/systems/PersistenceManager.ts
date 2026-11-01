import Phaser from 'phaser';

const SLOT_COUNT = 3;
const SLOT_KEY_PREFIX = 'orbex.save.slot.';
const ACTIVE_SLOT_KEY = 'orbex.activeSlot';
const LEGACY_STORAGE_KEY = 'orbex.save.v1';
const SCHEMA_VERSION = 1;
const SAVE_DEBOUNCE_MS = 400;

const PERSISTENT_KEYS = [
  'sessionResources',
  'researchProgress',
  'mines',
  'completedDrops',
  'unlockedPlanets',
  'playerStats',
  'turretInventory',
  'orbitalWeaponsState',
  'performanceHistory',
  'worldClock',
] as const;

type PersistentKey = typeof PERSISTENT_KEYS[number];

interface SaveBlob {
  version: number;
  savedAt: number;
  data: Partial<Record<PersistentKey, unknown>>;
}

/** What the slot picker shows for each slot. */
export interface SaveSlotSummary {
  slot: number;
  savedAt: number;
  totalDrops: number;
  successfulDrops: number;
  energy: number;
  mines: number;
  planetsUnlocked: number;
  researchCompleted: number;
  rosterSize: number;
}

/**
 * LocalStorage persistence with three save slots. Exactly one slot is active:
 * the registry auto-saves into it (debounced) whenever a persistent key changes.
 */
export class PersistenceManager {
  private static instance: PersistenceManager | null = null;
  private game: Phaser.Game;
  private saveTimer: number | null = null;
  private suppressSave = false;
  private available: boolean;
  private activeSlot: number = 1;

  private constructor(game: Phaser.Game) {
    this.game = game;
    this.available = this.checkAvailable();
    if (this.available) {
      this.migrateLegacySave();
      this.activeSlot = this.readActiveSlot();
    }
  }

  static init(game: Phaser.Game): PersistenceManager {
    if (!PersistenceManager.instance) {
      PersistenceManager.instance = new PersistenceManager(game);
    }
    return PersistenceManager.instance;
  }

  static get(): PersistenceManager {
    if (!PersistenceManager.instance) {
      throw new Error('PersistenceManager not initialized');
    }
    return PersistenceManager.instance;
  }

  static get slotCount(): number {
    return SLOT_COUNT;
  }

  private checkAvailable(): boolean {
    try {
      const probe = '__orbex_probe__';
      localStorage.setItem(probe, probe);
      localStorage.removeItem(probe);
      return true;
    } catch {
      return false;
    }
  }

  /** Saves written before slots existed become slot 1. */
  private migrateLegacySave(): void {
    try {
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!legacy) return;
      if (!localStorage.getItem(this.slotKey(1))) {
        localStorage.setItem(this.slotKey(1), legacy);
        localStorage.setItem(ACTIVE_SLOT_KEY, '1');
      }
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch (err) {
      console.warn('[PersistenceManager] legacy migration failed', err);
    }
  }

  private slotKey(slot: number): string {
    return `${SLOT_KEY_PREFIX}${slot}`;
  }

  private readActiveSlot(): number {
    try {
      const raw = parseInt(localStorage.getItem(ACTIVE_SLOT_KEY) || '1', 10);
      return raw >= 1 && raw <= SLOT_COUNT ? raw : 1;
    } catch {
      return 1;
    }
  }

  public getActiveSlot(): number {
    return this.activeSlot;
  }

  private setActiveSlot(slot: number): void {
    this.activeSlot = slot;
    try {
      localStorage.setItem(ACTIVE_SLOT_KEY, String(slot));
    } catch (err) {
      console.warn('[PersistenceManager] could not store active slot', err);
    }
  }

  // ---------------------------------------------------------------- registry <-> storage

  /**
   * Read the active slot and write each persistent key into the registry.
   * Must run BEFORE BootScene applies defaults, which only fill missing keys.
   */
  hydrate(): void {
    if (!this.available) return;
    const blob = this.readSlot(this.activeSlot);
    if (!blob) return;

    this.suppressSave = true;
    try {
      for (const key of PERSISTENT_KEYS) {
        if (key in blob.data) {
          this.game.registry.set(key, blob.data[key]);
        }
      }
    } finally {
      this.suppressSave = false;
    }
  }

  /** Remove every persistent key from the in-memory registry. */
  private clearRegistry(): void {
    this.suppressSave = true;
    try {
      for (const key of PERSISTENT_KEYS) {
        this.game.registry.remove(key);
      }
    } finally {
      this.suppressSave = false;
    }
  }

  /** Subscribe to registry changes and auto-save whitelisted keys (debounced). */
  attach(): void {
    if (!this.available) return;
    // DataManager emits `setdata` the first time a key is written and
    // `changedata` afterwards; both must schedule a save.
    this.game.registry.events.on('setdata', this.onRegistryChange, this);
    this.game.registry.events.on('changedata', this.onRegistryChange, this);
  }

  private onRegistryChange(_parent: unknown, key: string): void {
    if (this.suppressSave) return;
    if (!PERSISTENT_KEYS.includes(key as PersistentKey)) return;
    this.scheduleSave();
  }

  private scheduleSave(): void {
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
    }
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      this.flush();
    }, SAVE_DEBOUNCE_MS);
  }

  private snapshot(): SaveBlob {
    const data: Partial<Record<PersistentKey, unknown>> = {};
    for (const key of PERSISTENT_KEYS) {
      const value = this.game.registry.get(key);
      if (value !== undefined) {
        data[key] = value;
      }
    }
    return { version: SCHEMA_VERSION, savedAt: Date.now(), data };
  }

  /** Force a synchronous write of the registry into the active slot. */
  flush(): void {
    if (!this.available) return;
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.writeSlot(this.activeSlot, this.snapshot());
  }

  private writeSlot(slot: number, blob: SaveBlob): void {
    try {
      localStorage.setItem(this.slotKey(slot), JSON.stringify(blob));
    } catch (err) {
      console.warn('[PersistenceManager] save failed', err);
    }
  }

  private readSlot(slot: number): SaveBlob | null {
    try {
      const raw = localStorage.getItem(this.slotKey(slot));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as SaveBlob;
      if (typeof parsed !== 'object' || parsed === null) return null;
      if (parsed.version !== SCHEMA_VERSION) {
        return this.migrate(parsed);
      }
      return parsed;
    } catch (err) {
      console.warn('[PersistenceManager] load failed', err);
      return null;
    }
  }

  private migrate(blob: SaveBlob): SaveBlob | null {
    // Future schema migrations land here. For now, drop incompatible saves.
    console.warn('[PersistenceManager] incompatible save version, dropping', blob.version);
    return null;
  }

  // ---------------------------------------------------------------- slot operations

  /** Start a fresh game in `slot`: the slot is emptied and becomes active. */
  startNewGame(slot: number): void {
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.clearRegistry();
    if (this.available) {
      try {
        localStorage.removeItem(this.slotKey(slot));
      } catch (err) {
        console.warn('[PersistenceManager] wipe failed', err);
      }
      this.setActiveSlot(slot);
    }
  }

  /** Make `slot` active and load it into the registry. Returns false if it is empty. */
  loadSlot(slot: number): boolean {
    if (!this.available) return false;
    const blob = this.readSlot(slot);
    if (!blob) return false;
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.clearRegistry();
    this.setActiveSlot(slot);
    this.hydrate();
    return true;
  }

  /** Copy the current game into `slot` and continue playing from there. */
  saveToSlot(slot: number): void {
    if (!this.available) return;
    this.writeSlot(slot, this.snapshot());
    this.setActiveSlot(slot);
  }

  /** Wipe the active slot (used by the legacy "erase" flow). */
  wipe(): void {
    this.startNewGame(this.activeSlot);
  }

  /**
   * Permanently erase `slot`. If it is the active slot the registry is cleared
   * too, so a pending auto-save cannot resurrect it; the next NEW GAME / LOAD
   * goes through Boot, which re-applies defaults.
   */
  deleteSlot(slot: number): void {
    if (!this.available) return;
    if (slot === this.activeSlot) {
      if (this.saveTimer !== null) {
        window.clearTimeout(this.saveTimer);
        this.saveTimer = null;
      }
      this.clearRegistry();
    }
    try {
      localStorage.removeItem(this.slotKey(slot));
    } catch (err) {
      console.warn('[PersistenceManager] delete failed', err);
    }
  }

  getSlotSummary(slot: number): SaveSlotSummary | null {
    const blob = this.readSlot(slot);
    if (!blob) return null;
    const d = blob.data as {
      playerStats?: { totalDrops?: number; successfulDrops?: number };
      researchProgress?: { completedNodes?: string[] };
      mines?: unknown[];
      sessionResources?: { energy?: number };
      unlockedPlanets?: string[];
      turretInventory?: { turrets?: unknown[] };
    };
    return {
      slot,
      savedAt: blob.savedAt,
      totalDrops: d.playerStats?.totalDrops ?? 0,
      successfulDrops: d.playerStats?.successfulDrops ?? 0,
      energy: Math.floor(d.sessionResources?.energy ?? 0),
      mines: d.mines?.length ?? 0,
      planetsUnlocked: Math.max(1, d.unlockedPlanets?.length ?? 1),
      researchCompleted: d.researchProgress?.completedNodes?.length ?? 0,
      rosterSize: d.turretInventory?.turrets?.length ?? 0,
    };
  }

  listSlots(): (SaveSlotSummary | null)[] {
    const out: (SaveSlotSummary | null)[] = [];
    for (let slot = 1; slot <= SLOT_COUNT; slot++) {
      out.push(this.available ? this.getSlotSummary(slot) : null);
    }
    return out;
  }

  /** True when a slot holds real progress (slots fill with defaults as soon as a game boots). */
  slotHasProgress(slot: number): boolean {
    const s = this.getSlotSummary(slot);
    if (!s) return false;
    return s.totalDrops > 0 || s.researchCompleted > 0 || s.mines > 0 || s.rosterSize > 0 || s.planetsUnlocked > 1;
  }

  hasProgress(): boolean {
    return this.available && this.slotHasProgress(this.activeSlot);
  }

  anySlotHasProgress(): boolean {
    if (!this.available) return false;
    for (let slot = 1; slot <= SLOT_COUNT; slot++) {
      if (this.slotHasProgress(slot)) return true;
    }
    return false;
  }
}
