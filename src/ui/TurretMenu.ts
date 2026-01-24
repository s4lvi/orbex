import Phaser from 'phaser';
import { COLORS, GAME_WIDTH, GAME_HEIGHT, DEPTH, TurretType, TrapType } from '../utils/Constants';
import { GameScene } from '../scenes/GameScene';
import { DataLoader } from '../systems/DataLoader';
import { ResearchManager } from '../systems/ResearchManager';
import { TurretConfig, TrapConfig } from '../types/GameData';

export class TurretMenu {
  private scene: GameScene;
  private container: Phaser.GameObjects.Container;
  private turretButtons: Map<string, Phaser.GameObjects.Container> = new Map();
  private trapButtons: Map<string, Phaser.GameObjects.Container> = new Map();
  private selectedType: string | null = null;
  private tooltip: Phaser.GameObjects.Container | null = null;
  private hotkeyBindings: string[] = [];
  private researchManager: ResearchManager;

  constructor(scene: GameScene) {
    this.scene = scene;
    this.researchManager = new ResearchManager(scene);
    this.container = scene.add.container(0, GAME_HEIGHT - 120);
    this.container.setDepth(DEPTH.UI);

    this.createMenu();
  }

  private createMenu(): void {
    // Background panel
    const panelWidth = GAME_WIDTH;
    const panelHeight = 110;

    const bg = this.scene.add.rectangle(panelWidth / 2, panelHeight / 2, panelWidth, panelHeight, COLORS.PANEL_BG, 0.95);
    bg.setStrokeStyle(2, COLORS.PANEL_BORDER);
    this.container.add(bg);

    // Title
    const title = this.scene.add.text(15, 8, 'BUILD', {
      fontSize: '14px',
      color: '#888888',
      fontStyle: 'bold'
    });
    this.container.add(title);

    // Turret buttons - smaller for portrait mode
    let buttonX = 10;
    const buttonY = 50;
    const buttonSize = 45;
    const spacing = 6;

    // Create turret buttons from DataLoader
    const turrets = DataLoader.getAllTurrets();
    let hotkeyIndex = 1;
    turrets.forEach((turret) => {
      const isUnlocked = this.researchManager.isTurretUnlocked(turret.id);
      const button = this.createTurretButton(buttonX, buttonY, turret, hotkeyIndex, isUnlocked);
      this.turretButtons.set(turret.id, button);
      this.container.add(button);
      buttonX += buttonSize + spacing;
      hotkeyIndex++;
    });

    // Separator
    buttonX += 10;
    const separator = this.scene.add.rectangle(buttonX, buttonY, 2, buttonSize, COLORS.PANEL_BORDER);
    this.container.add(separator);
    buttonX += 10;

    // Trap section title
    const trapTitle = this.scene.add.text(buttonX, 8, 'TRAPS', {
      fontSize: '14px',
      color: '#888888',
      fontStyle: 'bold'
    });
    this.container.add(trapTitle);

    // Create trap buttons from DataLoader
    const traps = DataLoader.getAllTraps();
    traps.forEach((trap) => {
      const isUnlocked = this.researchManager.isTrapUnlocked(trap.id);
      const button = this.createTrapButton(buttonX, buttonY, trap, isUnlocked);
      this.trapButtons.set(trap.id, button);
      this.container.add(button);
      buttonX += buttonSize + spacing;
    });

    // Cancel button (after traps)
    buttonX += 10;
    const cancelButton = this.createCancelButton(buttonX, buttonY);
    this.container.add(cancelButton);

    // Update affordability
    this.scene.events.on('resourcesChanged', this.updateAffordability, this);
    this.updateAffordability();
  }

  private createTurretButton(
    x: number,
    y: number,
    turret: TurretConfig,
    hotkeyIndex: number,
    isUnlocked: boolean
  ): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y);
    const size = 45;

    // Background
    const bgColor = isUnlocked ? 0x2a2a4e : 0x1a1a2e;
    const bg = this.scene.add.rectangle(size / 2, size / 2, size, size, bgColor)
      .setStrokeStyle(2, isUnlocked ? COLORS.PANEL_BORDER : 0x333344);
    container.add(bg);

    // Icon
    const icon = this.scene.add.sprite(size / 2, size / 2 - 5, `turret-${turret.id.toLowerCase()}`);
    icon.setScale(0.8);
    if (!isUnlocked) {
      icon.setTint(0x444444);
    }
    container.add(icon);

    if (isUnlocked) {
      // Cost text
      const cost = Object.values(turret.cost).reduce((a, b) => a + b, 0);
      const costText = this.scene.add.text(size / 2, size - 8, cost.toString(), {
        fontSize: '12px',
        color: '#aaaaaa'
      }).setOrigin(0.5);
      container.add(costText);
      container.setData('costText', costText);
    } else {
      // Lock icon
      const lockText = this.scene.add.text(size / 2, size - 8, '🔒', {
        fontSize: '12px'
      }).setOrigin(0.5);
      container.add(lockText);
    }

    // Hotkey
    const hotkeyText = this.scene.add.text(5, 3, hotkeyIndex.toString(), {
      fontSize: '10px',
      color: isUnlocked ? '#666666' : '#333333'
    });
    container.add(hotkeyText);

    // Interactivity
    bg.setInteractive({ useHandCursor: isUnlocked });

    bg.on('pointerover', () => {
      if (isUnlocked && this.scene.resourceManager.canAfford(turret.cost)) {
        bg.setFillStyle(0x3a3a5e);
      }
      this.showTooltip(x, y - 100, turret, isUnlocked);
    });

    bg.on('pointerout', () => {
      bg.setFillStyle(bgColor);
      this.hideTooltip();
    });

    bg.on('pointerup', () => {
      if (isUnlocked && this.scene.resourceManager.canAfford(turret.cost)) {
        this.selectTurret(turret.id);
      }
    });

    // Store reference for affordability updates
    container.setData('turretData', turret);
    container.setData('bg', bg);
    container.setData('isUnlocked', isUnlocked);

    // Setup hotkey and track for cleanup
    if (isUnlocked) {
      const hotkeyEvent = `keydown-${hotkeyIndex}`;
      this.hotkeyBindings.push(hotkeyEvent);
      this.scene.input.keyboard?.on(hotkeyEvent, () => {
        if (this.scene.resourceManager.canAfford(turret.cost)) {
          this.selectTurret(turret.id);
        }
      });
    }

    return container;
  }

  private createTrapButton(
    x: number,
    y: number,
    trap: TrapConfig,
    isUnlocked: boolean
  ): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y);
    const size = 45;

    // Background
    const bgColor = isUnlocked ? 0x2a2a4e : 0x1a1a2e;
    const bg = this.scene.add.rectangle(size / 2, size / 2, size, size, bgColor)
      .setStrokeStyle(2, isUnlocked ? COLORS.PANEL_BORDER : 0x333344);
    container.add(bg);

    // Icon
    const icon = this.scene.add.sprite(size / 2, size / 2 - 5, `trap-${trap.id.toLowerCase()}`);
    icon.setScale(0.8);
    if (!isUnlocked) {
      icon.setTint(0x444444);
    }
    container.add(icon);

    if (isUnlocked) {
      // Cost text
      const cost = Object.values(trap.cost).reduce((a, b) => a + b, 0);
      const costText = this.scene.add.text(size / 2, size - 8, cost.toString(), {
        fontSize: '12px',
        color: '#aaaaaa'
      }).setOrigin(0.5);
      container.add(costText);
      container.setData('costText', costText);
    } else {
      // Lock icon
      const lockText = this.scene.add.text(size / 2, size - 8, '🔒', {
        fontSize: '12px'
      }).setOrigin(0.5);
      container.add(lockText);
    }

    // Interactivity
    bg.setInteractive({ useHandCursor: isUnlocked });

    bg.on('pointerover', () => {
      if (isUnlocked && this.scene.resourceManager.canAfford(trap.cost)) {
        bg.setFillStyle(0x3a3a5e);
      }
      this.showTrapTooltip(x, y - 100, trap, isUnlocked);
    });

    bg.on('pointerout', () => {
      bg.setFillStyle(bgColor);
      this.hideTooltip();
    });

    bg.on('pointerup', () => {
      if (isUnlocked && this.scene.resourceManager.canAfford(trap.cost)) {
        this.selectTrap(trap.id);
      }
    });

    // Store reference
    container.setData('trapData', trap);
    container.setData('bg', bg);
    container.setData('isUnlocked', isUnlocked);

    return container;
  }

  private createCancelButton(x: number, y: number): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y);
    const size = 45;

    const bg = this.scene.add.rectangle(size / 2, size / 2, size, size, 0x4a2a2a)
      .setStrokeStyle(2, 0x884444);
    container.add(bg);

    const text = this.scene.add.text(size / 2, size / 2, 'ESC', {
      fontSize: '16px',
      color: '#ff6666'
    }).setOrigin(0.5);
    container.add(text);

    bg.setInteractive({ useHandCursor: true });

    bg.on('pointerover', () => bg.setFillStyle(0x5a3a3a));
    bg.on('pointerout', () => bg.setFillStyle(0x4a2a2a));
    bg.on('pointerup', () => {
      this.scene.cancelPlacement();
      this.selectedType = null;
      this.updateSelection();
    });

    return container;
  }

  private selectTurret(turretId: string): void {
    this.selectedType = turretId;
    // Convert ID to TurretType enum
    const turretType = turretId.toLowerCase() as TurretType;
    this.scene.startPlacingTurret(turretType);
    this.updateSelection();
  }

  private selectTrap(trapId: string): void {
    this.selectedType = trapId;
    // Convert ID to TrapType enum
    const trapType = trapId.toLowerCase() as TrapType;
    this.scene.startPlacingTrap(trapType);
    this.updateSelection();
  }

  private updateSelection(): void {
    // Update turret button appearances
    this.turretButtons.forEach((button, id) => {
      const bg = button.getData('bg') as Phaser.GameObjects.Rectangle;
      const isUnlocked = button.getData('isUnlocked') as boolean;
      if (id === this.selectedType) {
        bg.setStrokeStyle(3, COLORS.PRIMARY);
      } else {
        bg.setStrokeStyle(2, isUnlocked ? COLORS.PANEL_BORDER : 0x333344);
      }
    });

    // Update trap button appearances
    this.trapButtons.forEach((button, id) => {
      const bg = button.getData('bg') as Phaser.GameObjects.Rectangle;
      const isUnlocked = button.getData('isUnlocked') as boolean;
      if (id === this.selectedType) {
        bg.setStrokeStyle(3, COLORS.PRIMARY);
      } else {
        bg.setStrokeStyle(2, isUnlocked ? COLORS.PANEL_BORDER : 0x333344);
      }
    });
  }

  private updateAffordability(): void {
    // Update turret buttons
    this.turretButtons.forEach((button) => {
      const turret = button.getData('turretData') as TurretConfig;
      const costText = button.getData('costText') as Phaser.GameObjects.Text | undefined;
      const isUnlocked = button.getData('isUnlocked') as boolean;

      if (!isUnlocked || !costText) return;

      const canAfford = this.scene.resourceManager.canAfford(turret.cost);
      costText.setColor(canAfford ? '#00ff88' : '#ff4444');
      button.setAlpha(canAfford ? 1 : 0.5);
    });

    // Update trap buttons
    this.trapButtons.forEach((button) => {
      const trap = button.getData('trapData') as TrapConfig;
      const costText = button.getData('costText') as Phaser.GameObjects.Text | undefined;
      const isUnlocked = button.getData('isUnlocked') as boolean;

      if (!isUnlocked || !costText) return;

      const canAfford = this.scene.resourceManager.canAfford(trap.cost);
      costText.setColor(canAfford ? '#00ff88' : '#ff4444');
      button.setAlpha(canAfford ? 1 : 0.5);
    });
  }

  private showTooltip(x: number, y: number, turret: TurretConfig, isUnlocked: boolean): void {
    this.hideTooltip();

    const worldX = x;
    const worldY = (GAME_HEIGHT - 120) + y;

    this.tooltip = this.scene.add.container(worldX, worldY);
    this.tooltip.setDepth(DEPTH.UI + 10);

    const padding = 10;
    const width = 200;

    // Build cost string
    const costStr = Object.entries(turret.cost)
      .map(([key, val]) => `${val} ${key}`)
      .join(', ');

    // Background
    const bg = this.scene.add.rectangle(0, 0, width, 100, COLORS.PANEL_BG, 0.95)
      .setStrokeStyle(1, COLORS.PANEL_BORDER)
      .setOrigin(0, 0);
    this.tooltip.add(bg);

    // Title
    const titleText = this.scene.add.text(padding, padding, turret.name, {
      fontSize: '14px',
      color: isUnlocked ? '#ffffff' : '#ff4444',
      fontStyle: 'bold'
    });
    this.tooltip.add(titleText);

    // Description
    const descText = this.scene.add.text(padding, padding + 20, turret.description, {
      fontSize: '11px',
      color: '#aaaaaa',
      wordWrap: { width: width - padding * 2 }
    });
    this.tooltip.add(descText);

    if (isUnlocked) {
      // Cost
      const costTextObj = this.scene.add.text(padding, padding + 20 + descText.height + 5, `Cost: ${costStr}`, {
        fontSize: '11px',
        color: '#00ff88'
      });
      this.tooltip.add(costTextObj);
      // Resize background
      const totalHeight = padding * 2 + 20 + descText.height + 5 + costTextObj.height;
      bg.setSize(width, totalHeight);
    } else {
      // Show research requirement
      const research = this.researchManager.getResearchForTurret(turret.id);
      const reqText = research
        ? `Requires: ${research.name}`
        : 'Locked';
      const reqTextObj = this.scene.add.text(padding, padding + 20 + descText.height + 5, reqText, {
        fontSize: '11px',
        color: '#ff4444'
      });
      this.tooltip.add(reqTextObj);
      const totalHeight = padding * 2 + 20 + descText.height + 5 + reqTextObj.height;
      bg.setSize(width, totalHeight);
    }
  }

  private showTrapTooltip(x: number, y: number, trap: TrapConfig, isUnlocked: boolean): void {
    this.hideTooltip();

    const worldX = x;
    const worldY = (GAME_HEIGHT - 120) + y;

    this.tooltip = this.scene.add.container(worldX, worldY);
    this.tooltip.setDepth(DEPTH.UI + 10);

    const padding = 10;
    const width = 200;

    // Build cost string
    const costStr = Object.entries(trap.cost)
      .map(([key, val]) => `${val} ${key}`)
      .join(', ');

    // Background
    const bg = this.scene.add.rectangle(0, 0, width, 100, COLORS.PANEL_BG, 0.95)
      .setStrokeStyle(1, COLORS.PANEL_BORDER)
      .setOrigin(0, 0);
    this.tooltip.add(bg);

    // Title
    const titleText = this.scene.add.text(padding, padding, trap.name, {
      fontSize: '14px',
      color: isUnlocked ? '#ffffff' : '#ff4444',
      fontStyle: 'bold'
    });
    this.tooltip.add(titleText);

    // Description
    const descText = this.scene.add.text(padding, padding + 20, trap.description, {
      fontSize: '11px',
      color: '#aaaaaa',
      wordWrap: { width: width - padding * 2 }
    });
    this.tooltip.add(descText);

    if (isUnlocked) {
      // Cost
      const costTextObj = this.scene.add.text(padding, padding + 20 + descText.height + 5, `Cost: ${costStr}`, {
        fontSize: '11px',
        color: '#00ff88'
      });
      this.tooltip.add(costTextObj);
      const totalHeight = padding * 2 + 20 + descText.height + 5 + costTextObj.height;
      bg.setSize(width, totalHeight);
    } else {
      // Show research requirement
      const research = this.researchManager.getResearchForTrap(trap.id);
      const reqText = research
        ? `Requires: ${research.name}`
        : 'Locked';
      const reqTextObj = this.scene.add.text(padding, padding + 20 + descText.height + 5, reqText, {
        fontSize: '11px',
        color: '#ff4444'
      });
      this.tooltip.add(reqTextObj);
      const totalHeight = padding * 2 + 20 + descText.height + 5 + reqTextObj.height;
      bg.setSize(width, totalHeight);
    }
  }

  private hideTooltip(): void {
    if (this.tooltip) {
      this.tooltip.destroy();
      this.tooltip = null;
    }
  }

  public getTurretCost(type: TurretType): { [key: string]: number } {
    const turret = DataLoader.getTurretByType(type);
    return turret?.cost || {};
  }

  public getTrapCost(type: TrapType): { [key: string]: number } {
    const trap = DataLoader.getTrapByType(type);
    return trap?.cost || {};
  }

  public destroy(): void {
    // Clean up event listeners
    this.scene.events.off('resourcesChanged', this.updateAffordability, this);

    // Clean up keyboard hotkey bindings
    this.hotkeyBindings.forEach(hotkeyEvent => {
      this.scene.input.keyboard?.off(hotkeyEvent);
    });
    this.hotkeyBindings = [];

    this.hideTooltip();
    this.container.destroy();
  }
}
