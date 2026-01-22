// Ship upgrade system for unlocking planets

export interface ShipUpgrade {
  planetId: string;
  name: string;
  description: string;
  cost: {
    minerals?: number;
    energy?: number;
    alloys?: number;
    plasma?: number;
    crystals?: number;
    darkMatter?: number;
    antimatter?: number;
    quantumFlux?: number;
  };
}

export const SHIP_UPGRADES: { [key: string]: ShipUpgrade } = {
  'kepler': {
    planetId: 'kepler',
    name: 'Terran Prime Access',
    description: 'Starting planet - No upgrade required',
    cost: {}
  },
  'proxima': {
    planetId: 'proxima',
    name: 'Medium-Range Jump Drive',
    description: 'Upgrade ship engines to reach Proxima Centauri b',
    cost: {
      minerals: 500,
      energy: 400,
      alloys: 300
    }
  },
  'trappist': {
    planetId: 'trappist',
    name: 'Long-Range Quantum Drive',
    description: 'Advanced drive system to reach TRAPPIST-1e',
    cost: {
      minerals: 1000,
      energy: 800,
      alloys: 600,
      plasma: 200,
      crystals: 150,
      darkMatter: 100
    }
  }
};

export function getShipUpgrade(planetId: string): ShipUpgrade | undefined {
  return SHIP_UPGRADES[planetId];
}

export function canAffordUpgrade(upgrade: ShipUpgrade, resources: any): boolean {
  for (const [resource, cost] of Object.entries(upgrade.cost)) {
    if ((resources[resource] || 0) < cost) {
      return false;
    }
  }
  return true;
}
