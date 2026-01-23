import Phaser from 'phaser';
import { COLORS, GAME_WIDTH, GAME_HEIGHT, DEPTH, TurretType, TrapType } from '../utils/Constants';
import { GameScene } from '../scenes/GameScene';
import { TURRETS, TurretData } from '../data/turrets';
import { TRAPS, TrapData } from '../data/traps';

export class TurretMenu {
  private scene: GameScene;
  private container: Phaser.GameObjects.Container;
  private turretButtons: Map<TurretType, Phaser.GameObjects.Container> = new Map();
  private trapButtons: Map<TrapType, Phaser.GameObjects.Container> = new Map();
  private selectedType: TurretType | TrapType | null = null;
  private tooltip: Phaser.GameObjects.Container | null = null;
  private hotkeyBindings: string[] = []; // Track hotkey bindings for cleanup

  constructor(scene: GameScene) {
    this.scene = scene;
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

    // Create turret buttons
    Object.values(TURRETS).forEach((turret) => {
      const button = this.createTurretButton(buttonX, buttonY, turret);
      this.turretButtons.set(turret.type, button);
      this.container.add(button);
      buttonX += buttonSize + spacing;
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

    // Create trap buttons
    Object.values(TRAPS).forEach((trap) => {
      const button = this.createTrapButton(buttonX, buttonY, trap);
      this.trapButtons.set(trap.type, button);
      this.container.add(button);
      buttonX += buttonSize + spacing;
    });

    // Cancel button (after traps)
    buttonX += 10; // Add small gap
    const cancelButton = this.createCancelButton(buttonX, buttonY);
    this.container.add(cancelButton);

    // Update affordability
    this.scene.events.on('resourcesChanged', this.updateAffordability, this);
    this.updateAffordability();
  }

  private createTurretButton(x: number, y: number, turret: TurretData): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y);
    const size = 45;

    // Background
    const bg = this.scene.add.rectangle(size / 2, size / 2, size, size, 0x2a2a4e)
      .setStrokeStyle(2, COLORS.PANEL_BORDER);
    container.add(bg);

    // Icon
    const icon = this.scene.add.sprite(size / 2, size / 2 - 5, `turret-${turret.type}`);
    icon.setScale(0.8);
    container.add(icon);

    // Cost text
    const cost = Object.values(turret.cost).reduce((a, b) => a + b, 0);
    const costText = this.scene.add.text(size / 2, size - 8, cost.toString(), {
      fontSize: '12px',
      color: '#aaaaaa'
    }).setOrigin(0.5);
    container.add(costText);

    // Hotkey
    const hotkeyIndex = Object.keys(TURRETS).indexOf(turret.type) + 1;
    const hotkeyText = this.scene.add.text(5, 3, hotkeyIndex.toString(), {
      fontSize: '10px',
      color: '#666666'
    });
    container.add(hotkeyText);

    // Interactivity
    bg.setInteractive({ useHandCursor: true });

    bg.on('pointerover', () => {
      if (this.scene.resourceManager.canAfford(turret.cost)) {
        bg.setFillStyle(0x3a3a5e);
      }
      this.showTooltip(x, y - 100, turret.name, turret.description, turret.cost);
    });

    bg.on('pointerout', () => {
      bg.setFillStyle(0x2a2a4e);
      this.hideTooltip();
    });

    bg.on('pointerup', () => {
      if (this.scene.resourceManager.canAfford(turret.cost)) {
        this.selectTurret(turret.type);
      }
    });

    // Store reference for affordability updates
    container.setData('turretData', turret);
    container.setData('bg', bg);
    container.setData('costText', costText);

    // Setup hotkey and track for cleanup
    const hotkeyEvent = `keydown-${hotkeyIndex}`;
    this.hotkeyBindings.push(hotkeyEvent);
    this.scene.input.keyboard?.on(hotkeyEvent, () => {
      if (this.scene.resourceManager.canAfford(turret.cost)) {
        this.selectTurret(turret.type);
      }
    });

    return container;
  }

  private createTrapButton(x: number, y: number, trap: TrapData): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y);
    const size = 45;

    // Background
    const bg = this.scene.add.rectangle(size / 2, size / 2, size, size, 0x2a2a4e)
      .setStrokeStyle(2, COLORS.PANEL_BORDER);
    container.add(bg);

    // Icon
    const icon = this.scene.add.sprite(size / 2, size / 2 - 5, `trap-${trap.type}`);
    icon.setScale(0.8);
    container.add(icon);

    // Cost text
    const cost = Object.values(trap.cost).reduce((a, b) => a + b, 0);
    const costText = this.scene.add.text(size / 2, size - 8, cost.toString(), {
      fontSize: '12px',
      color: '#aaaaaa'
    }).setOrigin(0.5);
    container.add(costText);

    // Interactivity
    bg.setInteractive({ useHandCursor: true });

    bg.on('pointerover', () => {
      if (this.scene.resourceManager.canAfford(trap.cost)) {
        bg.setFillStyle(0x3a3a5e);
      }
      this.showTooltip(x, y - 100, trap.name, trap.description, trap.cost);
    });

    bg.on('pointerout', () => {
      bg.setFillStyle(0x2a2a4e);
      this.hideTooltip();
    });

    bg.on('pointerup', () => {
      if (this.scene.resourceManager.canAfford(trap.cost)) {
        this.selectTrap(trap.type);
      }
    });

    // Store reference
    container.setData('trapData', trap);
    container.setData('bg', bg);
    container.setData('costText', costText);

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

  private selectTurret(type: TurretType): void {
    this.selectedType = type;
    this.scene.startPlacingTurret(type);
    this.updateSelection();
  }

  private selectTrap(type: TrapType): void {
    this.selectedType = type;
    this.scene.startPlacingTrap(type);
    this.updateSelection();
  }

  private updateSelection(): void {
    // Update turret button appearances
    this.turretButtons.forEach((button, type) => {
      const bg = button.getData('bg') as Phaser.GameObjects.Rectangle;
      if (type === this.selectedType) {
        bg.setStrokeStyle(3, COLORS.PRIMARY);
      } else {
        bg.setStrokeStyle(2, COLORS.PANEL_BORDER);
      }
    });

    // Update trap button appearances
    this.trapButtons.forEach((button, type) => {
      const bg = button.getData('bg') as Phaser.GameObjects.Rectangle;
      if (type === this.selectedType) {
        bg.setStrokeStyle(3, COLORS.PRIMARY);
      } else {
        bg.setStrokeStyle(2, COLORS.PANEL_BORDER);
      }
    });
  }

  private updateAffordability(): void {
    // Update turret buttons
    this.turretButtons.forEach((button) => {
      const turret = button.getData('turretData') as TurretData;
      const costText = button.getData('costText') as Phaser.GameObjects.Text;

      const canAfford = this.scene.resourceManager.canAfford(turret.cost);
      costText.setColor(canAfford ? '#00ff88' : '#ff4444');
      button.setAlpha(canAfford ? 1 : 0.5);
    });

    // Update trap buttons
    this.trapButtons.forEach((button) => {
      const trap = button.getData('trapData') as TrapData;
      const costText = button.getData('costText') as Phaser.GameObjects.Text;

      const canAfford = this.scene.resourceManager.canAfford(trap.cost);
      costText.setColor(canAfford ? '#00ff88' : '#ff4444');
      button.setAlpha(canAfford ? 1 : 0.5);
    });
  }

  private showTooltip(x: number, y: number, title: string, description: string, cost: { [key: string]: number }): void {
    this.hideTooltip();

    // Convert local coordinates to world coordinates
    // Container is at (0, GAME_HEIGHT - 120)
    const worldX = x;
    const worldY = (GAME_HEIGHT - 120) + y;

    this.tooltip = this.scene.add.container(worldX, worldY);
    this.tooltip.setDepth(DEPTH.UI + 10);

    const padding = 10;
    const width = 200;

    // Build cost string
    const costStr = Object.entries(cost)
      .map(([key, val]) => `${val} ${key}`)
      .join(', ');

    // Background (we'll resize after measuring text)
    const bg = this.scene.add.rectangle(0, 0, width, 80, COLORS.PANEL_BG, 0.95)
      .setStrokeStyle(1, COLORS.PANEL_BORDER)
      .setOrigin(0, 0);
    this.tooltip.add(bg);

    // Title
    const titleText = this.scene.add.text(padding, padding, title, {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold'
    });
    this.tooltip.add(titleText);

    // Description
    const descText = this.scene.add.text(padding, padding + 20, description, {
      fontSize: '11px',
      color: '#aaaaaa',
      wordWrap: { width: width - padding * 2 }
    });
    this.tooltip.add(descText);

    // Cost
    const costTextObj = this.scene.add.text(padding, padding + 20 + descText.height + 5, `Cost: ${costStr}`, {
      fontSize: '11px',
      color: '#00ff88'
    });
    this.tooltip.add(costTextObj);

    // Resize background
    const totalHeight = padding * 2 + 20 + descText.height + 5 + costTextObj.height;
    bg.setSize(width, totalHeight);
  }

  private hideTooltip(): void {
    if (this.tooltip) {
      this.tooltip.destroy();
      this.tooltip = null;
    }
  }

  public getTurretCost(type: TurretType): { [key: string]: number } {
    return TURRETS[type].cost;
  }

  public getTrapCost(type: TrapType): { [key: string]: number } {
    return TRAPS[type].cost;
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
