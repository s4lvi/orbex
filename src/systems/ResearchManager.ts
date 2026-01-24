import Phaser from 'phaser';
import { DataLoader } from './DataLoader';
import { GameState } from './GameState';
import { ResearchNode, ResearchProgress } from '../types/GameData';

/**
 * ResearchManager - Manages the tech tree and research progress
 *
 * Tracks which research nodes are completed and checks if items are unlocked.
 * Works with GameState registry for persistence across scenes.
 */
export class ResearchManager {
  private scene: Phaser.Scene;
  private gameState: GameState;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.gameState = new GameState(scene);
  }

  // ============== Research Progress ==============

  /**
   * Get the current research progress
   */
  public getProgress(): ResearchProgress {
    return this.gameState.getResearchProgress();
  }

  /**
   * Get all completed research node IDs
   */
  public getCompletedResearch(): string[] {
    return this.getProgress().completedNodes;
  }

  /**
   * Check if a specific research node is completed
   */
  public isResearchCompleted(nodeId: string): boolean {
    return this.getProgress().completedNodes.includes(nodeId);
  }

  /**
   * Check if all prerequisites for a research node are met
   */
  public arePrerequisitesMet(nodeId: string): boolean {
    const node = DataLoader.getResearchNode(nodeId);
    if (!node) return false;

    const completed = this.getCompletedResearch();
    return node.prerequisites.every(prereq => completed.includes(prereq));
  }

  /**
   * Check if a research node can be started (prerequisites met, not already completed)
   */
  public canResearch(nodeId: string): boolean {
    if (this.isResearchCompleted(nodeId)) return false;
    return this.arePrerequisitesMet(nodeId);
  }

  /**
   * Get the energy cost for a research node
   */
  public getResearchCost(nodeId: string): number {
    const node = DataLoader.getResearchNode(nodeId);
    return node?.energyCost || 0;
  }

  /**
   * Complete a research node (should be called after energy is spent)
   */
  public completeResearch(nodeId: string): boolean {
    if (!this.canResearch(nodeId)) return false;

    this.gameState.completeResearch(nodeId);
    this.scene.events.emit('researchCompleted', nodeId);
    return true;
  }

  /**
   * Spend energy and complete research
   * Returns true if successful
   */
  public purchaseResearch(nodeId: string, resourceManager: { spendEnergy: (amount: number) => boolean, canAffordEnergy: (amount: number) => boolean }): boolean {
    const cost = this.getResearchCost(nodeId);

    if (!this.canResearch(nodeId)) return false;
    if (!resourceManager.canAffordEnergy(cost)) return false;
    if (!resourceManager.spendEnergy(cost)) return false;

    return this.completeResearch(nodeId);
  }

  // ============== Unlock Checks ==============

  /**
   * Check if a turret is unlocked (either available at start or researched)
   */
  public isTurretUnlocked(turretId: string): boolean {
    const turret = DataLoader.getTurret(turretId);
    if (!turret) return false;

    if (turret.availableAtStart) return true;
    if (!turret.researchRequired) return true;

    return this.isResearchCompleted(turret.researchRequired);
  }

  /**
   * Check if a trap is unlocked
   */
  public isTrapUnlocked(trapId: string): boolean {
    const trap = DataLoader.getTrap(trapId);
    if (!trap) return false;

    if (trap.availableAtStart) return true;
    if (!trap.researchRequired) return true;

    return this.isResearchCompleted(trap.researchRequired);
  }

  /**
   * Check if an upgrade is unlocked
   */
  public isUpgradeUnlocked(upgradeId: string): boolean {
    const upgrade = DataLoader.getUpgradeById(upgradeId);
    if (!upgrade) return false;

    if (upgrade.availableAtStart) return true;
    if (!upgrade.researchRequired) return true;

    return this.isResearchCompleted(upgrade.researchRequired);
  }

  /**
   * Get all unlocked turret IDs
   */
  public getUnlockedTurrets(): string[] {
    return DataLoader.getAllTurrets()
      .filter(t => this.isTurretUnlocked(t.id))
      .map(t => t.id);
  }

  /**
   * Get all unlocked trap IDs
   */
  public getUnlockedTraps(): string[] {
    return DataLoader.getAllTraps()
      .filter(t => this.isTrapUnlocked(t.id))
      .map(t => t.id);
  }

  /**
   * Get all unlocked upgrade IDs
   */
  public getUnlockedUpgrades(): string[] {
    const upgrades: string[] = [];

    // Check global upgrades
    for (const upgrade of DataLoader.getAllGlobalUpgrades()) {
      if (this.isUpgradeUnlocked(upgrade.id)) {
        upgrades.push(upgrade.id);
      }
    }

    // Check turret-specific upgrades
    const turretTypes = ['MACHINEGUN', 'LASER', 'CRYO', 'TESLA', 'MISSILE', 'RAILGUN', 'PLASMA'];
    for (const type of turretTypes) {
      for (const upgrade of DataLoader.getTurretUpgrades(type)) {
        if (this.isUpgradeUnlocked(upgrade.id)) {
          upgrades.push(upgrade.id);
        }
      }
    }

    return upgrades;
  }

  // ============== Research Node Queries ==============

  /**
   * Get all research nodes
   */
  public getAllNodes(): ResearchNode[] {
    return DataLoader.getAllResearchNodes();
  }

  /**
   * Get research nodes by category
   */
  public getNodesByCategory(category: 'turrets' | 'traps' | 'upgrades'): ResearchNode[] {
    return DataLoader.getResearchNodesByCategory(category);
  }

  /**
   * Get research nodes by tier
   */
  public getNodesByTier(tier: number): ResearchNode[] {
    return DataLoader.getResearchNodesByTier(tier);
  }

  /**
   * Get available research nodes (can be started now)
   */
  public getAvailableNodes(): ResearchNode[] {
    return this.getAllNodes().filter(node => this.canResearch(node.id));
  }

  /**
   * Get locked research nodes (not yet available)
   */
  public getLockedNodes(): ResearchNode[] {
    return this.getAllNodes().filter(node =>
      !this.isResearchCompleted(node.id) && !this.canResearch(node.id)
    );
  }

  /**
   * Get the research node that would unlock a specific turret
   */
  public getResearchForTurret(turretId: string): ResearchNode | undefined {
    return DataLoader.getResearchForTurret(turretId);
  }

  /**
   * Get the research node that would unlock a specific trap
   */
  public getResearchForTrap(trapId: string): ResearchNode | undefined {
    return DataLoader.getResearchForTrap(trapId);
  }

  /**
   * Get the research node that would unlock a specific upgrade
   */
  public getResearchForUpgrade(upgradeId: string): ResearchNode | undefined {
    return DataLoader.getResearchForUpgrade(upgradeId);
  }

  // ============== Statistics ==============

  /**
   * Get total number of research nodes
   */
  public getTotalNodes(): number {
    return this.getAllNodes().length;
  }

  /**
   * Get number of completed research nodes
   */
  public getCompletedCount(): number {
    return this.getCompletedResearch().length;
  }

  /**
   * Get research progress percentage
   */
  public getProgressPercentage(): number {
    const total = this.getTotalNodes();
    if (total === 0) return 100;
    return Math.round((this.getCompletedCount() / total) * 100);
  }
}
