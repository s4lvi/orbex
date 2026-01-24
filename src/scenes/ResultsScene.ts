import Phaser from 'phaser';
import { SCENES, COLORS, GAME_WIDTH, GAME_HEIGHT } from '../utils/Constants';
import { PlayerStats } from './HangarScene';

interface GameResult {
  victory: boolean;
  resources: { [key: string]: number };
  wavesCompleted: number;
  baseHealth: number;
  enemiesKilled: number;
  turretsBuilt: number;
}

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

    // Background
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT,
      this.result.victory ? 0x0a1a0a : 0x1a0a0a);

    // Title
    const title = this.result.victory ? 'EXTRACTION COMPLETE' : 'EXTRACTION FAILED';
    const titleColor = this.result.victory ? '#00ff88' : '#ff4444';

    this.add.text(GAME_WIDTH / 2, 80, title, {
      fontSize: '56px',
      fontFamily: 'Arial',
      color: titleColor,
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Subtitle
    const subtitle = this.result.victory
      ? 'Resources secured!'
      : 'Resources partially lost...';
    this.add.text(GAME_WIDTH / 2, 140, subtitle, {
      fontSize: '24px',
      fontFamily: 'Arial',
      color: '#888888'
    }).setOrigin(0.5);

    // Stats panel
    this.createStatsPanel();

    // Resources panel
    this.createResourcesPanel();

    // Update session resources
    this.updateSessionResources();

    // Buttons
    this.createButtons();

    // Animate entrance
    this.cameras.main.fadeIn(500);
  }

  private createStatsPanel(): void {
    const panelX = GAME_WIDTH / 2 - 250;
    const panelY = 220;
    const panelWidth = 200;
    const panelHeight = 150;

    // Panel background
    this.add.rectangle(panelX, panelY + panelHeight / 2, panelWidth, panelHeight, COLORS.PANEL_BG)
      .setStrokeStyle(2, COLORS.PANEL_BORDER);

    this.add.text(panelX, panelY + 20, 'STATISTICS', {
      fontSize: '20px',
      fontFamily: 'Arial',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const stats = [
      `Waves: ${this.result.wavesCompleted}`,
      `Base HP: ${this.result.baseHealth}/20`,
      `Status: ${this.result.victory ? 'SUCCESS' : 'FAILED'}`
    ];

    stats.forEach((stat, index) => {
      this.add.text(panelX, panelY + 60 + index * 30, stat, {
        fontSize: '16px',
        fontFamily: 'Arial',
        color: '#aaaaaa'
      }).setOrigin(0.5);
    });
  }

  private createResourcesPanel(): void {
    const panelX = GAME_WIDTH / 2 + 100;
    const panelY = 200;
    const panelWidth = 400;
    const panelHeight = 300;

    // Panel background
    this.add.rectangle(panelX, panelY + panelHeight / 2, panelWidth, panelHeight, COLORS.PANEL_BG)
      .setStrokeStyle(2, COLORS.PANEL_BORDER);

    this.add.text(panelX, panelY + 20, 'RESOURCES GAINED', {
      fontSize: '20px',
      fontFamily: 'Arial',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    if (!this.result.victory) {
      this.add.text(panelX, panelY + 50, '(50% penalty applied)', {
        fontSize: '14px',
        fontFamily: 'Arial',
        color: '#ff6666'
      }).setOrigin(0.5);
    }

    const resourceNames: { [key: string]: string } = {
      minerals: 'Minerals',
      energy: 'Energy',
      alloys: 'Alloys',
      plasma: 'Plasma',
      crystals: 'Crystals',
      darkMatter: 'Dark Matter',
      antimatter: 'Antimatter',
      quantumFlux: 'Quantum Flux'
    };

    const resourceColors: { [key: string]: string } = {
      minerals: '#8888ff',
      energy: '#ffff00',
      alloys: '#888888',
      plasma: '#ff00ff',
      crystals: '#00ffff',
      darkMatter: '#aa00aa',
      antimatter: '#ff0000',
      quantumFlux: '#00ff00'
    };

    let yOffset = 80;
    Object.entries(this.result.resources).forEach(([key, value]) => {
      if (value > 0) {
        const name = resourceNames[key] || key;
        const color = resourceColors[key] || '#ffffff';

        this.add.text(panelX - 80, panelY + yOffset, name, {
          fontSize: '16px',
          fontFamily: 'Arial',
          color: color
        }).setOrigin(0, 0.5);

        this.add.text(panelX + 100, panelY + yOffset, `+${value}`, {
          fontSize: '16px',
          fontFamily: 'Arial',
          color: '#00ff88'
        }).setOrigin(1, 0.5);

        yOffset += 28;
      }
    });
  }

  private updateSessionResources(): void {
    const sessionResources = this.registry.get('sessionResources');

    // Add drop resources to session
    Object.entries(this.result.resources).forEach(([key, value]) => {
      if (sessionResources[key] !== undefined) {
        sessionResources[key] += value;
      }
    });

    this.registry.set('sessionResources', sessionResources);

    // Update completed drops count
    if (this.result.victory) {
      const completedDrops = this.registry.get('completedDrops') || 0;
      this.registry.set('completedDrops', completedDrops + 1);
    }

    // Update player stats
    this.updatePlayerStats();
  }

  private updatePlayerStats(): void {
    const savedStats = this.registry.get('playerStats');
    const stats: PlayerStats = savedStats || {
      totalDrops: 0,
      successfulDrops: 0,
      failedDrops: 0,
      enemiesKilled: 0,
      turretsBuilt: 0,
      wavesCompleted: 0,
    };

    stats.totalDrops++;
    if (this.result.victory) {
      stats.successfulDrops++;
    } else {
      stats.failedDrops++;
    }
    stats.enemiesKilled += this.result.enemiesKilled || 0;
    stats.turretsBuilt += this.result.turretsBuilt || 0;
    stats.wavesCompleted += this.result.wavesCompleted || 0;

    this.registry.set('playerStats', stats);
  }

  private createButtons(): void {
    const buttonY = 550;

    // Continue button
    this.createButton(GAME_WIDTH / 2 - 140, buttonY, 'CONTINUE', () => {
      this.scene.start(SCENES.HANGAR);
    });

    // Main Menu button
    this.createButton(GAME_WIDTH / 2 + 140, buttonY, 'MAIN MENU', () => {
      this.scene.start(SCENES.MAIN_MENU);
    });
  }

  private createButton(x: number, y: number, text: string, callback: () => void): void {
    const buttonWidth = 200;
    const buttonHeight = 50;
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
      fontFamily: 'Arial',
      color: '#000000',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const hitZone = this.add.rectangle(x, y, buttonWidth, buttonHeight, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });

    hitZone.on('pointerover', () => drawButton(0x44ffaa));
    hitZone.on('pointerout', () => drawButton(COLORS.PRIMARY));
    hitZone.on('pointerup', callback);
  }
}
