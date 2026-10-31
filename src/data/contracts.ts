import { MaterialType } from '../utils/Constants';

export type ContractId = 'STANDARD' | 'SURVEY' | 'BOUNTY' | 'PURIST' | 'ENDURANCE';

export interface ContractReward {
  /** Multiplied into the regular drop reward (mine output). */
  rewardMultiplier?: number;
  /** Bonus exotic resource awarded on contract success. */
  bonusMaterial?: { type: MaterialType; amount: number };
}

export interface ContractData {
  id: ContractId;
  name: string;
  brief: string;
  /** Short HUD-friendly description of what to do. */
  objective: string;
  /** Bonus payoff on contract completion. */
  bonus: ContractReward;
  /** Multiplier on wave count (only ENDURANCE uses > 1 for now). */
  waveCountMultiplier?: number;
}

export const CONTRACTS: Record<ContractId, ContractData> = {
  STANDARD: {
    id: 'STANDARD',
    name: 'Standard Drop',
    brief: 'Secure the extraction site. No special directives.',
    objective: 'Survive all waves',
    bonus: {},
  },
  SURVEY: {
    id: 'SURVEY',
    name: 'Survey',
    brief: 'Site is fragile. Keep the base structure intact for survey integrity.',
    objective: 'Take ZERO base damage',
    bonus: { bonusMaterial: { type: MaterialType.PLUTONIA, amount: 8 } },
  },
  BOUNTY: {
    id: 'BOUNTY',
    name: 'Bounty Hunt',
    brief: 'High-value targets confirmed in the wave. Take them out for a bounty.',
    objective: 'Kill 5+ elite enemies',
    bonus: { bonusMaterial: { type: MaterialType.XITANIUM, amount: 6 } },
  },
  PURIST: {
    id: 'PURIST',
    name: 'Lean Loadout',
    brief: 'Logistics is overstretched. Win without overdeploying.',
    objective: 'Build 3 or fewer turrets',
    bonus: { bonusMaterial: { type: MaterialType.NANON, amount: 3 } },
  },
  ENDURANCE: {
    id: 'ENDURANCE',
    name: 'Endurance',
    brief: 'Extended engagement window. More waves, more reward.',
    objective: 'Survive a longer engagement',
    bonus: { rewardMultiplier: 2.0 },
    waveCountMultiplier: 1.5,
  },
};

const ROLLABLE: ContractId[] = ['STANDARD', 'STANDARD', 'SURVEY', 'BOUNTY', 'PURIST', 'ENDURANCE'];
// STANDARD listed twice → ~33% baseline; the others sit at ~17% each.

export function rollContract(): ContractId {
  return ROLLABLE[Math.floor(Math.random() * ROLLABLE.length)];
}

/** Runtime contract progress, tracked on GameScene. */
export interface ContractProgress {
  contractId: ContractId;
  baseDamageTaken: number;
  eliteKills: number;
  turretsBuilt: number;
  /** Whether the contract has already been failed (irrecoverable). */
  failed: boolean;
}

export function isContractSuccessful(progress: ContractProgress): boolean {
  if (progress.failed) return false;
  switch (progress.contractId) {
    case 'STANDARD':
      return false; // no bonus
    case 'SURVEY':
      return progress.baseDamageTaken === 0;
    case 'BOUNTY':
      return progress.eliteKills >= 5;
    case 'PURIST':
      return progress.turretsBuilt <= 3;
    case 'ENDURANCE':
      return true; // surviving all (extended) waves IS the contract
  }
}
