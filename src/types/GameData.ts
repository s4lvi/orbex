import { DamageType, MaterialType } from '../utils/Constants';

export { MaterialType };

// Material definition with display properties
export interface MaterialDefinition {
  id: MaterialType;
  name: string;
  color: string;
  rarity: 'common' | 'rare';
  description: string;
}

// Cost structure using materials
export interface MaterialCost {
  [key: string]: number;
}

// Research node in the tech tree
export interface ResearchNode {
  id: string;
  category: 'turrets' | 'traps' | 'upgrades';
  name: string;
  description: string;
  energyCost: number;
  prerequisites: string[];
  unlocks: {
    turrets?: string[];
    traps?: string[];
    upgrades?: string[];
  };
  tier: number;
  icon?: string;
}

// Research configuration
export interface ResearchConfig {
  nodes: ResearchNode[];
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
  special?: {
    aoe?: number;
    slow?: number;
    slowDuration?: number;
    chainTargets?: number;
    piercing?: boolean;
    dotDamage?: number;
    dotDuration?: number;
  };
}

// Turrets configuration
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

// Traps configuration
export interface TrapsConfig {
  traps: { [key: string]: TrapConfig };
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
  effect: {
    damage?: number;
    range?: number;
    fireRate?: number;
    aoe?: number;
    slow?: number;
    slowDuration?: number;
    chainTargets?: number;
    critChance?: number;
    critDamage?: number;
  };
}

// Upgrades configuration
export interface UpgradesConfig {
  globalUpgrades: UpgradeConfig[];
  turretUpgrades: { [key: string]: UpgradeConfig[] };
}

// Materials configuration
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

// Player session data
export interface PlayerSession {
  resources: ResourceState;
  research: ResearchProgress;
}
