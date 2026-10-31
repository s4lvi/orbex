import { DamageType, MaterialType } from '../utils/Constants';
import type { Mine } from '../systems/MineManager';

export { MaterialType };

// Material definition with display properties
export interface MaterialDefinition {
  id: MaterialType;
  name: string;
  color: string;
  rarity: 'common' | 'rare';
  description: string;
}

// Cost structure: material ids (and the special key "energy") -> amount
export interface MaterialCost {
  [key: string]: number;
}

export type ResearchCategory = 'turrets' | 'traps' | 'upgrades' | 'orbital';

// Research node in the tech tree
export interface ResearchNode {
  id: string;
  category: ResearchCategory;
  name: string;
  description: string;
  energyCost: number;
  prerequisites: string[];
  unlocks: {
    turrets?: string[];
    traps?: string[];
    upgrades?: string[];
    orbital?: string[];
  };
  tier: number;
  icon?: string;
}

export interface ResearchConfig {
  nodes: ResearchNode[];
}

// Special behaviour a turret can carry (base data or granted by upgrades)
export interface TurretSpecial {
  aoe?: number;
  slow?: number;
  slowDuration?: number;
  chainTargets?: number;
  piercing?: boolean;
  dotDamage?: number;
  dotDuration?: number;
}

// Turret configuration from JSON
export interface TurretConfig {
  id: string;
  name: string;
  description: string;
  availableAtStart: boolean;
  researchRequired: string | null;
  cost: MaterialCost;
  damage: number;
  damageType: DamageType;
  range: number;
  fireRate: number;
  projectileSpeed: number;
  maxLevel: number;
  upgradeCosts: MaterialCost[];
  special?: TurretSpecial;
}

export interface TurretsConfig {
  turrets: { [key: string]: TurretConfig };
}

// Trap configuration from JSON
export interface TrapConfig {
  id: string;
  name: string;
  description: string;
  availableAtStart: boolean;
  researchRequired: string | null;
  cost: MaterialCost;
  damage: number;
  damageType: DamageType;
  triggerRadius: number;
  cooldown: number;
  duration: number;
  uses: number;
  effect?: {
    slow?: number;
    slowDuration?: number;
    dot?: number;
    dotDuration?: number;
    stun?: number;
    aoe?: number;
  };
}

export interface TrapsConfig {
  traps: { [key: string]: TrapConfig };
}

/**
 * Effect of a turret upgrade. Multipliers unless noted.
 */
export interface UpgradeEffect {
  damage?: number;
  range?: number;
  fireRate?: number;
  aoe?: number;
  slow?: number;
  slowDuration?: number;
  dotDamage?: number;
  projectileSpeed?: number;
  chainTargets?: number;      // additive
  critChance?: number;        // absolute (0-1)
  critDamage?: number;        // absolute multiplier
  armorPenetration?: number;  // absolute fraction of armor ignored (0-1)
  stunOnHit?: number;         // ms of stun applied on every hit
  homing?: boolean;           // projectiles steer toward their target
  pierceFalloff?: number;     // absolute: damage lost per pierced enemy (0 = none)
  bonusVsSlowed?: number;     // multiplier applied against slowed enemies
  novaOnKill?: number;        // fraction of damage dealt as AOE when a hit kills
}

// Upgrade configuration from JSON
export interface UpgradeConfig {
  id: string;
  name: string;
  description: string;
  availableAtStart: boolean;
  researchRequired: string | null;
  cost: MaterialCost;
  requiredLevel: number;
  turretTypes?: string[];
  effect: UpgradeEffect;
}

export interface UpgradesConfig {
  globalUpgrades: UpgradeConfig[];
  turretUpgrades: { [key: string]: UpgradeConfig[] };
}

export interface MaterialsConfig {
  materials: { [key: string]: MaterialDefinition };
}

// Resources state (energy + materials)
export interface ResourceState {
  energy: number;
  materials: { [key in MaterialType]: number };
}

// Research progress state
export interface ResearchProgress {
  completedNodes: string[];
  currentlyResearching: string | null;
}

// Per-turret identity. Optional so saves predating the roster system still load.
export interface TurretIdentity {
  callsign: string;
  kills: number;
  dropsSurvived: number;
  createdAt: number; // epoch ms
}

// Turret instance with unique ID for persistence
export interface TurretInstance {
  id: string;
  type: string;  // TurretType as string
  level: number;
  appliedUpgrades: string[];
  identity?: TurretIdentity;
}

// Turret inventory for persistence across missions
export interface TurretInventory {
  turrets: TurretInstance[];
  maxCapacity: number;
}

/**
 * A single enemy path through a landing zone, in grid coordinates.
 * The start cell sits on a map edge; the last waypoint is the base.
 */
export interface PathData {
  startX: number;
  startY: number;
  waypoints: { x: number; y: number }[];
}

export interface ContractResult {
  id: string;
  name: string;
  objective: string;
  succeeded: boolean;
  bonusMaterial: { type: string; amount: number } | null;
  bonusEnergy: number;
}

/**
 * Outcome of a drop, written to the registry by GameScene and read by ResultsScene.
 * All persistent state has already been updated by the time this exists; the
 * results screen only displays it.
 */
export interface GameResult {
  victory: boolean;
  energyEarned: number;
  materialsEarned: { [key in MaterialType]?: number };
  mineEstablished: Mine | null;
  defendedMineName: string | null;
  wavesCompleted: number;
  totalWaves: number;
  baseHealth: number;
  enemiesKilled: number;
  turretsBuilt: number;
  turretsCollected: number;
  turretsLost: number;
  contract: ContractResult | null;
}
