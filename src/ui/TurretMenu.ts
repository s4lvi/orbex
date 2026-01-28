import Phaser from 'phaser';
import { COLORS, GAME_WIDTH, GAME_HEIGHT, DEPTH, TurretType, TrapType, FONTS, TEXT_COLORS } from '../utils/Constants';
import { GameScene } from '../scenes/GameScene';
import { DataLoader } from '../systems/DataLoader';
import { ResearchManager } from '../systems/ResearchManager';
import { TurretConfig, TrapConfig } from '../types/GameData';

export class TurretMenu {
  private scene: GameScene;
  private container: Phaser.GameObjects.Container;
  private modalContainer: Phaser.GameObjects.Container | null = null;
  private researchManager: ResearchManager;
  private activeModal: 'turrets' | 'traps' | null = null;

  constructor(scene: GameScene) {
    this.scene = scene;
    this.researchManager = new ResearchManager(scene);
    this.container = scene.add.container(0, GAME_HEIGHT - 130);
    this.container.setDepth(DEPTH.UI);
    // Fix UI to screen (don't move with camera)
    this.container.setScrollFactor(0);

    this.createMenu();
  }

  private createMenu(): void {
    const panelHeight = 125;
    const cutSize = 15;

    // Background panel
    const bg = this.scene.add.graphics();
    bg.fillStyle(COLORS.PANEL_BG, 0.95);
    bg.beginPath();
    bg.moveTo(0, 0);
    bg.lineTo(GAME_WIDTH, 0);
    bg.lineTo(GAME_WIDTH, panelHeight - cutSize);
    bg.lineTo(GAME_WIDTH - cutSize, panelHeight);
    bg.lineTo(cutSize, panelHeight);
    bg.lineTo(0, panelHeight - cutSize);
    bg.closePath();
    bg.fillPath();

    bg.lineStyle(2, COLORS.PRIMARY, 0.8);
    bg.strokePath();
    this.container.add(bg);

    // TURRETS button
    this.createMainButton(GAME_WIDTH / 2 - 100, 63, 'TURRETS', 0x2a4a2a, () => {
      this.toggleModal('turrets');
    });

    // TRAPS button
    this.createMainButton(GAME_WIDTH / 2 + 100, 63, 'TRAPS', 0x4a2a4a, () => {
      this.toggleModal('traps');
    });

    // Update on resource changes
    this.scene.events.on('resourcesChanged', this.updateModalAffordability, this);
  }

  private createMainButton(x: number, y: number, text: string, color: number, onClick: () => void): void {
    const width = 150;
    const height = 50;
    const cutSize = 8;

    const btnContainer = this.scene.add.container(x, y);

    const bgGraphics = this.scene.add.graphics();
    const drawBtn = (fillColor: number, borderColor: number = COLORS.PANEL_BORDER) => {
      bgGraphics.clear();
      bgGraphics.fillStyle(fillColor, 1);
      bgGraphics.beginPath();
      bgGraphics.moveTo(-width/2 + cutSize, -height/2);
      bgGraphics.lineTo(width/2, -height/2);
      bgGraphics.lineTo(width/2, height/2 - cutSize);
      bgGraphics.lineTo(width/2 - cutSize, height/2);
      bgGraphics.lineTo(-width/2, height/2);
      bgGraphics.lineTo(-width/2, -height/2 + cutSize);
      bgGraphics.closePath();
      bgGraphics.fillPath();
      bgGraphics.lineStyle(2, borderColor, 1);
      bgGraphics.strokePath();
    };
    drawBtn(color);
    btnContainer.add(bgGraphics);

    const label = this.scene.add.text(0, 0, text, {
      fontSize: '16px',
      fontFamily: FONTS.HEADER,
      color: '#ffffff'
    }).setOrigin(0.5);
    btnContainer.add(label);

    const hitArea = this.scene.add.rectangle(0, 0, width, height, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    btnContainer.add(hitArea);

    hitArea.on('pointerover', () => drawBtn(color + 0x222222, COLORS.PRIMARY));
    hitArea.on('pointerout', () => drawBtn(color));
    hitArea.on('pointerup', onClick);

    this.container.add(btnContainer);
  }

  private toggleModal(type: 'turrets' | 'traps'): void {
    if (this.activeModal === type) {
      this.closeModal();
    } else {
      this.openModal(type);
    }
  }

  private openModal(type: 'turrets' | 'traps'): void {
    this.closeModal();
    this.activeModal = type;

    const items = type === 'turrets' ? DataLoader.getAllTurrets() : DataLoader.getAllTraps();
    const cols = 4;
    const cellSize = 80;
    const padding = 15;
    const rows = Math.ceil((items.length + 1) / cols); // +1 for cancel button

    const modalWidth = cols * cellSize + padding * 2;
    const modalHeight = rows * cellSize + padding * 2 + 40; // +40 for title
    const modalX = GAME_WIDTH / 2 - modalWidth / 2;
    const modalY = GAME_HEIGHT - 130 - modalHeight - 10;

    this.modalContainer = this.scene.add.container(modalX, modalY);
    this.modalContainer.setDepth(DEPTH.UI + 5);
    // Fix UI to screen (don't move with camera)
    this.modalContainer.setScrollFactor(0);

    // Background
    const cutSize = 15;
    const bg = this.scene.add.graphics();
    bg.fillStyle(COLORS.PANEL_BG, 0.98);
    bg.beginPath();
    bg.moveTo(cutSize, 0);
    bg.lineTo(modalWidth - cutSize, 0);
    bg.lineTo(modalWidth, cutSize);
    bg.lineTo(modalWidth, modalHeight - cutSize);
    bg.lineTo(modalWidth - cutSize, modalHeight);
    bg.lineTo(cutSize, modalHeight);
    bg.lineTo(0, modalHeight - cutSize);
    bg.lineTo(0, cutSize);
    bg.closePath();
    bg.fillPath();
    bg.lineStyle(2, COLORS.PRIMARY, 1);
    bg.strokePath();
    this.modalContainer.add(bg);

    // Title
    const title = this.scene.add.text(modalWidth / 2, 20, type.toUpperCase(), {
      fontSize: '18px',
      fontFamily: FONTS.HEADER,
      color: TEXT_COLORS.PRIMARY
    }).setOrigin(0.5);
    this.modalContainer.add(title);

    // Grid items
    const startY = 50;
    items.forEach((item, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = padding + col * cellSize + cellSize / 2;
      const y = startY + row * cellSize + cellSize / 2;

      if (type === 'turrets') {
        this.createTurretCell(x, y, cellSize - 10, item as TurretConfig);
      } else {
        this.createTrapCell(x, y, cellSize - 10, item as TrapConfig);
      }
    });

    // Cancel button in the last cell
    const cancelIndex = items.length;
    const cancelCol = cancelIndex % cols;
    const cancelRow = Math.floor(cancelIndex / cols);
    const cancelX = padding + cancelCol * cellSize + cellSize / 2;
    const cancelY = startY + cancelRow * cellSize + cellSize / 2;
    this.createCancelCell(cancelX, cancelY, cellSize - 10);

    this.scene.getCameraManager().addUIObject(this.modalContainer);
  }

  private createTurretCell(x: number, y: number, size: number, turret: TurretConfig): void {
    if (!this.modalContainer) return;

    const isUnlocked = this.researchManager.isTurretUnlocked(turret.id);
    const canAfford = this.scene.resourceManager.canAfford(turret.cost);
    const isAvailable = isUnlocked && canAfford;
    const cutSize = 6;

    const cellContainer = this.scene.add.container(x, y);

    const bgGraphics = this.scene.add.graphics();
    const bgColor = isAvailable ? 0x2a4a2a : 0x1a1a2e;
    const borderColor = isAvailable ? COLORS.PANEL_BORDER : 0x333344;

    const drawBg = (fill: number, border: number) => {
      bgGraphics.clear();
      bgGraphics.fillStyle(fill, 1);
      bgGraphics.beginPath();
      bgGraphics.moveTo(-size/2 + cutSize, -size/2);
      bgGraphics.lineTo(size/2, -size/2);
      bgGraphics.lineTo(size/2, size/2 - cutSize);
      bgGraphics.lineTo(size/2 - cutSize, size/2);
      bgGraphics.lineTo(-size/2, size/2);
      bgGraphics.lineTo(-size/2, -size/2 + cutSize);
      bgGraphics.closePath();
      bgGraphics.fillPath();
      bgGraphics.lineStyle(2, border, 1);
      bgGraphics.strokePath();
    };
    drawBg(bgColor, borderColor);
    cellContainer.add(bgGraphics);

    // Icon - centered
    const icon = this.scene.add.sprite(0, 0, `turret-${turret.id.toLowerCase()}`);
    icon.setScale(0.9);
    if (!isAvailable) icon.setTint(0x444444);
    cellContainer.add(icon);

    // Red hatch lines for locked (not researched) items
    if (!isUnlocked) {
      const lockLines = this.scene.add.graphics();
      lockLines.lineStyle(4, 0xff4444, 0.5);
      // Draw parallel diagonal lines (hatch pattern)
      const spacing = 18;
      const half = size / 2 - 4;
      for (let offset = -size; offset <= size; offset += spacing) {
        // Line from top-left to bottom-right direction
        const x1 = Math.max(-half, -half + offset);
        const y1 = Math.max(-half, -half - offset);
        const x2 = Math.min(half, half + offset);
        const y2 = Math.min(half, half - offset);
        if (x1 < x2 && y1 < y2) {
          lockLines.lineBetween(x1, y1, x2, y2);
        }
      }
      cellContainer.add(lockLines);
    }

    // Tooltip container (shown on hover)
    const tooltipContainer = this.scene.add.container(0, -size/2 - 10);
    tooltipContainer.setVisible(false);
    cellContainer.add(tooltipContainer);

    // Build tooltip content
    const tooltipLines: string[] = [turret.name];
    if (!isUnlocked) {
      tooltipLines.push('LOCKED - Research Required');
    } else {
      Object.entries(turret.cost).forEach(([resource, amount]) => {
        const hasEnough = this.scene.resourceManager.getResource(resource) >= amount;
        const prefix = hasEnough ? '' : '! ';
        tooltipLines.push(`${prefix}${amount} ${resource}`);
      });
    }

    const tooltipText = tooltipLines.join('\n');
    const tooltipBg = this.scene.add.graphics();
    const textObj = this.scene.add.text(0, 0, tooltipText, {
      fontSize: '10px',
      fontFamily: FONTS.BODY,
      color: '#ffffff',
      align: 'center',
      lineSpacing: 2
    }).setOrigin(0.5, 1);

    const padding = 6;
    const bgWidth = textObj.width + padding * 2;
    const bgHeight = textObj.height + padding * 2;
    tooltipBg.fillStyle(0x000000, 0.9);
    tooltipBg.fillRoundedRect(-bgWidth/2, -bgHeight, bgWidth, bgHeight, 4);
    tooltipBg.lineStyle(1, isUnlocked ? (canAfford ? COLORS.PRIMARY : 0xff4444) : 0xff4444, 1);
    tooltipBg.strokeRoundedRect(-bgWidth/2, -bgHeight, bgWidth, bgHeight, 4);

    textObj.setY(-padding);
    tooltipContainer.add(tooltipBg);
    tooltipContainer.add(textObj);

    // Hit area
    const hitArea = this.scene.add.rectangle(0, 0, size, size, 0xffffff, 0)
      .setInteractive({ useHandCursor: isAvailable });
    cellContainer.add(hitArea);

    hitArea.on('pointerover', () => {
      tooltipContainer.setVisible(true);
      if (isAvailable) {
        drawBg(0x3a5a3a, COLORS.PRIMARY);
      }
    });

    hitArea.on('pointerout', () => {
      tooltipContainer.setVisible(false);
      drawBg(bgColor, borderColor);
    });

    hitArea.on('pointerup', () => {
      if (isAvailable) {
        this.selectTurret(turret.id);
        this.closeModal();
      }
    });

    cellContainer.setData('turretData', turret);
    cellContainer.setData('isUnlocked', isUnlocked);
    cellContainer.setData('canAfford', canAfford);

    this.modalContainer.add(cellContainer);
  }

  private createTrapCell(x: number, y: number, size: number, trap: TrapConfig): void {
    if (!this.modalContainer) return;

    const isUnlocked = this.researchManager.isTrapUnlocked(trap.id);
    const canAfford = this.scene.resourceManager.canAfford(trap.cost);
    const isAvailable = isUnlocked && canAfford;
    const cutSize = 6;

    const cellContainer = this.scene.add.container(x, y);

    const bgGraphics = this.scene.add.graphics();
    const bgColor = isAvailable ? 0x4a2a4a : 0x1a1a2e;
    const borderColor = isAvailable ? COLORS.PANEL_BORDER : 0x333344;

    const drawBg = (fill: number, border: number) => {
      bgGraphics.clear();
      bgGraphics.fillStyle(fill, 1);
      bgGraphics.beginPath();
      bgGraphics.moveTo(-size/2 + cutSize, -size/2);
      bgGraphics.lineTo(size/2, -size/2);
      bgGraphics.lineTo(size/2, size/2 - cutSize);
      bgGraphics.lineTo(size/2 - cutSize, size/2);
      bgGraphics.lineTo(-size/2, size/2);
      bgGraphics.lineTo(-size/2, -size/2 + cutSize);
      bgGraphics.closePath();
      bgGraphics.fillPath();
      bgGraphics.lineStyle(2, border, 1);
      bgGraphics.strokePath();
    };
    drawBg(bgColor, borderColor);
    cellContainer.add(bgGraphics);

    // Icon - centered
    const icon = this.scene.add.sprite(0, 0, `trap-${trap.id.toLowerCase()}`);
    icon.setScale(0.9);
    if (!isAvailable) icon.setTint(0x444444);
    cellContainer.add(icon);

    // Red hatch lines for locked (not researched) items
    if (!isUnlocked) {
      const lockLines = this.scene.add.graphics();
      lockLines.lineStyle(4, 0xff4444, 0.5);
      // Draw parallel diagonal lines (hatch pattern)
      const spacing = 18;
      const half = size / 2 - 4;
      for (let offset = -size; offset <= size; offset += spacing) {
        // Line from top-left to bottom-right direction
        const x1 = Math.max(-half, -half + offset);
        const y1 = Math.max(-half, -half - offset);
        const x2 = Math.min(half, half + offset);
        const y2 = Math.min(half, half - offset);
        if (x1 < x2 && y1 < y2) {
          lockLines.lineBetween(x1, y1, x2, y2);
        }
      }
      cellContainer.add(lockLines);
    }

    // Tooltip container (shown on hover)
    const tooltipContainer = this.scene.add.container(0, -size/2 - 10);
    tooltipContainer.setVisible(false);
    cellContainer.add(tooltipContainer);

    // Build tooltip content
    const tooltipLines: string[] = [trap.name];
    if (!isUnlocked) {
      tooltipLines.push('LOCKED - Research Required');
    } else {
      Object.entries(trap.cost).forEach(([resource, amount]) => {
        const hasEnough = this.scene.resourceManager.getResource(resource) >= amount;
        const prefix = hasEnough ? '' : '! ';
        tooltipLines.push(`${prefix}${amount} ${resource}`);
      });
    }

    const tooltipText = tooltipLines.join('\n');
    const tooltipBg = this.scene.add.graphics();
    const textObj = this.scene.add.text(0, 0, tooltipText, {
      fontSize: '10px',
      fontFamily: FONTS.BODY,
      color: '#ffffff',
      align: 'center',
      lineSpacing: 2
    }).setOrigin(0.5, 1);

    const padding = 6;
    const bgWidth = textObj.width + padding * 2;
    const bgHeight = textObj.height + padding * 2;
    tooltipBg.fillStyle(0x000000, 0.9);
    tooltipBg.fillRoundedRect(-bgWidth/2, -bgHeight, bgWidth, bgHeight, 4);
    tooltipBg.lineStyle(1, isUnlocked ? (canAfford ? COLORS.PRIMARY : 0xff4444) : 0xff4444, 1);
    tooltipBg.strokeRoundedRect(-bgWidth/2, -bgHeight, bgWidth, bgHeight, 4);

    textObj.setY(-padding);
    tooltipContainer.add(tooltipBg);
    tooltipContainer.add(textObj);

    // Hit area
    const hitArea = this.scene.add.rectangle(0, 0, size, size, 0xffffff, 0)
      .setInteractive({ useHandCursor: isAvailable });
    cellContainer.add(hitArea);

    hitArea.on('pointerover', () => {
      tooltipContainer.setVisible(true);
      if (isAvailable) {
        drawBg(0x5a3a5a, COLORS.PRIMARY);
      }
    });

    hitArea.on('pointerout', () => {
      tooltipContainer.setVisible(false);
      drawBg(bgColor, borderColor);
    });

    hitArea.on('pointerup', () => {
      if (isAvailable) {
        this.selectTrap(trap.id);
        this.closeModal();
      }
    });

    cellContainer.setData('trapData', trap);
    cellContainer.setData('isUnlocked', isUnlocked);
    cellContainer.setData('canAfford', canAfford);

    this.modalContainer.add(cellContainer);
  }

  private createCancelCell(x: number, y: number, size: number): void {
    if (!this.modalContainer) return;

    const cutSize = 6;
    const cellContainer = this.scene.add.container(x, y);

    const bgGraphics = this.scene.add.graphics();
    const bgColor = 0x4a2a2a;

    const drawBg = (fill: number, border: number) => {
      bgGraphics.clear();
      bgGraphics.fillStyle(fill, 1);
      bgGraphics.beginPath();
      bgGraphics.moveTo(-size/2 + cutSize, -size/2);
      bgGraphics.lineTo(size/2, -size/2);
      bgGraphics.lineTo(size/2, size/2 - cutSize);
      bgGraphics.lineTo(size/2 - cutSize, size/2);
      bgGraphics.lineTo(-size/2, size/2);
      bgGraphics.lineTo(-size/2, -size/2 + cutSize);
      bgGraphics.closePath();
      bgGraphics.fillPath();
      bgGraphics.lineStyle(2, border, 1);
      bgGraphics.strokePath();
    };
    drawBg(bgColor, COLORS.DANGER);
    cellContainer.add(bgGraphics);

    // X icon
    const xText = this.scene.add.text(0, -5, 'X', {
      fontSize: '24px',
      fontFamily: FONTS.HEADER,
      color: '#ff4444'
    }).setOrigin(0.5);
    cellContainer.add(xText);

    const cancelLabel = this.scene.add.text(0, size/2 - 12, 'CANCEL', {
      fontSize: '9px',
      fontFamily: FONTS.BODY,
      color: '#ff4444'
    }).setOrigin(0.5);
    cellContainer.add(cancelLabel);

    // Hit area
    const hitArea = this.scene.add.rectangle(0, 0, size, size, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    cellContainer.add(hitArea);

    hitArea.on('pointerover', () => drawBg(0x6a3a3a, COLORS.DANGER));
    hitArea.on('pointerout', () => drawBg(bgColor, COLORS.DANGER));
    hitArea.on('pointerup', () => this.closeModal());

    this.modalContainer.add(cellContainer);
  }

  private closeModal(): void {
    if (this.modalContainer) {
      this.modalContainer.destroy();
      this.modalContainer = null;
    }
    this.activeModal = null;
  }

  private updateModalAffordability(): void {
    // Modal cells are recreated each time, so we just close and reopen if needed
    // This is simpler than tracking all the dynamic elements
    if (!this.modalContainer || !this.activeModal) return;

    // For now, the modal will show current affordability state when opened
    // Real-time updates would require more complex tracking
  }

  private selectTurret(turretId: string): void {
    const turretType = turretId.toLowerCase() as TurretType;
    this.scene.startPlacingTurret(turretType);
  }

  private selectTrap(trapId: string): void {
    const trapType = trapId.toLowerCase() as TrapType;
    this.scene.startPlacingTrap(trapType);
  }

  public getTurretCost(type: TurretType): { [key: string]: number } {
    const turret = DataLoader.getTurretByType(type);
    return turret?.cost || {};
  }

  public getTrapCost(type: TrapType): { [key: string]: number } {
    const trap = DataLoader.getTrapByType(type);
    return trap?.cost || {};
  }

  public clearSelection(): void {
    this.closeModal();
  }

  public isModalOpen(): boolean {
    return this.modalContainer !== null;
  }

  public getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  public destroy(): void {
    this.scene.events.off('resourcesChanged', this.updateModalAffordability, this);
    this.closeModal();
    this.container.destroy();
  }
}
