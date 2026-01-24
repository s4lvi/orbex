import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FONTS, TEXT_COLORS } from '../utils/Constants';
import { ResearchManager } from '../systems/ResearchManager';
import { ResourceManager } from '../systems/ResourceManager';
import { ResearchNode } from '../types/GameData';

/**
 * ResearchPanel - Tech tree UI for the hangar
 *
 * Displays research nodes organized by category and tier,
 * allows spending energy to unlock new turrets, traps, and upgrades.
 */
export class ResearchPanel {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private researchManager: ResearchManager;
  private resourceManager: ResourceManager;
  private background!: Phaser.GameObjects.Rectangle;
  private contentContainer!: Phaser.GameObjects.Container;
  private tabContainer!: Phaser.GameObjects.Container;
  private nodeElements: Map<string, Phaser.GameObjects.Container> = new Map();
  private selectedCategory: 'turrets' | 'traps' | 'upgrades' = 'turrets';
  private energyText!: Phaser.GameObjects.Text;
  private onClose: () => void;

  constructor(scene: Phaser.Scene, resourceManager: ResourceManager, onClose: () => void) {
    this.scene = scene;
    this.container = scene.add.container(0, 0);
    this.resourceManager = resourceManager;
    this.researchManager = new ResearchManager(scene);
    this.onClose = onClose;

    this.createPanel();
    this.container.setDepth(1000);
  }

  private createPanel(): void {
    // Full screen semi-transparent overlay
    const overlay = this.scene.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      0x000000,
      0.8
    );
    overlay.setInteractive();
    this.container.add(overlay);

    // Panel background
    const panelWidth = GAME_WIDTH - 80;
    const panelHeight = GAME_HEIGHT - 160;
    this.background = this.scene.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      panelWidth,
      panelHeight,
      0x1a1a2e
    );
    this.container.add(this.background);

    // Panel border
    const border = this.scene.add.graphics();
    border.lineStyle(3, 0x00ff88, 1);
    border.strokeRect(
      GAME_WIDTH / 2 - panelWidth / 2,
      GAME_HEIGHT / 2 - panelHeight / 2,
      panelWidth,
      panelHeight
    );
    this.container.add(border);

    // Title
    const title = this.scene.add.text(GAME_WIDTH / 2, 110, 'RESEARCH LAB', {
      fontSize: '32px',
      fontFamily: FONTS.HEADER,
      color: '#00ff88'
    }).setOrigin(0.5);
    this.container.add(title);

    // Energy display
    const energyLabel = this.scene.add.text(GAME_WIDTH / 2 - 280, 110, 'ENERGY:', {
      fontSize: '18px',
      fontFamily: FONTS.BODY,
      color: TEXT_COLORS.SECONDARY
    }).setOrigin(0, 0.5);
    this.container.add(energyLabel);

    this.energyText = this.scene.add.text(GAME_WIDTH / 2 - 200, 110,
      this.resourceManager.getEnergy().toString(), {
      fontSize: '24px',
      fontFamily: FONTS.HEADER,
      color: '#00ffff'
    }).setOrigin(0, 0.5);
    this.container.add(this.energyText);

    // Close button
    this.createCloseButton();

    // Tab container (so we can easily clear and recreate tabs)
    this.tabContainer = this.scene.add.container(0, 0);
    this.container.add(this.tabContainer);

    // Category tabs
    this.createCategoryTabs();

    // Content container for research nodes
    this.contentContainer = this.scene.add.container(0, 0);
    this.container.add(this.contentContainer);

    // Render initial category
    this.renderCategory(this.selectedCategory);
  }

  private createCloseButton(): void {
    const btnX = GAME_WIDTH - 80;
    const btnY = 110;

    const closeBtn = this.scene.add.text(btnX, btnY, 'X', {
      fontSize: '28px',
      fontFamily: FONTS.HEADER,
      color: TEXT_COLORS.MUTED
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    closeBtn.on('pointerover', () => closeBtn.setColor('#ff4444'));
    closeBtn.on('pointerout', () => closeBtn.setColor(TEXT_COLORS.MUTED));
    closeBtn.on('pointerup', () => {
      this.destroy();
      this.onClose();
    });

    this.container.add(closeBtn);
  }

  private createCategoryTabs(): void {
    const tabY = 160;
    const categories: Array<{ id: 'turrets' | 'traps' | 'upgrades'; label: string }> = [
      { id: 'turrets', label: 'TURRETS' },
      { id: 'traps', label: 'TRAPS' },
      { id: 'upgrades', label: 'UPGRADES' }
    ];

    const tabWidth = 180;
    const startX = GAME_WIDTH / 2 - ((categories.length - 1) * tabWidth) / 2;

    categories.forEach((cat, index) => {
      const x = startX + index * tabWidth;
      const isSelected = cat.id === this.selectedCategory;

      const tabBg = this.scene.add.rectangle(
        x, tabY, tabWidth - 10, 40,
        isSelected ? 0x00ff88 : 0x2a2a4e
      );
      this.tabContainer.add(tabBg);

      const tabText = this.scene.add.text(x, tabY, cat.label, {
        fontSize: '18px',
        fontFamily: FONTS.HEADER,
        color: isSelected ? '#000000' : TEXT_COLORS.SECONDARY
      }).setOrigin(0.5);
      this.tabContainer.add(tabText);

      tabBg.setInteractive({ useHandCursor: true });
      tabBg.on('pointerup', () => {
        this.selectedCategory = cat.id;
        this.refreshTabs();
        this.renderCategory(cat.id);
      });
    });
  }

  private refreshTabs(): void {
    // Clear all tab elements and recreate them
    this.tabContainer.removeAll(true);
    this.createCategoryTabs();
  }

  private renderCategory(category: 'turrets' | 'traps' | 'upgrades'): void {
    // Clear existing content
    this.contentContainer.removeAll(true);
    this.nodeElements.clear();

    const nodes = this.researchManager.getNodesByCategory(category);

    // Group by tier
    const tiers: Map<number, ResearchNode[]> = new Map();
    nodes.forEach(node => {
      if (!tiers.has(node.tier)) {
        tiers.set(node.tier, []);
      }
      tiers.get(node.tier)!.push(node);
    });

    const startY = 220;
    const nodeWidth = 200;
    const nodeHeight = 90;

    let currentY = startY;

    // Sort tiers
    const sortedTiers = Array.from(tiers.keys()).sort((a, b) => a - b);

    sortedTiers.forEach(tier => {
      const tierNodes = tiers.get(tier)!;

      // Tier label
      const tierLabel = this.scene.add.text(60, currentY, `TIER ${tier}`, {
        fontSize: '16px',
        fontFamily: FONTS.HEADER,
        color: TEXT_COLORS.DIM
      });
      this.contentContainer.add(tierLabel);

      // Render nodes in this tier
      const nodeStartX = 100;
      const nodesPerRow = 3;
      const nodeSpacing = nodeWidth + 20;

      tierNodes.forEach((node, index) => {
        const col = index % nodesPerRow;
        const row = Math.floor(index / nodesPerRow);
        const x = nodeStartX + col * nodeSpacing;
        const y = currentY + 30 + row * (nodeHeight + 15);

        this.createNodeElement(node, x, y, nodeWidth, nodeHeight);
      });

      const rows = Math.ceil(tierNodes.length / nodesPerRow);
      currentY += 40 + rows * (nodeHeight + 15);
    });
  }

  private createNodeElement(
    node: ResearchNode,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    const container = this.scene.add.container(x, y);

    const isCompleted = this.researchManager.isResearchCompleted(node.id);
    const canResearch = this.researchManager.canResearch(node.id);
    const canAfford = this.resourceManager.canAffordEnergy(node.energyCost);

    // Background
    let bgColor = 0x2a2a4e; // Locked
    if (isCompleted) {
      bgColor = 0x004422; // Completed
    } else if (canResearch && canAfford) {
      bgColor = 0x224466; // Available
    } else if (canResearch) {
      bgColor = 0x442244; // Available but can't afford
    }

    const bg = this.scene.add.rectangle(width / 2, height / 2, width, height, bgColor);
    container.add(bg);

    // Border
    const borderGraphics = this.scene.add.graphics();
    let borderColor = 0x444466;
    if (isCompleted) {
      borderColor = 0x00ff88;
    } else if (canResearch) {
      borderColor = 0x0088ff;
    }
    borderGraphics.lineStyle(2, borderColor, 1);
    borderGraphics.strokeRect(0, 0, width, height);
    container.add(borderGraphics);

    // Node name
    const name = this.scene.add.text(width / 2, 15, node.name, {
      fontSize: '14px',
      fontFamily: FONTS.HEADER,
      color: isCompleted ? '#00ff88' : '#ffffff',
      wordWrap: { width: width - 10 }
    }).setOrigin(0.5, 0);
    container.add(name);

    // Status or cost
    if (isCompleted) {
      const checkmark = this.scene.add.text(width / 2, height - 20, 'UNLOCKED', {
        fontSize: '14px',
        fontFamily: FONTS.BODY,
        color: '#00ff88'
      }).setOrigin(0.5);
      container.add(checkmark);
    } else {
      const costText = this.scene.add.text(width / 2, height - 25, `${node.energyCost} Energy`, {
        fontSize: '14px',
        fontFamily: FONTS.BODY,
        color: canAfford ? '#00ffff' : '#ff4444'
      }).setOrigin(0.5);
      container.add(costText);

      if (!canResearch) {
        const lockText = this.scene.add.text(width / 2, height - 10, 'LOCKED', {
          fontSize: '12px',
          fontFamily: FONTS.BODY,
          color: TEXT_COLORS.DIM
        }).setOrigin(0.5);
        container.add(lockText);
      }
    }

    // Make interactive if can research
    if (canResearch && !isCompleted) {
      bg.setInteractive({ useHandCursor: true });

      bg.on('pointerover', () => {
        bg.setFillStyle(0x336688);
        borderGraphics.clear();
        borderGraphics.lineStyle(2, 0x00ff88, 1);
        borderGraphics.strokeRect(0, 0, width, height);
      });

      bg.on('pointerout', () => {
        bg.setFillStyle(bgColor);
        borderGraphics.clear();
        borderGraphics.lineStyle(2, borderColor, 1);
        borderGraphics.strokeRect(0, 0, width, height);
      });

      bg.on('pointerup', () => {
        this.attemptResearch(node);
      });
    }

    this.contentContainer.add(container);
    this.nodeElements.set(node.id, container);
  }

  private attemptResearch(node: ResearchNode): void {
    const success = this.researchManager.purchaseResearch(node.id, this.resourceManager);

    if (success) {
      // Update energy display
      this.energyText.setText(this.resourceManager.getEnergy().toString());

      // Refresh the current category
      this.renderCategory(this.selectedCategory);

      // Show success feedback
      const successText = this.scene.add.text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2,
        `${node.name}\nUNLOCKED!`,
        {
          fontSize: '24px',
          fontFamily: FONTS.HEADER,
          color: '#00ff88',
          align: 'center'
        }
      ).setOrigin(0.5);
      this.container.add(successText);

      this.scene.tweens.add({
        targets: successText,
        alpha: 0,
        y: GAME_HEIGHT / 2 - 50,
        duration: 1500,
        onComplete: () => successText.destroy()
      });
    }
  }

  public updateEnergy(): void {
    this.energyText.setText(this.resourceManager.getEnergy().toString());
  }

  public destroy(): void {
    this.container.destroy();
  }
}
