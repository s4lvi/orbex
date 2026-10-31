import { MaterialType } from '../utils/Constants';
import { MaterialCost } from '../types/GameData';

/**
 * Ship upgrades gate access to planets. The first planet is free; later ones
 * are paid for from the player's stockpile (materials + energy) in the hangar.
 */
export interface ShipUpgrade {
  planetId: string;
  name: string;
  description: string;
  cost: MaterialCost;
}

export const SHIP_UPGRADES: { [key: string]: ShipUpgrade } = {
  kepler: {
    planetId: 'kepler',
    name: 'Kepler-442b Access',
    description: 'Starting planet - No upgrade required',
    cost: {}
  },
  proxima: {
    planetId: 'proxima',
    name: 'Medium-Range Jump Drive',
    description: 'Upgrade ship engines to reach Proxima Centauri b',
    cost: {
      [MaterialType.CARBOX]: 400,
      [MaterialType.HYDRON]: 300,
      energy: 150
    }
  },
  trappist: {
    planetId: 'trappist',
    name: 'Long-Range Quantum Drive',
    description: 'Advanced drive system to reach TRAPPIST-1e. Requires exotic materials mined on Proxima.',
    cost: {
      [MaterialType.CARBOX]: 800,
      [MaterialType.HYDRON]: 600,
      [MaterialType.TITAGEN]: 120,
      [MaterialType.OXYON]: 80,
      [MaterialType.PLUTONIA]: 40,
      energy: 400
    }
  }
};

export function getShipUpgrade(planetId: string): ShipUpgrade | undefined {
  return SHIP_UPGRADES[planetId];
}
