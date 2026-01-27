// Game dimensions (portrait mobile-first)
export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 1280;

// Grid configuration (base tile size - grid dimensions now configurable per planet)
export const TILE_SIZE = 64;

// Default grid sizes (used as fallback)
export const DEFAULT_GRID_WIDTH = 12;
export const DEFAULT_GRID_HEIGHT = 12;

// Legacy grid dimensions (for backward compatibility)
export const GRID_WIDTH = DEFAULT_GRID_WIDTH;
export const GRID_HEIGHT = DEFAULT_GRID_HEIGHT;

// Grid size configurations per planet tier (progressive unlock)
export const GRID_SIZES = {
  SMALL: { width: 12, height: 12 },   // Planet 1: Tutorial/learning
  MEDIUM: { width: 16, height: 16 },   // Planets 2-3
  LARGE: { width: 20, height: 20 },    // Planets 4-5
  XLARGE: { width: 25, height: 25 }    // Planets 6+
} as const;

// Camera configuration
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 1.5;
export const DEFAULT_ZOOM = 0.8;

// Computed values (for legacy compatibility - actual values computed at runtime)
export const PLAYABLE_WIDTH = TILE_SIZE * DEFAULT_GRID_WIDTH;
export const PLAYABLE_HEIGHT = TILE_SIZE * DEFAULT_GRID_HEIGHT;

// UI margins (deprecated - camera system handles positioning)
// Kept for backward compatibility but should be phased out
export const UI_MARGIN_X = 0;
export const UI_MARGIN_Y = 0;

// Gameplay constants
export const BASE_HEALTH = 20;
export const TARGET_FPS = 60;
export const STARTING_BASIC_RESOURCES = 100;

// Fonts
export const FONTS = {
  HEADER: 'Orbitron',
  BODY: 'Rajdhani',
  MONO: 'monospace'
};

// Text colors (brighter for CRT readability)
export const TEXT_COLORS = {
  PRIMARY: '#00ff88',
  SECONDARY: '#aaaaaa',
  MUTED: '#888888',
  DIM: '#666666',
  DARK: '#444444'
};

// Damage types
export enum DamageType {
  KINETIC = 'kinetic',
  THERMAL = 'thermal',
  CRYO = 'cryo',
  ELECTRIC = 'electric',
  EXPLOSIVE = 'explosive'
}

// Material types for the new resource system
export enum MaterialType {
  // Basic materials (common, early game)
  CARBOX = 'carbox',
  HYDRON = 'hydron',
  // Rare materials (progression-gated)
  TITAGEN = 'titagen',
  OXYON = 'oxyon',
  PLUTONIA = 'plutonia',
  XITANIUM = 'xitanium',
  NANON = 'nanon'
}

// Material colors for UI display
export const MATERIAL_COLORS: { [key in MaterialType]: number } = {
  [MaterialType.CARBOX]: 0x8B4513,    // Brown
  [MaterialType.HYDRON]: 0x4169E1,    // Royal Blue
  [MaterialType.TITAGEN]: 0xC0C0C0,   // Silver
  [MaterialType.OXYON]: 0x00CED1,     // Dark Cyan
  [MaterialType.PLUTONIA]: 0x32CD32,  // Lime Green
  [MaterialType.XITANIUM]: 0x9932CC,  // Dark Orchid
  [MaterialType.NANON]: 0xFFD700      // Gold
};

// Energy color
export const ENERGY_COLOR = 0x00FFFF; // Cyan

// Enemy types
export enum EnemyType {
  DRONE = 'drone',
  SOLDIER = 'soldier',
  TANK = 'tank',
  SPEEDER = 'speeder',
  FLYER = 'flyer',
  TELEPORTER = 'teleporter',
  SPAWNER = 'spawner',
  BOSS = 'boss'
}

// Turret types
export enum TurretType {
  MACHINEGUN = 'machinegun',
  LASER = 'laser',
  CRYO = 'cryo',
  TESLA = 'tesla',
  MISSILE = 'missile',
  RAILGUN = 'railgun',
  PLASMA = 'plasma'
}

// Trap types
export enum TrapType {
  SPIKE = 'spike',
  SLOWFIELD = 'slowfield',
  MINE = 'mine',
  EMP = 'emp',
  FIRE = 'fire'
}

// Planet difficulty
export enum PlanetDifficulty {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard'
}

// Wave pattern types
export enum WavePattern {
  STANDARD = 'standard',
  SWARM = 'swarm',
  ELITE = 'elite'
}

// Colors for procedural graphics
export const COLORS = {
  // UI colors
  PRIMARY: 0x00ff88,
  SECONDARY: 0x0088ff,
  DANGER: 0xff4444,
  WARNING: 0xffaa00,
  SUCCESS: 0x44ff44,

  // Damage type colors
  KINETIC: 0xaaaaaa,
  THERMAL: 0xff6600,
  CRYO: 0x00ccff,
  ELECTRIC: 0xffff00,
  EXPLOSIVE: 0xff3300,

  // Planet colors
  PLANET_EASY: 0x44aa44,
  PLANET_MEDIUM: 0xaa8844,
  PLANET_HARD: 0xaa4444,

  // UI backgrounds
  PANEL_BG: 0x1a1a2e,
  PANEL_BORDER: 0x4a4a6e,

  // Tile colors
  TILE_GROUND: 0x2d2d44,
  TILE_PATH: 0x3d3d5e,
  TILE_BUILDABLE: 0x2d4d4d,
  TILE_BLOCKED: 0x4d2d2d
};

// Scene keys
export const SCENES = {
  BOOT: 'BootScene',
  MAIN_MENU: 'MainMenuScene',
  HANGAR: 'HangarScene',
  PLANET_SELECT: 'PlanetSelectScene',
  LANDING_ZONE_SELECT: 'LandingZoneSelectScene',
  GAME: 'GameScene',
  RESULTS: 'ResultsScene'
};

// Depth layers for rendering order
export const DEPTH = {
  GROUND: 0,
  PATH: 10,
  TRAP: 20,
  ENEMY: 30,
  PROJECTILE: 40,
  TURRET: 50,
  EFFECTS: 60,
  ORBITAL_STRIKE: 70,
  ORBITAL_RETICLE: 75,
  UI: 100
};
