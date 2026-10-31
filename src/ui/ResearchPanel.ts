import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FONTS, TEXT_COLORS } from '../utils/Constants';
import { ResearchManager } from '../systems/ResearchManager';
import { ResourceManager } from '../systems/ResourceManager';
import { ResearchNode, ResearchCategory } from '../types/GameData';
import { OrbitalWeaponType, getOrbitalWeaponData, getOrbitalUpgradeCost, getScaledOrbitalWeaponStats } from '../data/orbitalWeapons';
import { getOrbitalWeaponLevel, setOrbitalWeaponLevel } from '../systems/OrbitalWeaponState';

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
  private selectedCategory: ResearchCategory = 'turrets';
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
    const title = this.scene.add.text(GAME_WIDTH / 2, 108, 'RESEARCH LAB', {
      fontSize: '30px',
      fontFamily: FONTS.HEADER,
      color: '#00ff88'
    }).setOrigin(0.5);
    this.container.add(title);

    // Energy display, on its own line under the title so it can't collide with it.
    const energyLabel = this.scene.add.text(GAME_WIDTH / 2 - 60, 142, 'ENERGY', {
      fontSize: '14px',
      fontFamily: FONTS.BODY,
      color: TEXT_COLORS.SECONDARY
    }).setOrigin(1, 0.5);
    this.container.add(energyLabel);

    this.energyText = this.scene.add.text(GAME_WIDTH / 2 - 50, 142,
      this.resourceManager.getEnergy().toString(), {
      fontSize: '20px',
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
    const btnX = GAME_WIDTH - 70;
    const btnY = 108;

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
    const tabY = 180;
    const categories: Array<{ id: ResearchCategory; label: string }> = [
      { id: 'turrets', label: 'TURRETS' },
      { id: 'traps', label: 'TRAPS' },
      { id: 'upgrades', label: 'UPGRADES' },
      { id: 'orbital', label: 'ORBITAL' }
    ];

    const tabWidth = 150;
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
        fontSize: '16px',
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

  private renderCategory(category: ResearchCategory): void {
    // Clear existing content
    this.contentContainer.removeAll(true);
    this.nodeElements.clear();

    if (category === 'orbital') {
      this.renderOrbitalWeapons();
    }

    const nodes = this.researchManager.getNodesByCategory(category);

    // Group by tier
    const tiers: Map<number, ResearchNode[]> = new Map();
    nodes.forEach(node => {
      if (!tiers.has(node.tier)) {
        tiers.set(node.tier, []);
      }
      tiers.get(node.tier)!.push(node);
    });

    const startY = category === 'orbital' ? 220 + this.orbitalSectionHeight : 220;
    const nodeWidth = 190;
    const nodeHeight = 72;

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

      // Three columns, sized to stay inside the panel (40..680).
      const nodeStartX = 60;
      const nodesPerRow = 3;
      const nodeSpacing = nodeWidth + 10;
      const rowGap = 10;

      tierNodes.forEach((node, index) => {
        const col = index % nodesPerRow;
        const row = Math.floor(index / nodesPerRow);
        const x = nodeStartX + col * nodeSpacing;
        const y = currentY + 24 + row * (nodeHeight + rowGap);

        this.createNodeElement(node, x, y, nodeWidth, nodeHeight);
      });

      const rows = Math.ceil(tierNodes.length / nodesPerRow);
      currentY += 30 + rows * (nodeHeight + rowGap);
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

    // Node name (at most two lines; scaled down if it would still overflow)
    const name = this.scene.add.text(width / 2, 8, node.name, {
      fontSize: '12px',
      fontFamily: FONTS.HEADER,
      color: isCompleted ? '#00ff88' : '#ffffff',
      align: 'center',
      wordWrap: { width: width - 12 }
    }).setOrigin(0.5, 0);
    if (name.height > 30) name.setScale(30 / name.height);
    container.add(name);

    // Status line: cost (and lock state) on one row near the bottom.
    if (isCompleted) {
      container.add(this.scene.add.text(width / 2, height - 16, 'UNLOCKED', {
        fontSize: '12px',
        fontFamily: FONTS.BODY,
        color: '#00ff88'
      }).setOrigin(0.5));
    } else {
      const status = canResearch ? `${node.energyCost} Energy` : `${node.energyCost} Energy  ·  LOCKED`;
      container.add(this.scene.add.text(width / 2, height - 16, status, {
        fontSize: '12px',
        fontFamily: FONTS.BODY,
        color: !canResearch ? TEXT_COLORS.DIM : canAfford ? '#00ffff' : '#ff4444'
      }).setOrigin(0.5));
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

  private orbitalSectionHeight = 0;

  /**
   * Level-up controls for every unlocked orbital weapon, shown above the
   * research nodes on the ORBITAL tab.
   */
  private renderOrbitalWeapons(): void {
    const registry = this.scene.registry;
    const completed = this.researchManager.getCompletedResearch();
    const weapons = Object.values(OrbitalWeaponType)
      .map(type => getOrbitalWeaponData(type))
      .filter(w => w.unlocked || (w.researchRequired && completed.includes(w.researchRequired)));

    const rowHeight = 56;
    const startY = 214;
    const x = 60;
    const width = GAME_WIDTH - 120;

    this.contentContainer.add(this.scene.add.text(x, startY, 'WEAPON LEVELS', {
      fontSize: '16px',
      fontFamily: FONTS.HEADER,
      color: TEXT_COLORS.DIM
    }));

    weapons.forEach((weapon, i) => {
      const y = startY + 28 + i * rowHeight;
      const level = getOrbitalWeaponLevel(registry, weapon.id);
      const maxed = level >= weapon.maxLevel;
      const cost = getOrbitalUpgradeCost(weapon.id, level);
      const canAfford = !maxed && this.resourceManager.canAffordEnergy(cost);
      const stats = getScaledOrbitalWeaponStats(weapon.id, level);

      const row = this.scene.add.container(x, y);
      row.add(this.scene.add.rectangle(width / 2, rowHeight / 2 - 4, width, rowHeight - 8, 0x1f1f3a));
      row.add(this.scene.add.text(12, 8, `${weapon.name}  Lv ${level}/${weapon.maxLevel}`, {
        fontSize: '15px',
        fontFamily: FONTS.HEADER,
        color: '#ffffff'
      }));
      row.add(this.scene.add.text(12, 29, `DMG ${stats.damage}  CD ${(stats.cooldown / 1000).toFixed(1)}s  AOE ${stats.aoeRadius || '-'}`, {
        fontSize: '12px',
        fontFamily: FONTS.MONO,
        color: TEXT_COLORS.MUTED
      }));

      const btn = this.scene.add.text(width - 12, rowHeight / 2 - 4, maxed ? 'MAX' : `UPGRADE  ${cost}⚡`, {
        fontSize: '13px',
        fontFamily: FONTS.HEADER,
        color: maxed ? TEXT_COLORS.DIM : canAfford ? '#000000' : '#ff6666',
        backgroundColor: maxed ? '#222233' : canAfford ? '#00ff88' : '#331111',
        padding: { left: 10, right: 10, top: 6, bottom: 6 }
      }).setOrigin(1, 0.5);
      row.add(btn);

      if (canAfford) {
        btn.setInteractive({ useHandCursor: true });
        btn.on('pointerup', () => {
          if (this.resourceManager.spendEnergy(cost)) {
            setOrbitalWeaponLevel(registry, weapon.id, level + 1);
            this.updateEnergy();
            this.renderCategory('orbital');
          }
        });
      }

      this.contentContainer.add(row);
    });

    this.orbitalSectionHeight = 36 + weapons.length * rowHeight;
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
