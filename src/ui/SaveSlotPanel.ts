import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FONTS, TEXT_COLORS, COLORS } from '../utils/Constants';
import { PersistenceManager, SaveSlotSummary } from '../systems/PersistenceManager';

export type SaveSlotMode = 'new' | 'load' | 'save';

/**
 * Modal listing the save slots. Used for NEW GAME (pick a slot to start in),
 * LOAD GAME (pick a slot to resume) and SAVE (copy the current game to a slot).
 */
export class SaveSlotPanel {
  private scene: Phaser.Scene;
  private mode: SaveSlotMode;
  private onPick: (slot: number) => void;
  private onClose: () => void;
  private objects: Phaser.GameObjects.GameObject[] = [];
  private pendingOverwrite: number | null = null;
  private pendingDelete: number | null = null;
  /** True once a slot was deleted through this panel (callers refresh on close). */
  public changed = false;

  constructor(scene: Phaser.Scene, mode: SaveSlotMode, onPick: (slot: number) => void, onClose: () => void) {
    this.scene = scene;
    this.mode = mode;
    this.onPick = onPick;
    this.onClose = onClose;
    this.build();
  }

  private title(): string {
    switch (this.mode) {
      case 'new': return 'NEW GAME - CHOOSE A SLOT';
      case 'load': return 'LOAD GAME';
      case 'save': return 'SAVE GAME';
    }
  }

  private build(): void {
    const persistence = PersistenceManager.get();
    const slots = persistence.listSlots();
    const activeSlot = persistence.getActiveSlot();

    const overlay = this.scene.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.8)
      .setInteractive()
      .setDepth(3000);
    overlay.on('pointerup', () => this.close());
    this.objects.push(overlay);

    const pw = 620;
    const ph = 120 + slots.length * 130;
    const px = GAME_WIDTH / 2 - pw / 2;
    const py = GAME_HEIGHT / 2 - ph / 2;

    const panel = this.scene.add.graphics().setDepth(3001);
    panel.fillStyle(0x0a0a1a, 1);
    panel.fillRect(px, py, pw, ph);
    panel.lineStyle(2, COLORS.PRIMARY, 1);
    panel.strokeRect(px, py, pw, ph);
    this.objects.push(panel);

    // Block clicks inside the panel from reaching the overlay.
    const blocker = this.scene.add.rectangle(GAME_WIDTH / 2, py + ph / 2, pw, ph, 0x000000, 0)
      .setInteractive()
      .setDepth(3001);
    this.objects.push(blocker);

    this.objects.push(this.scene.add.text(GAME_WIDTH / 2, py + 34, this.title(), {
      fontSize: '24px',
      fontFamily: FONTS.HEADER,
      color: TEXT_COLORS.PRIMARY
    }).setOrigin(0.5).setDepth(3002));

    slots.forEach((summary, i) => {
      const slot = i + 1;
      const rowY = py + 70 + i * 130;
      this.buildRow(slot, summary, slot === activeSlot, px + 20, rowY, pw - 40, 118);
    });

    const closeBtn = this.scene.add.text(GAME_WIDTH / 2, py + ph - 26, 'CLOSE', {
      fontSize: '16px',
      fontFamily: FONTS.HEADER,
      color: '#ffffff',
      backgroundColor: '#222233',
      padding: { left: 24, right: 24, top: 6, bottom: 6 }
    }).setOrigin(0.5).setDepth(3002).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerup', () => this.close());
    this.objects.push(closeBtn);
  }

  private buildRow(slot: number, summary: SaveSlotSummary | null, isActive: boolean, x: number, y: number, w: number, h: number): void {
    const persistence = PersistenceManager.get();
    const hasProgress = summary !== null && persistence.slotHasProgress(slot);

    const bg = this.scene.add.rectangle(x + w / 2, y + h / 2, w, h, 0x111122)
      .setStrokeStyle(1, isActive ? COLORS.PRIMARY : 0x333355)
      .setDepth(3002);
    this.objects.push(bg);

    const label = `SLOT ${slot}${isActive ? '  (current)' : ''}`;
    this.objects.push(this.scene.add.text(x + 16, y + 12, label, {
      fontSize: '16px',
      fontFamily: FONTS.HEADER,
      color: isActive ? TEXT_COLORS.PRIMARY : '#ffffff'
    }).setDepth(3003));

    const lines: string[] = [];
    if (!hasProgress) {
      lines.push('Empty');
    } else if (summary) {
      lines.push(`${summary.totalDrops} drops (${summary.successfulDrops} won)  ·  ${summary.mines} mines  ·  ${summary.planetsUnlocked}/3 planets`);
      lines.push(`${summary.energy} energy  ·  ${summary.researchCompleted} research  ·  ${summary.rosterSize} roster units`);
      lines.push(`Saved ${new Date(summary.savedAt).toLocaleString()}`);
    }
    this.objects.push(this.scene.add.text(x + 16, y + 38, lines.join('\n'), {
      fontSize: '12px',
      fontFamily: FONTS.BODY,
      color: TEXT_COLORS.SECONDARY,
      lineSpacing: 4
    }).setDepth(3003));

    // Action button
    let action: string | null;
    let danger = false;
    switch (this.mode) {
      case 'new':
        action = 'START';
        danger = hasProgress;
        break;
      case 'load':
        action = hasProgress ? 'LOAD' : null;
        break;
      case 'save':
        action = isActive ? 'SAVE' : hasProgress ? 'OVERWRITE' : 'SAVE HERE';
        danger = hasProgress && !isActive;
        break;
    }
    if (hasProgress && !(this.mode === 'save' && isActive)) {
      this.buildDeleteButton(slot, x, y, w, h);
    }
    if (!action) return;

    const btn = this.scene.add.text(x + w - 16, y + h / 2 - 8, action, {
      fontSize: '14px',
      fontFamily: FONTS.HEADER,
      color: danger ? '#ffffff' : '#000000',
      backgroundColor: danger ? '#882200' : '#00ff88',
      padding: { left: 14, right: 14, top: 8, bottom: 8 }
    }).setOrigin(1, 0.5).setDepth(3003).setInteractive({ useHandCursor: true });
    this.objects.push(btn);

    btn.on('pointerup', () => {
      // Destructive picks need a second click to confirm.
      if (danger && this.pendingOverwrite !== slot) {
        this.pendingOverwrite = slot;
        btn.setText('CONFIRM?');
        btn.setBackgroundColor('#cc3300');
        return;
      }
      this.onPick(slot);
      this.destroy();
    });
  }

  /**
   * DELETE lives on every slot with progress. While saving from the hangar the
   * current slot is exempt: erasing the game you are standing in makes no sense.
   */
  private buildDeleteButton(slot: number, x: number, y: number, w: number, h: number): void {
    const btn = this.scene.add.text(x + w - 16, y + h - 10, 'DELETE', {
      fontSize: '12px',
      fontFamily: FONTS.HEADER,
      color: '#ff6666',
      backgroundColor: '#1a0a0a',
      padding: { left: 10, right: 10, top: 4, bottom: 4 }
    }).setOrigin(1, 1).setDepth(3003).setInteractive({ useHandCursor: true });
    this.objects.push(btn);

    btn.on('pointerup', () => {
      if (this.pendingDelete !== slot) {
        this.pendingDelete = slot;
        btn.setText('DELETE SLOT ' + slot + '?  YES');
        btn.setColor('#ffffff');
        btn.setBackgroundColor('#cc3300');
        return;
      }
      PersistenceManager.get().deleteSlot(slot);
      this.changed = true;
      this.rebuild();
    });
  }

  private rebuild(): void {
    this.objects.forEach(o => o.destroy());
    this.objects = [];
    this.pendingOverwrite = null;
    this.pendingDelete = null;
    this.build();
  }

  private close(): void {
    this.destroy();
    this.onClose();
  }

  public destroy(): void {
    this.objects.forEach(o => o.destroy());
    this.objects = [];
  }
}
