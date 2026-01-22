import Phaser from 'phaser';
import { COLORS, GAME_WIDTH, DEPTH } from '../utils/Constants';
import { GameScene } from '../scenes/GameScene';
import { Turret } from '../entities/Turret';
import { getUpgradesForTurret, UpgradeData } from '../data/upgrades';

export class UpgradeMenu {
  private scene: GameScene;
  private container: Phaser.GameObjects.Container;
  private selectedTurret: Turret | null = null;
  private visible: boolean = false;

  // UI elements
  private panel!: Phaser.GameObjects.Rectangle;
  private titleText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private statsText!: Phaser.GameObjects.Text;
  private upgradeButton!: Phaser.GameObjects.Container;
  private sellButton!: Phaser.GameObjects.Container;
  private upgradeList!: Phaser.GameObjects.Container;

  constructor(scene: GameScene) {
    this.scene = scene;
    this.container = scene.add.container(GAME_WIDTH - 220, 80);
    this.container.setDepth(DEPTH.UI);
    this.container.setVisible(false);

    this.createPanel();
  }

  private createPanel(): void {
    const panelWidth = 200;
    const panelHeight = 350;

    // Background
    this.panel = this.scene.add.rectangle(panelWidth / 2, panelHeight / 2, panelWidth, panelHeight, COLORS.PANEL_BG, 0.95)
      .setStrokeStyle(2, COLORS.PRIMARY);
    this.container.add(this.panel);

    // Title
    this.titleText = this.scene.add.text(panelWidth / 2, 15, 'TURRET', {
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    this.container.add(this.titleText);

    // Level
    this.levelText = this.scene.add.text(panelWidth / 2, 38, 'Level 1', {
      fontSize: '14px',
      color: '#00ff88'
    }).setOrigin(0.5);
    this.container.add(this.levelText);

    // Stats
    this.statsText = this.scene.add.text(15, 60, '', {
      fontSize: '12px',
      color: '#aaaaaa',
      lineSpacing: 4
    });
    this.container.add(this.statsText);

    // Upgrade button
    this.upgradeButton = this.createButton(panelWidth / 2, 170, 'UPGRADE', 0x2a4a2a, () => {
      if (this.selectedTurret) {
        this.selectedTurret.upgrade();
        this.updateDisplay();
      }
    });
    this.container.add(this.upgradeButton);

    // Upgrade list container
    this.upgradeList = this.scene.add.container(0, 210);
    this.container.add(this.upgradeList);

    // Sell button
    this.sellButton = this.createButton(panelWidth / 2, panelHeight - 30, 'SELL', 0x4a2a2a, () => {
      if (this.selectedTurret) {
        this.selectedTurret.sell();
        this.hide();
      }
    });
    this.container.add(this.sellButton);
  }

  private createButton(x: number, y: number, text: string, bgColor: number, callback: () => void): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y);
    const width = 170;
    const height = 35;

    const bg = this.scene.add.rectangle(0, 0, width, height, bgColor)
      .setStrokeStyle(1, COLORS.PANEL_BORDER)
      .setInteractive({ useHandCursor: true });
    container.add(bg);

    const label = this.scene.add.text(0, 0, text, {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    container.add(label);

    bg.on('pointerover', () => {
      bg.setFillStyle(bgColor + 0x111111);
    });
    bg.on('pointerout', () => {
      bg.setFillStyle(bgColor);
    });
    bg.on('pointerup', callback);

    container.setData('bg', bg);
    container.setData('label', label);

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

    // Update title
    this.titleText.setText(data.name.toUpperCase());

    // Update level
    this.levelText.setText(`Level ${turret.level}/${data.maxLevel}`);

    // Update stats
    const stats = [
      `Damage: ${turret.damage}`,
      `Range: ${turret.range}`,
      `Fire Rate: ${turret.fireRate.toFixed(1)}/s`,
      `DPS: ${turret.getCurrentDPS().toFixed(1)}`,
      `Type: ${data.damageType}`
    ];

    if (turret.aoe > 0) stats.push(`AOE: ${turret.aoe}`);
    if (turret.slow > 0) stats.push(`Slow: ${Math.round(turret.slow * 100)}%`);
    if (turret.chainTargets > 0) stats.push(`Chain: ${turret.chainTargets}`);
    if (turret.piercing) stats.push('Piercing');

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
    const bg = this.upgradeButton.getData('bg') as Phaser.GameObjects.Rectangle;

    if (turret.level >= turret.getData().maxLevel) {
      label.setText('MAX LEVEL');
      bg.setFillStyle(0x333333);
      bg.removeInteractive();
      return;
    }

    const cost = turret.getUpgradeCost();
    const costSum = Object.values(cost).reduce((a, b) => a + b, 0);
    const canAfford = this.scene.resourceManager.canAfford(cost);

    label.setText(`UPGRADE (${costSum})`);
    label.setColor(canAfford ? '#00ff88' : '#ff4444');
    bg.setFillStyle(canAfford ? 0x2a4a2a : 0x4a2a2a);

    if (canAfford) {
      bg.setInteractive({ useHandCursor: true });
    } else {
      bg.removeInteractive();
    }
  }

  private updateUpgradeList(): void {
    if (!this.selectedTurret) return;

    // Clear existing
    this.upgradeList.removeAll(true);

    const turret = this.selectedTurret;
    const availableUpgrades = getUpgradesForTurret(turret.turretType, turret.level);

    // Filter out already applied upgrades
    const newUpgrades = availableUpgrades.filter(u => !turret.appliedUpgrades.includes(u.id));

    // Show up to 2 upgrades
    const displayUpgrades = newUpgrades.slice(0, 2);

    displayUpgrades.forEach((upgrade, index) => {
      const upgradeItem = this.createUpgradeItem(100, index * 50, upgrade);
      this.upgradeList.add(upgradeItem);
    });
  }

  private createUpgradeItem(x: number, y: number, upgrade: UpgradeData): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y);
    const width = 170;
    const height = 45;

    const bg = this.scene.add.rectangle(0, 0, width, height, 0x2a2a4e)
      .setStrokeStyle(1, COLORS.PANEL_BORDER);
    container.add(bg);

    // Name
    const nameText = this.scene.add.text(-width / 2 + 8, -height / 2 + 5, upgrade.name, {
      fontSize: '11px',
      color: '#ffffff',
      fontStyle: 'bold'
    });
    container.add(nameText);

    // Description (truncated)
    const desc = upgrade.description.length > 30 ? upgrade.description.substring(0, 27) + '...' : upgrade.description;
    const descText = this.scene.add.text(-width / 2 + 8, -height / 2 + 18, desc, {
      fontSize: '9px',
      color: '#888888'
    });
    container.add(descText);

    // Cost
    const costSum = Object.values(upgrade.cost).reduce((a, b) => a + b, 0);
    const canAfford = this.scene.resourceManager.canAfford(upgrade.cost);

    const costText = this.scene.add.text(width / 2 - 8, height / 2 - 8, costSum.toString(), {
      fontSize: '11px',
      color: canAfford ? '#00ff88' : '#ff4444'
    }).setOrigin(1);
    container.add(costText);

    // Interactivity
    if (canAfford) {
      bg.setInteractive({ useHandCursor: true });

      bg.on('pointerover', () => bg.setFillStyle(0x3a3a5e));
      bg.on('pointerout', () => bg.setFillStyle(0x2a2a4e));
      bg.on('pointerup', () => {
        if (this.selectedTurret && this.scene.resourceManager.canAfford(upgrade.cost)) {
          this.scene.resourceManager.spend(upgrade.cost);
          this.selectedTurret.applyUpgrade(upgrade.id, upgrade.effect);
          this.updateDisplay();
        }
      });
    } else {
      container.setAlpha(0.5);
    }

    return container;
  }

  private updateSellButton(): void {
    if (!this.selectedTurret) return;

    const turret = this.selectedTurret;
    const data = turret.getData();

    // Calculate sell value (50% of total investment)
    let totalCost = 0;
    Object.values(data.cost).forEach(v => totalCost += v);
    for (let i = 0; i < turret.level - 1; i++) {
      const upgradeCost = data.upgradeCosts[i];
      if (upgradeCost) {
        Object.values(upgradeCost).forEach(v => totalCost += v);
      }
    }
    const sellValue = Math.floor(totalCost * 0.5);

    const label = this.sellButton.getData('label') as Phaser.GameObjects.Text;
    label.setText(`SELL (+${sellValue})`);
  }

  public isVisible(): boolean {
    return this.visible;
  }

  public getSelectedTurret(): Turret | null {
    return this.selectedTurret;
  }

  public destroy(): void {
    this.container.destroy();
  }
}
