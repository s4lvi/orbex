// Game dimensions (portrait mobile-first)
export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 1280;

// Grid configuration
export const TILE_SIZE = 64;
export const GRID_WIDTH = 9;
export const GRID_HEIGHT = 16;
export const PLAYABLE_WIDTH = TILE_SIZE * GRID_WIDTH; // 576
export const PLAYABLE_HEIGHT = TILE_SIZE * GRID_HEIGHT; // 1024

// UI margins
export const UI_MARGIN_X = (GAME_WIDTH - PLAYABLE_WIDTH) / 2; // 72
export const UI_MARGIN_Y = (GAME_HEIGHT - PLAYABLE_HEIGHT) / 2; // 128

// Gameplay constants
export const BASE_HEALTH = 20;
export const TARGET_FPS = 60;
export const STARTING_BASIC_RESOURCES = 100;

// Damage types
export enum DamageType {
  KINETIC = 'kinetic',
  THERMAL = 'thermal',
  CRYO = 'cryo',
  ELECTRIC = 'electric',
  EXPLOSIVE = 'explosive'
}

// Resource types
export enum ResourceType {
  // Basic resources
  MINERALS = 'minerals',
  ENERGY = 'energy',
  ALLOYS = 'alloys',
  // Exotic resources
  PLASMA = 'plasma',
  CRYSTALS = 'crystals',
  DARK_MATTER = 'darkMatter',
  ANTIMATTER = 'antimatter',
  QUANTUM_FLUX = 'quantumFlux'
}

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
  UI: 100
};
