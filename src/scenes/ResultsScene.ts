import Phaser from 'phaser';
import { SCENES, COLORS, GAME_WIDTH, GAME_HEIGHT, FONTS, TEXT_COLORS, MaterialType, MATERIAL_COLORS } from '../utils/Constants';
import { GameResult } from '../types/GameData';
import { DataLoader } from '../systems/DataLoader';

function materialName(id: string): string {
  return DataLoader.getMaterial(id as MaterialType)?.name || id;
}

/**
 * Post-drop summary. Purely presentational: GameScene has already persisted
 * every outcome before starting this scene.
 */
export class ResultsScene extends Phaser.Scene {
  private result!: GameResult;

  constructor() {
    super({ key: SCENES.RESULTS });
  }

  create(): void {
    this.result = this.registry.get('gameResult');
    if (!this.result) {
      this.scene.start(SCENES.MAIN_MENU);
      return;
    }

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT,
      this.result.victory ? 0x0a1a0a : 0x1a0a0a);

    const title = this.result.victory ? 'EXTRACTION COMPLETE' : 'EXTRACTION FAILED';
    this.add.text(GAME_WIDTH / 2, 110, title, {
      fontSize: '44px',
      fontFamily: FONTS.HEADER,
      color: this.result.victory ? '#00ff88' : '#ff4444'
    }).setOrigin(0.5);

    let subtitle: string;
    if (this.result.defendedMineName) {
      subtitle = this.result.victory
        ? `Mine defended: ${this.result.defendedMineName}`
        : `Mine fell: ${this.result.defendedMineName} took heavy damage`;
    } else {
      subtitle = this.result.victory
        ? 'Extraction site established!'
        : 'Site lost - energy partially recovered';
    }
    this.add.text(GAME_WIDTH / 2, 165, subtitle, {
      fontSize: '20px',
      fontFamily: FONTS.BODY,
      color: TEXT_COLORS.MUTED
    }).setOrigin(0.5);

    this.createStatsPanel();
    this.createResourcesPanel();
    this.createContractBanner();
    this.createButtons();

    this.cameras.main.fadeIn(500);
  }

  private panel(x: number, y: number, width: number, height: number, title: string): void {
    this.add.rectangle(x, y + height / 2, width, height, COLORS.PANEL_BG).setStrokeStyle(2, COLORS.PANEL_BORDER);
    this.add.text(x, y + 22, title, {
      fontSize: '18px',
      fontFamily: FONTS.HEADER,
      color: '#ffffff'
    }).setOrigin(0.5);
  }

  private createStatsPanel(): void {
    const x = 170;
    const y = 240;
    const width = 280;
    const height = 320;
    this.panel(x, y, width, height, 'STATISTICS');

    const r = this.result;
    const lines = [
      `Waves: ${r.wavesCompleted}/${r.totalWaves}`,
      `Base HP: ${r.baseHealth}/20`,
      `Kills: ${r.enemiesKilled}`,
      `Turrets built: ${r.turretsBuilt}`,
      `To roster: ${r.turretsCollected}`,
      r.turretsLost > 0 ? `Lost: ${r.turretsLost}` : `Lost: 0`,
      `Status: ${r.victory ? 'SUCCESS' : 'FAILED'}`
    ];
    lines.forEach((line, i) => {
      this.add.text(x, y + 60 + i * 30, line, {
        fontSize: '16px',
        fontFamily: FONTS.BODY,
        color: i === lines.length - 1 ? (r.victory ? '#00ff88' : '#ff6666') : TEXT_COLORS.SECONDARY
      }).setOrigin(0.5);
    });
  }

  private createResourcesPanel(): void {
    const x = 520;
    const y = 240;
    const width = 360;
    const height = 320;
    this.panel(x, y, width, height, this.result.victory ? 'EXTRACTED' : 'SALVAGED');

    let yOffset = y + 50;
    const row = (label: string, value: string, color: string) => {
      this.add.text(x - width / 2 + 20, yOffset, label, {
        fontSize: '15px',
        fontFamily: FONTS.BODY,
        color
      }).setOrigin(0, 0.5);
      this.add.text(x + width / 2 - 20, yOffset, value, {
        fontSize: '15px',
        fontFamily: FONTS.HEADER,
        color: TEXT_COLORS.PRIMARY
      }).setOrigin(1, 0.5);
      yOffset += 24;
    };

    row('Energy', `+${this.result.energyEarned}`, '#00ffff');
    if (!this.result.victory) {
      this.add.text(x, yOffset, '(50% salvage, spent materials lost)', {
        fontSize: '12px',
        fontFamily: FONTS.BODY,
        color: '#ff6666'
      }).setOrigin(0.5);
      yOffset += 24;
    }

    Object.entries(this.result.materialsEarned).forEach(([material, amount]) => {
      if (!amount || amount <= 0) return;
      const colorHex = MATERIAL_COLORS[material as MaterialType]?.toString(16).padStart(6, '0') || 'ffffff';
      row(materialName(material), `+${amount}`, `#${colorHex}`);
    });

    if (this.result.victory && this.result.mineEstablished) {
      yOffset += 8;
      this.add.text(x, yOffset, 'NEW MINE', {
        fontSize: '16px',
        fontFamily: FONTS.HEADER,
        color: '#00ff88'
      }).setOrigin(0.5);
      yOffset += 22;
      this.add.text(x, yOffset, this.result.mineEstablished.zoneName, {
        fontSize: '13px',
        fontFamily: FONTS.BODY,
        color: TEXT_COLORS.SECONDARY
      }).setOrigin(0.5);
      yOffset += 22;
      const gen = Object.entries(this.result.mineEstablished.resourceGeneration)
        .filter(([, amount]) => amount && amount > 0)
        .map(([mat, amount]) => `+${amount} ${materialName(mat)}`)
        .join('   ');
      this.add.text(x, yOffset, gen ? `${gen} / wave` : 'No resources in radius', {
        fontSize: '12px',
        fontFamily: FONTS.BODY,
        color: TEXT_COLORS.MUTED,
        wordWrap: { width: width - 30 },
        align: 'center'
      }).setOrigin(0.5, 0);
    } else if (!this.result.victory && !this.result.defendedMineName) {
      yOffset += 8;
      this.add.text(x, yOffset, 'NO MINE ESTABLISHED', {
        fontSize: '16px',
        fontFamily: FONTS.HEADER,
        color: '#ff6666'
      }).setOrigin(0.5);
    }
  }

  private createContractBanner(): void {
    const c = this.result.contract;
    if (!c) return;

    const w = 640;
    const h = 80;
    const x = GAME_WIDTH / 2;
    const y = 640;

    this.add.rectangle(x, y, w, h, c.succeeded ? 0x113322 : 0x331111)
      .setStrokeStyle(2, c.succeeded ? 0x00ff88 : 0xff4444);

    this.add.text(x - w / 2 + 16, y - 24, `CONTRACT - ${c.name.toUpperCase()}`, {
      fontSize: '16px',
      fontFamily: FONTS.HEADER,
      color: '#ffcc44'
    });
    this.add.text(x - w / 2 + 16, y - 2, c.objective, {
      fontSize: '13px',
      fontFamily: FONTS.BODY,
      color: TEXT_COLORS.MUTED
    });

    this.add.text(x + w / 2 - 16, y - 14, c.succeeded ? 'COMPLETED' : 'NOT COMPLETED', {
      fontSize: '18px',
      fontFamily: FONTS.HEADER,
      color: c.succeeded ? '#00ff88' : '#ff6666'
    }).setOrigin(1, 0.5);

    if (c.succeeded) {
      const bonusText = c.bonusMaterial
        ? `+${c.bonusMaterial.amount} ${c.bonusMaterial.type.toUpperCase()}`
        : c.bonusEnergy > 0 ? `+${c.bonusEnergy} ENERGY` : '';
      if (bonusText) {
        this.add.text(x + w / 2 - 16, y + 14, `Bonus: ${bonusText}`, {
          fontSize: '13px',
          fontFamily: FONTS.BODY,
          color: '#ffee88'
        }).setOrigin(1, 0.5);
      }
    }
  }

  private createButtons(): void {
    const buttonY = 780;
    this.createButton(GAME_WIDTH / 2 - 130, buttonY, 'CONTINUE', () => this.scene.start(SCENES.HANGAR));
    this.createButton(GAME_WIDTH / 2 + 130, buttonY, 'MAIN MENU', () => this.scene.start(SCENES.MAIN_MENU));
  }

  private createButton(x: number, y: number, text: string, callback: () => void): void {
    const buttonWidth = 220;
    const buttonHeight = 56;
    const cutSize = 10;

    const btnBg = this.add.graphics();
    const drawButton = (color: number) => {
      btnBg.clear();
      btnBg.fillStyle(color, 1);
      btnBg.fillRect(x - buttonWidth / 2, y - buttonHeight / 2, buttonWidth, buttonHeight);
      btnBg.lineStyle(2, 0x000000, 0.3);
      btnBg.strokeRect(x - buttonWidth / 2 + 2, y - buttonHeight / 2 + 2, buttonWidth - 4, buttonHeight - 4);
      btnBg.fillStyle(this.result.victory ? 0x0a1a0a : 0x1a0a0a, 1);
      btnBg.fillTriangle(
        x - buttonWidth / 2, y - buttonHeight / 2,
        x - buttonWidth / 2 + cutSize, y - buttonHeight / 2,
        x - buttonWidth / 2, y - buttonHeight / 2 + cutSize
      );
      btnBg.fillTriangle(
        x + buttonWidth / 2, y + buttonHeight / 2,
        x + buttonWidth / 2 - cutSize, y + buttonHeight / 2,
        x + buttonWidth / 2, y + buttonHeight / 2 - cutSize
      );
    };
    drawButton(COLORS.PRIMARY);

    this.add.text(x, y, text, {
      fontSize: '18px',
      fontFamily: FONTS.HEADER,
      color: '#000000'
    }).setOrigin(0.5);

    const hitZone = this.add.rectangle(x, y, buttonWidth, buttonHeight, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    hitZone.on('pointerover', () => drawButton(0x44ffaa));
    hitZone.on('pointerout', () => drawButton(COLORS.PRIMARY));
    hitZone.on('pointerup', callback);
  }
}
