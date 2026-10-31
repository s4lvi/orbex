import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FONTS, TEXT_COLORS } from '../utils/Constants';
import { ResearchManager } from '../systems/ResearchManager';
import { ResourceManager } from '../systems/ResourceManager';
import { ResearchNode, ResearchCategory } from '../types/GameData';
import { OrbitalWeaponType, getOrbitalWeaponData, getOrbitalUpgradeCost, getScaledOrbitalWeaponStats } from '../data/orbitalWeapons';
import { getOrbitalWeaponLevel, setOrbitalWeaponLevel } from '../systems/OrbitalWeaponState';
import { DataLoader } from '../systems/DataLoader';

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
  private dialogContainer: Phaser.GameObjects.Container | null = null;

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

    // Every node opens an info dialog; only researchable ones highlight on hover.
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerup', () => this.showNodeDialog(node));

    if (canResearch && !isCompleted) {
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

  // ------------------------------------------------------------ node dialog

  private closeDialog(): void {
    if (this.dialogContainer) {
      this.dialogContainer.destroy();
      this.dialogContainer = null;
    }
  }

  /**
   * Info box for a research node: what it unlocks (with the unlocked item's
   * stats), prerequisites if locked, cost, and RESEARCH / CANCEL buttons.
   */
  private showNodeDialog(node: ResearchNode): void {
    this.closeDialog();

    const isCompleted = this.researchManager.isResearchCompleted(node.id);
    const canResearch = this.researchManager.canResearch(node.id);
    const canAfford = this.resourceManager.canAffordEnergy(node.energyCost);
    const width = 600;
    const pad = 24;
    const innerWidth = width - pad * 2;

    const dialog = this.scene.add.container(0, 0);
    this.dialogContainer = dialog;

    // Shade blocks the panel underneath; clicking it dismisses the dialog.
    const shade = this.scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.65);
    shade.setInteractive();
    shade.on('pointerup', () => this.closeDialog());
    dialog.add(shade);

    const body = this.scene.add.container(0, 0);
    let y = pad;
    const addText = (text: string, style: Phaser.Types.GameObjects.Text.TextStyle, gap = 6): void => {
      const t = this.scene.add.text(pad, y, text, { wordWrap: { width: innerWidth }, ...style });
      body.add(t);
      y += t.height + gap;
    };

    addText(node.name, { fontSize: '22px', fontFamily: FONTS.HEADER, color: isCompleted ? '#00ff88' : '#ffffff' }, 2);
    addText(`${node.category.toUpperCase()}  ·  TIER ${node.tier}`, { fontSize: '12px', fontFamily: FONTS.BODY, color: TEXT_COLORS.DIM }, 12);
    addText(node.description, { fontSize: '14px', fontFamily: FONTS.BODY, color: TEXT_COLORS.SECONDARY, lineSpacing: 3 }, 14);

    const unlocks = this.describeUnlocks(node);
    if (unlocks.length > 0) {
      addText('UNLOCKS', { fontSize: '13px', fontFamily: FONTS.HEADER, color: '#00ff88' }, 4);
      unlocks.forEach(([title, detail]) => {
        addText(title, { fontSize: '14px', fontFamily: FONTS.HEADER, color: '#ffffff' }, 1);
        addText(detail, { fontSize: '12px', fontFamily: FONTS.MONO, color: TEXT_COLORS.MUTED, lineSpacing: 2 }, 10);
      });
    }

    if (!isCompleted && !canResearch) {
      const missing = node.prerequisites
        .filter(id => !this.researchManager.isResearchCompleted(id))
        .map(id => DataLoader.getResearchNode(id)?.name || id);
      addText(`REQUIRES: ${missing.join(', ')}`, { fontSize: '12px', fontFamily: FONTS.BODY, color: '#ff6666' }, 10);
    }

    const have = this.resourceManager.getEnergy();
    addText(
      isCompleted ? 'ALREADY RESEARCHED' : `COST  ${node.energyCost} ENERGY     (you have ${have})`,
      { fontSize: '14px', fontFamily: FONTS.HEADER, color: isCompleted ? '#00ff88' : canAfford ? '#00ffff' : '#ff4444' },
      18
    );

    const btnY = y + 20;
    const makeButton = (x: number, label: string, enabled: boolean, fill: string, textColor: string, onClick: () => void): void => {
      const b = this.scene.add.text(x, btnY, label, {
        fontSize: '15px',
        fontFamily: FONTS.HEADER,
        color: textColor,
        backgroundColor: fill,
        padding: { left: 22, right: 22, top: 10, bottom: 10 }
      }).setOrigin(0.5);
      if (enabled) {
        b.setInteractive({ useHandCursor: true });
        b.on('pointerup', onClick);
      } else {
        b.setAlpha(0.7);
      }
      body.add(b);
    };

    if (isCompleted) {
      makeButton(width / 2, 'CLOSE', true, '#2a2a4e', '#ffffff', () => this.closeDialog());
    } else {
      const researchEnabled = canResearch && canAfford;
      const researchLabel = !canResearch ? 'LOCKED' : !canAfford ? 'NOT ENOUGH ENERGY' : 'RESEARCH';
      makeButton(width * 0.28, 'CANCEL', true, '#2a2a4e', '#ffffff', () => this.closeDialog());
      makeButton(width * 0.68, researchLabel, researchEnabled,
        researchEnabled ? '#00ff88' : '#331111',
        researchEnabled ? '#000000' : '#ff6666',
        () => {
          this.closeDialog();
          this.attemptResearch(node);
        });
    }

    const height = btnY + 44;
    const box = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x12122a, 1).setStrokeStyle(2, 0x00ff88);
    const frame = this.scene.add.container(GAME_WIDTH / 2 - width / 2, Math.max(40, GAME_HEIGHT / 2 - height / 2), [box, body]);
    dialog.add(frame);
    this.container.add(dialog);
  }

  /** [title, detail] pairs describing each item a node unlocks. */
  private describeUnlocks(node: ResearchNode): Array<[string, string]> {
    const out: Array<[string, string]> = [];

    (node.unlocks.turrets || []).forEach(id => {
      const t = DataLoader.getTurret(id);
      if (!t) return;
      out.push([
        `Turret: ${t.name}`,
        `${t.description}\nDMG ${t.damage} ${t.damageType}  ·  RANGE ${t.range}  ·  ${t.fireRate}/s  ·  cost ${DataLoader.formatCost(t.cost)}`
      ]);
    });

    (node.unlocks.traps || []).forEach(id => {
      const t = DataLoader.getTrap(id);
      if (!t) return;
      out.push([`Trap: ${t.name}`, `${t.description}\ncost ${DataLoader.formatCost(t.cost)}`]);
    });

    (node.unlocks.upgrades || []).forEach(id => {
      const u = DataLoader.getUpgradeById(id);
      if (!u) return;
      const scope = u.turretTypes && u.turretTypes.length > 0
        ? u.turretTypes.map(t => DataLoader.getTurret(t)?.name || t).join(', ')
        : 'all turrets';
      out.push([
        `Upgrade: ${u.name}`,
        `${u.description}\nfor ${scope}  ·  turret Lv ${u.requiredLevel}+  ·  cost ${DataLoader.formatCost(u.cost)}`
      ]);
    });

    (node.unlocks.orbital || []).forEach(id => {
      const w = getOrbitalWeaponData(id as OrbitalWeaponType);
      if (!w) return;
      out.push([
        `Orbital: ${w.name}`,
        `${w.description}\nDMG ${w.damage}  ·  CD ${(w.cooldown / 1000).toFixed(1)}s  ·  AOE ${w.aoeRadius || '-'}  ·  ${w.energyCost} energy per shot`
      ]);
    });

    return out;
  }

  public updateEnergy(): void {
    this.energyText.setText(this.resourceManager.getEnergy().toString());
  }

  public destroy(): void {
    this.container.destroy();
  }
}
