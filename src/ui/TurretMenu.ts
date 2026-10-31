import Phaser from 'phaser';
import { COLORS, GAME_WIDTH, GAME_HEIGHT, DEPTH, TurretType, TrapType, FONTS, TEXT_COLORS, UI_INSETS } from '../utils/Constants';
import { GameScene } from '../scenes/GameScene';
import { DataLoader } from '../systems/DataLoader';
import { ResearchManager } from '../systems/ResearchManager';
import { TurretConfig, TrapConfig } from '../types/GameData';

type ModalKind = 'turrets' | 'traps';

interface CellSpec {
  id: string;
  name: string;
  texture: string;
  gunTexture?: string;
  cost: { [key: string]: number };
  unlocked: boolean;
  /** Number of roster units of this type, which place for free. */
  rosterCount: number;
  rosterLevel: number;
  tint: number;
  onSelect: () => void;
}

/**
 * Bottom build bar with TURRETS / TRAPS buttons that open a modal grid of
 * purchasable items. Items are tinted by research state and affordability;
 * turret cells also show how many roster units (free placements) are held.
 */
export class TurretMenu {
  private scene: GameScene;
  private container: Phaser.GameObjects.Container;
  private modalContainer: Phaser.GameObjects.Container | null = null;
  private modalBounds: Phaser.Geom.Rectangle | null = null;
  private researchManager: ResearchManager;
  private activeModal: ModalKind | null = null;
  /** Signature of the state the open modal was built from; used to skip no-op rebuilds. */
  private modalSignature = '';
  /** Interactive hit areas of the open modal, so hover can be restored after a rebuild. */
  private modalHitAreas: Phaser.GameObjects.Rectangle[] = [];

  constructor(scene: GameScene) {
    this.scene = scene;
    this.researchManager = new ResearchManager(scene);
    this.container = scene.add.container(0, GAME_HEIGHT - UI_INSETS.bottom);
    this.container.setDepth(DEPTH.UI);
    this.container.setScrollFactor(0);

    this.createMenu();
    this.scene.events.on('resourcesChanged', this.refreshModal, this);
    this.scene.events.on('turretPlaced', this.refreshModal, this);
  }

  public getBarBounds(): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(0, GAME_HEIGHT - UI_INSETS.bottom, GAME_WIDTH, UI_INSETS.bottom);
  }

  public getModalBounds(): Phaser.Geom.Rectangle | null {
    return this.modalBounds;
  }

  private createMenu(): void {
    const panelHeight = UI_INSETS.bottom;
    const cutSize = 15;

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

    this.createMainButton(GAME_WIDTH / 2 - 100, 63, 'TURRETS', 0x2a4a2a, () => this.toggleModal('turrets'));
    this.createMainButton(GAME_WIDTH / 2 + 100, 63, 'TRAPS', 0x4a2a4a, () => this.toggleModal('traps'));
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
      bgGraphics.moveTo(-width / 2 + cutSize, -height / 2);
      bgGraphics.lineTo(width / 2, -height / 2);
      bgGraphics.lineTo(width / 2, height / 2 - cutSize);
      bgGraphics.lineTo(width / 2 - cutSize, height / 2);
      bgGraphics.lineTo(-width / 2, height / 2);
      bgGraphics.lineTo(-width / 2, -height / 2 + cutSize);
      bgGraphics.closePath();
      bgGraphics.fillPath();
      bgGraphics.lineStyle(2, borderColor, 1);
      bgGraphics.strokePath();
    };
    drawBtn(color);
    btnContainer.add(bgGraphics);

    btnContainer.add(this.scene.add.text(0, 0, text, {
      fontSize: '16px',
      fontFamily: FONTS.HEADER,
      color: '#ffffff'
    }).setOrigin(0.5));

    const hitArea = this.scene.add.rectangle(0, 0, width, height, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    btnContainer.add(hitArea);
    hitArea.on('pointerover', () => drawBtn(color + 0x222222, COLORS.PRIMARY));
    hitArea.on('pointerout', () => drawBtn(color));
    hitArea.on('pointerup', onClick);

    this.container.add(btnContainer);
  }

  private toggleModal(type: ModalKind): void {
    if (this.activeModal === type) {
      this.closeModal();
    } else {
      this.openModal(type);
    }
  }

  private buildCells(type: ModalKind): CellSpec[] {
    if (type === 'turrets') {
      return DataLoader.getAllTurrets().map((turret: TurretConfig) => {
        const turretType = turret.id.toLowerCase() as TurretType;
        const roster = this.scene.getAvailableRosterTurrets(turretType);
        return {
          id: turret.id,
          name: turret.name,
          texture: `turret-${turret.id.toLowerCase()}`,
          gunTexture: `turret-${turret.id.toLowerCase()}-gun`,
          cost: turret.cost,
          unlocked: this.researchManager.isTurretUnlocked(turret.id),
          rosterCount: roster.length,
          rosterLevel: roster.reduce((m, t) => Math.max(m, t.level), 0),
          tint: 0x2a4a2a,
          onSelect: () => this.scene.startPlacingTurret(turretType)
        };
      });
    }
    return DataLoader.getAllTraps().map((trap: TrapConfig) => ({
      id: trap.id,
      name: trap.name,
      texture: `trap-${trap.id.toLowerCase()}`,
      cost: trap.cost,
      unlocked: this.researchManager.isTrapUnlocked(trap.id),
      rosterCount: 0,
      rosterLevel: 0,
      tint: 0x4a2a4a,
      onSelect: () => this.scene.startPlacingTrap(trap.id.toLowerCase() as TrapType)
    }));
  }

  /**
   * Everything a cell's appearance depends on. If this string is unchanged a
   * rebuild would be a visual no-op, so refreshModal skips it.
   */
  private computeSignature(cells: CellSpec[]): string {
    return cells.map(cell => {
      const fromRoster = cell.rosterCount > 0;
      const canAfford = fromRoster || this.scene.resourceManager.canAfford(cell.cost);
      const perResource = Object.entries(cell.cost)
        .map(([resource, amount]) => (this.scene.resourceManager.getResource(resource) >= amount ? '1' : '0'))
        .join('');
      return `${cell.id}:${cell.unlocked ? 1 : 0}:${cell.rosterCount}:${cell.rosterLevel}:${canAfford ? 1 : 0}:${perResource}`;
    }).join('|');
  }

  private openModal(type: ModalKind): void {
    this.closeModal();
    this.activeModal = type;

    const cells = this.buildCells(type);
    this.modalSignature = this.computeSignature(cells);
    const cols = 4;
    const cellSize = 80;
    const padding = 15;
    const rows = Math.ceil((cells.length + 1) / cols);

    const modalWidth = cols * cellSize + padding * 2;
    const modalHeight = rows * cellSize + padding * 2 + 40;
    const modalX = GAME_WIDTH / 2 - modalWidth / 2;
    const modalY = GAME_HEIGHT - UI_INSETS.bottom - modalHeight - 10;
    this.modalBounds = new Phaser.Geom.Rectangle(modalX, modalY, modalWidth, modalHeight);

    this.modalContainer = this.scene.add.container(modalX, modalY);
    this.modalContainer.setDepth(DEPTH.UI + 5);
    this.modalContainer.setScrollFactor(0);

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

    this.modalContainer.add(this.scene.add.text(modalWidth / 2, 20, type.toUpperCase(), {
      fontSize: '18px',
      fontFamily: FONTS.HEADER,
      color: TEXT_COLORS.PRIMARY
    }).setOrigin(0.5));

    const startY = 50;
    cells.forEach((cell, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      this.createCell(padding + col * cellSize + cellSize / 2, startY + row * cellSize + cellSize / 2, cellSize - 10, cell);
    });

    const cancelIndex = cells.length;
    this.createCancelCell(
      padding + (cancelIndex % cols) * cellSize + cellSize / 2,
      startY + Math.floor(cancelIndex / cols) * cellSize + cellSize / 2,
      cellSize - 10
    );

    this.scene.getCameraManager().addUIObject(this.modalContainer);
  }

  private drawCellBg(g: Phaser.GameObjects.Graphics, size: number, fill: number, border: number): void {
    const cutSize = 6;
    g.clear();
    g.fillStyle(fill, 1);
    g.beginPath();
    g.moveTo(-size / 2 + cutSize, -size / 2);
    g.lineTo(size / 2, -size / 2);
    g.lineTo(size / 2, size / 2 - cutSize);
    g.lineTo(size / 2 - cutSize, size / 2);
    g.lineTo(-size / 2, size / 2);
    g.lineTo(-size / 2, -size / 2 + cutSize);
    g.closePath();
    g.fillPath();
    g.lineStyle(2, border, 1);
    g.strokePath();
  }

  private createCell(x: number, y: number, size: number, cell: CellSpec): void {
    if (!this.modalContainer) return;

    const fromRoster = cell.rosterCount > 0;
    const canAfford = fromRoster || this.scene.resourceManager.canAfford(cell.cost);
    const isAvailable = cell.unlocked && canAfford;

    const cellContainer = this.scene.add.container(x, y);
    const bgGraphics = this.scene.add.graphics();
    const bgColor = isAvailable ? cell.tint : 0x1a1a2e;
    const borderColor = isAvailable ? (fromRoster ? 0xffcc44 : COLORS.PANEL_BORDER) : 0x333344;
    this.drawCellBg(bgGraphics, size, bgColor, borderColor);
    cellContainer.add(bgGraphics);

    const icon = this.scene.add.sprite(0, 0, cell.texture);
    icon.setScale(0.9);
    if (!isAvailable) icon.setTint(0x444444);
    cellContainer.add(icon);
    if (cell.gunTexture) {
      const gun = this.scene.add.sprite(0, 0, cell.gunTexture);
      gun.setOrigin(9 / 44, 0.5);
      gun.setScale(0.9);
      gun.setRotation(-Math.PI / 4);
      if (!isAvailable) gun.setTint(0x444444);
      cellContainer.add(gun);
    }

    if (!cell.unlocked) {
      const lockLines = this.scene.add.graphics();
      lockLines.lineStyle(4, 0xff4444, 0.5);
      const spacing = 18;
      const half = size / 2 - 4;
      for (let offset = -size; offset <= size; offset += spacing) {
        const x1 = Math.max(-half, -half + offset);
        const y1 = Math.max(-half, -half - offset);
        const x2 = Math.min(half, half + offset);
        const y2 = Math.min(half, half - offset);
        if (x1 < x2 && y1 < y2) lockLines.lineBetween(x1, y1, x2, y2);
      }
      cellContainer.add(lockLines);
    }

    if (fromRoster) {
      cellContainer.add(this.scene.add.text(size / 2 - 4, -size / 2 + 4, `x${cell.rosterCount}`, {
        fontSize: '11px',
        fontFamily: FONTS.HEADER,
        color: '#000000',
        backgroundColor: '#ffcc44',
        padding: { left: 3, right: 3, top: 1, bottom: 1 }
      }).setOrigin(1, 0));
    }

    // Tooltip
    const tooltipContainer = this.scene.add.container(0, -size / 2 - 10);
    tooltipContainer.setVisible(false);
    cellContainer.add(tooltipContainer);

    const tooltipLines: string[] = [cell.name];
    if (!cell.unlocked) {
      tooltipLines.push('LOCKED - Research Required');
    } else if (fromRoster) {
      tooltipLines.push(`FREE - ${cell.rosterCount} on roster (Lv ${cell.rosterLevel})`);
    } else {
      Object.entries(cell.cost).forEach(([resource, amount]) => {
        const hasEnough = this.scene.resourceManager.getResource(resource) >= amount;
        tooltipLines.push(`${hasEnough ? '' : '! '}${amount} ${resource}`);
      });
    }

    const textObj = this.scene.add.text(0, 0, tooltipLines.join('\n'), {
      fontSize: '10px',
      fontFamily: FONTS.BODY,
      color: '#ffffff',
      align: 'center',
      lineSpacing: 2
    }).setOrigin(0.5, 1);
    const tpad = 6;
    const bgWidth = textObj.width + tpad * 2;
    const bgHeight = textObj.height + tpad * 2;
    const tooltipBg = this.scene.add.graphics();
    tooltipBg.fillStyle(0x000000, 0.9);
    tooltipBg.fillRoundedRect(-bgWidth / 2, -bgHeight, bgWidth, bgHeight, 4);
    tooltipBg.lineStyle(1, isAvailable ? COLORS.PRIMARY : 0xff4444, 1);
    tooltipBg.strokeRoundedRect(-bgWidth / 2, -bgHeight, bgWidth, bgHeight, 4);
    textObj.setY(-tpad);
    tooltipContainer.add(tooltipBg);
    tooltipContainer.add(textObj);

    const hitArea = this.scene.add.rectangle(0, 0, size, size, 0xffffff, 0)
      .setInteractive({ useHandCursor: isAvailable });
    cellContainer.add(hitArea);
    this.modalHitAreas.push(hitArea);

    hitArea.on('pointerover', () => {
      tooltipContainer.setVisible(true);
      if (isAvailable) this.drawCellBg(bgGraphics, size, bgColor + 0x101010, COLORS.PRIMARY);
    });
    hitArea.on('pointerout', () => {
      tooltipContainer.setVisible(false);
      this.drawCellBg(bgGraphics, size, bgColor, borderColor);
    });
    hitArea.on('pointerup', () => {
      if (isAvailable) {
        cell.onSelect();
        this.closeModal();
      }
    });

    this.modalContainer.add(cellContainer);
  }

  private createCancelCell(x: number, y: number, size: number): void {
    if (!this.modalContainer) return;

    const cellContainer = this.scene.add.container(x, y);
    const bgGraphics = this.scene.add.graphics();
    const bgColor = 0x4a2a2a;
    this.drawCellBg(bgGraphics, size, bgColor, COLORS.DANGER);
    cellContainer.add(bgGraphics);

    cellContainer.add(this.scene.add.text(0, -5, 'X', {
      fontSize: '24px',
      fontFamily: FONTS.HEADER,
      color: '#ff4444'
    }).setOrigin(0.5));
    cellContainer.add(this.scene.add.text(0, size / 2 - 12, 'CANCEL', {
      fontSize: '9px',
      fontFamily: FONTS.BODY,
      color: '#ff4444'
    }).setOrigin(0.5));

    const hitArea = this.scene.add.rectangle(0, 0, size, size, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    cellContainer.add(hitArea);
    this.modalHitAreas.push(hitArea);
    hitArea.on('pointerover', () => this.drawCellBg(bgGraphics, size, 0x6a3a3a, COLORS.DANGER));
    hitArea.on('pointerout', () => this.drawCellBg(bgGraphics, size, bgColor, COLORS.DANGER));
    hitArea.on('pointerup', () => this.closeModal());

    this.modalContainer.add(cellContainer);
  }

  private closeModal(): void {
    if (this.modalContainer) {
      this.modalContainer.destroy();
      this.modalContainer = null;
    }
    this.modalHitAreas = [];
    this.modalSignature = '';
    this.modalBounds = null;
    this.activeModal = null;
  }

  /**
   * Rebuild the open modal so affordability and roster counts stay current.
   * Resource events fire on every kill, so only rebuild when the displayed
   * state actually changed; a rebuild destroys the cell under the pointer,
   * which would otherwise flicker hover on every shot.
   */
  private refreshModal(): void {
    if (!this.activeModal) return;
    const signature = this.computeSignature(this.buildCells(this.activeModal));
    if (signature === this.modalSignature) return;
    this.openModal(this.activeModal);
    this.restoreHover();
  }

  /** After a rebuild, re-fire pointerover on whichever new cell sits under the pointer. */
  private restoreHover(): void {
    const pointer = this.scene.input.activePointer;
    if (!pointer || pointer.wasTouch) return;
    const hits = this.scene.input.hitTestPointer(pointer) as Phaser.GameObjects.GameObject[];
    for (const hitArea of this.modalHitAreas) {
      if (hits.includes(hitArea)) {
        hitArea.emit('pointerover', pointer);
        return;
      }
    }
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
    this.scene.events.off('resourcesChanged', this.refreshModal, this);
    this.scene.events.off('turretPlaced', this.refreshModal, this);
    this.closeModal();
    this.container.destroy();
  }
}
