import Phaser from 'phaser';
import { COLORS, GAME_WIDTH, DEPTH, FONTS, TEXT_COLORS, UI_INSETS } from '../utils/Constants';
import { GameScene } from '../scenes/GameScene';
import { Turret } from '../entities/Turret';
import { DataLoader } from '../systems/DataLoader';
import { ResearchManager } from '../systems/ResearchManager';
import { UpgradeConfig } from '../types/GameData';

export class UpgradeMenu {
  private scene: GameScene;
  private container: Phaser.GameObjects.Container;
  private selectedTurret: Turret | null = null;
  private visible: boolean = false;
  private researchManager: ResearchManager;

  // UI elements
  private panel!: Phaser.GameObjects.Graphics;
  private titleText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private statsText!: Phaser.GameObjects.Text;
  private upgradeButton!: Phaser.GameObjects.Container;
  private sellButton!: Phaser.GameObjects.Container;
  private upgradeList!: Phaser.GameObjects.Container;
  private readonly panelWidth = 210;
  private readonly panelHeight = 440;

  constructor(scene: GameScene) {
    this.scene = scene;
    this.researchManager = new ResearchManager(scene);
    this.container = scene.add.container(GAME_WIDTH - this.panelWidth - 15, UI_INSETS.top + 12);
    this.container.setDepth(DEPTH.UI);
    this.container.setVisible(false);
    // Fix UI to screen (don't move with camera)
    this.container.setScrollFactor(0);

    this.createPanel();
  }

  /** Screen-space rectangle the panel covers, or null when hidden. */
  public getBounds(): Phaser.Geom.Rectangle | null {
    if (!this.visible) return null;
    return new Phaser.Geom.Rectangle(this.container.x, this.container.y, this.panelWidth, this.panelHeight);
  }

  private createPanel(): void {
    const panelWidth = this.panelWidth;
    const panelHeight = this.panelHeight;
    const cutSize = 15;

    // Background with industrial cut corners
    this.panel = this.scene.add.graphics();
    this.panel.fillStyle(COLORS.PANEL_BG, 0.95);
    this.panel.beginPath();
    this.panel.moveTo(cutSize, 0);
    this.panel.lineTo(panelWidth - cutSize, 0);
    this.panel.lineTo(panelWidth, cutSize);
    this.panel.lineTo(panelWidth, panelHeight - cutSize);
    this.panel.lineTo(panelWidth - cutSize, panelHeight);
    this.panel.lineTo(cutSize, panelHeight);
    this.panel.lineTo(0, panelHeight - cutSize);
    this.panel.lineTo(0, cutSize);
    this.panel.closePath();
    this.panel.fillPath();

    // Border
    this.panel.lineStyle(2, COLORS.PRIMARY, 0.8);
    this.panel.strokePath();
    this.container.add(this.panel);

    // Title
    this.titleText = this.scene.add.text(panelWidth / 2, 20, 'TURRET', {
      fontSize: '14px',
      fontFamily: FONTS.HEADER,
      color: TEXT_COLORS.PRIMARY
    }).setOrigin(0.5);
    this.container.add(this.titleText);

    // Level
    this.levelText = this.scene.add.text(panelWidth / 2, 42, 'Level 1', {
      fontSize: '12px',
      fontFamily: FONTS.BODY,
      color: '#00ff88'
    }).setOrigin(0.5);
    this.container.add(this.levelText);

    // Separator line
    const separator = this.scene.add.graphics();
    separator.lineStyle(1, COLORS.PANEL_BORDER, 0.5);
    separator.lineBetween(15, 58, panelWidth - 15, 58);
    this.container.add(separator);

    // Stats
    this.statsText = this.scene.add.text(15, 68, '', {
      fontSize: '11px',
      fontFamily: FONTS.MONO,
      color: TEXT_COLORS.SECONDARY,
      lineSpacing: 5
    });
    this.container.add(this.statsText);

    // Upgrade button
    this.upgradeButton = this.createButton(panelWidth / 2, 212, 'UPGRADE', 0x2a4a2a, () => {
      if (this.selectedTurret && this.selectedTurret.upgrade()) {
        this.updateDisplay();
      }
    });
    this.container.add(this.upgradeButton);

    // Upgrade list container
    this.upgradeList = this.scene.add.container(0, 252);
    this.container.add(this.upgradeList);

    // Sell button
    this.sellButton = this.createButton(panelWidth / 2, panelHeight - 35, 'SELL', 0x4a2a2a, () => {
      if (this.selectedTurret) {
        this.scene.sellTurret(this.selectedTurret);
        this.hide();
      }
    });
    this.container.add(this.sellButton);
  }

  private createButton(x: number, y: number, text: string, bgColor: number, callback: () => void): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y);
    const width = 180;
    const height = 35;
    const cutSize = 6;

    const bgGraphics = this.scene.add.graphics();

    const drawButton = (color: number, borderColor: number = COLORS.PANEL_BORDER) => {
      bgGraphics.clear();
      bgGraphics.fillStyle(color, 1);
      bgGraphics.beginPath();
      bgGraphics.moveTo(-width / 2 + cutSize, -height / 2);
      bgGraphics.lineTo(width / 2, -height / 2);
      bgGraphics.lineTo(width / 2, height / 2 - cutSize);
      bgGraphics.lineTo(width / 2 - cutSize, height / 2);
      bgGraphics.lineTo(-width / 2, height / 2);
      bgGraphics.lineTo(-width / 2, -height / 2 + cutSize);
      bgGraphics.closePath();
      bgGraphics.fillPath();

      bgGraphics.lineStyle(1, borderColor, 1);
      bgGraphics.strokePath();
    };

    drawButton(bgColor);
    container.add(bgGraphics);

    const label = this.scene.add.text(0, 0, text, {
      fontSize: '13px',
      fontFamily: FONTS.HEADER,
      color: '#ffffff'
    }).setOrigin(0.5);
    container.add(label);

    // Hit area
    const hitArea = this.scene.add.rectangle(0, 0, width, height, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    container.add(hitArea);

    hitArea.on('pointerover', () => {
      drawButton(bgColor + 0x222222, COLORS.PRIMARY);
    });
    hitArea.on('pointerout', () => {
      drawButton(bgColor);
    });
    hitArea.on('pointerup', callback);

    container.setData('bgGraphics', bgGraphics);
    container.setData('drawButton', drawButton);
    container.setData('bgColor', bgColor);
    container.setData('label', label);
    container.setData('hitArea', hitArea);

    return container;
  }

  public show(turret: Turret): void {
    this.selectedTurret = turret;
    this.visible = true;
    this.container.setVisible(true);
    this.updateDisplay();
  }

  public hide(): void {
    this.selectedTurret = null;
    this.visible = false;
    this.container.setVisible(false);
  }

  private updateDisplay(): void {
    if (!this.selectedTurret) return;

    const turret = this.selectedTurret;
    const data = turret.getData();

    // Title shows type + callsign so the player knows this isn't an anonymous unit.
    const callsign = turret.identity?.callsign;
    this.titleText.setText(callsign
      ? `${data.name.toUpperCase()} · ${callsign}`
      : data.name.toUpperCase());
    // Shrink long titles so they never spill past the panel edge.
    this.titleText.setScale(1);
    const maxTitleWidth = this.panelWidth - 24;
    if (this.titleText.width > maxTitleWidth) {
      this.titleText.setScale(maxTitleWidth / this.titleText.width);
    }

    // Update level
    const levelColor = turret.level >= data.maxLevel ? '#ffaa00' : '#00ff88';
    this.levelText.setText(`LEVEL ${turret.level}/${data.maxLevel}`);
    this.levelText.setColor(levelColor);

    // Update stats
    const stats = [
      `DMG  ${turret.damage}`,
      `RNG  ${turret.range}`,
      `ROF  ${turret.fireRate.toFixed(1)}/s`,
      `DPS  ${turret.getCurrentDPS().toFixed(1)}`,
      `TYPE ${data.damageType}`
    ];

    if (turret.aoe > 0) stats.push(`AOE  ${turret.aoe}`);
    if (turret.slow > 0) stats.push(`SLOW ${Math.round(turret.slow * 100)}%`);
    if (turret.chainTargets > 0) stats.push(`CHAIN ${turret.chainTargets}`);
    if (turret.piercing) stats.push('PIERCING');
    const tags: string[] = [];
    if (turret.dotDamage > 0) tags.push(`BURN ${turret.dotDamage}`);
    if (turret.homing) tags.push('HOMING');
    if (turret.isFromInventory()) tags.push('ROSTER');
    if (tags.length > 0) stats.push(tags.join('  '));

    if (turret.identity) {
      stats.push(`KILLS ${turret.identity.kills}  DROPS ${turret.identity.dropsSurvived}`);
    }

    this.statsText.setText(stats.join('\n'));

    // Update upgrade button
    this.updateUpgradeButton();

    // Update available upgrades
    this.updateUpgradeList();

    // Update sell button
    this.updateSellButton();
  }

  private updateUpgradeButton(): void {
    if (!this.selectedTurret) return;

    const turret = this.selectedTurret;
    const label = this.upgradeButton.getData('label') as Phaser.GameObjects.Text;
    const drawButton = this.upgradeButton.getData('drawButton') as (color: number, border?: number) => void;

    if (turret.level >= turret.getData().maxLevel) {
      label.setText('MAX LEVEL');
      label.setColor('#ffaa00');
      drawButton(0x3a3a3a);
      this.upgradeButton.setAlpha(0.6);
      return;
    }

    const cost = turret.getUpgradeCost();
    const costSum = Object.values(cost).reduce((a, b) => a + b, 0);
    const canAfford = this.scene.resourceManager.canAfford(cost);

    label.setText(`UPGRADE (${costSum})`);
    label.setColor(canAfford ? '#00ff88' : '#ff4444');
    drawButton(canAfford ? 0x2a4a2a : 0x3a2a2a);
    this.upgradeButton.setAlpha(canAfford ? 1 : 0.6);
  }

  private updateUpgradeList(): void {
    if (!this.selectedTurret) return;

    // Clear existing
    this.upgradeList.removeAll(true);

    const turret = this.selectedTurret;
    const availableUpgrades = DataLoader.getUpgradesForTurret(turret.turretType.toUpperCase(), turret.level);

    // Filter out already applied upgrades
    const newUpgrades = availableUpgrades.filter(u =>
      !turret.appliedUpgrades.includes(u.id) && this.researchManager.isUpgradeUnlocked(u.id)
    );

    // Show up to 2 upgrades
    const displayUpgrades = newUpgrades.slice(0, 2);

    displayUpgrades.forEach((upgrade, index) => {
      const upgradeItem = this.createUpgradeItem(105, index * 55, upgrade);
      this.upgradeList.add(upgradeItem);
    });
  }

  private createUpgradeItem(x: number, y: number, upgrade: UpgradeConfig): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y);
    const width = 180;
    const height = 50;
    const cutSize = 6;

    const bgGraphics = this.scene.add.graphics();
    const bgColor = 0x2a2a4e;

    const drawBg = (color: number, borderColor: number = COLORS.PANEL_BORDER) => {
      bgGraphics.clear();
      bgGraphics.fillStyle(color, 1);
      bgGraphics.beginPath();
      bgGraphics.moveTo(-width / 2 + cutSize, -height / 2);
      bgGraphics.lineTo(width / 2, -height / 2);
      bgGraphics.lineTo(width / 2, height / 2 - cutSize);
      bgGraphics.lineTo(width / 2 - cutSize, height / 2);
      bgGraphics.lineTo(-width / 2, height / 2);
      bgGraphics.lineTo(-width / 2, -height / 2 + cutSize);
      bgGraphics.closePath();
      bgGraphics.fillPath();

      bgGraphics.lineStyle(1, borderColor, 1);
      bgGraphics.strokePath();
    };

    drawBg(bgColor);
    container.add(bgGraphics);

    // Name
    const nameText = this.scene.add.text(-width / 2 + 10, -height / 2 + 8, upgrade.name.toUpperCase(), {
      fontSize: '11px',
      fontFamily: FONTS.HEADER,
      color: TEXT_COLORS.PRIMARY
    });
    container.add(nameText);

    // Description (truncated)
    const desc = upgrade.description.length > 35 ? upgrade.description.substring(0, 32) + '...' : upgrade.description;
    const descText = this.scene.add.text(-width / 2 + 10, -height / 2 + 22, desc, {
      fontSize: '9px',
      fontFamily: FONTS.BODY,
      color: TEXT_COLORS.MUTED
    });
    container.add(descText);

    // Cost
    const costSum = Object.values(upgrade.cost).reduce((a, b) => a + b, 0);
    const canAfford = this.scene.resourceManager.canAfford(upgrade.cost);

    const costText = this.scene.add.text(width / 2 - 10, height / 2 - 10, costSum.toString(), {
      fontSize: '12px',
      fontFamily: FONTS.BODY,
      color: canAfford ? '#00ff88' : '#ff4444'
    }).setOrigin(1);
    container.add(costText);

    // Hit area
    const hitArea = this.scene.add.rectangle(0, 0, width, height, 0xffffff, 0);
    container.add(hitArea);

    // Interactivity
    if (canAfford) {
      hitArea.setInteractive({ useHandCursor: true });

      hitArea.on('pointerover', () => drawBg(0x3a3a5e, COLORS.PRIMARY));
      hitArea.on('pointerout', () => drawBg(bgColor));
      hitArea.on('pointerup', () => {
        if (this.selectedTurret && this.scene.resourceManager.spend(upgrade.cost)) {
          this.selectedTurret.applyUpgrade(upgrade.id);
          this.updateDisplay();
        }
      });
    } else {
      container.setAlpha(0.5);
    }

    this.scene.getCameraManager().addUIObject(container);

    return container;
  }

  private updateSellButton(): void {
    if (!this.selectedTurret) return;

    const sellValue = Object.values(this.selectedTurret.getSellValue()).reduce((a, b) => a + b, 0);
    const label = this.sellButton.getData('label') as Phaser.GameObjects.Text;
    label.setText(`SELL (+${sellValue})`);
  }

  public isVisible(): boolean {
    return this.visible;
  }

  public getSelectedTurret(): Turret | null {
    return this.selectedTurret;
  }

  public getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  public destroy(): void {
    this.selectedTurret = null;
    this.visible = false;
    this.container.destroy();
  }
}
