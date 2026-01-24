import Phaser from 'phaser';
import { SCENES, COLORS, GAME_WIDTH, GAME_HEIGHT, TILE_SIZE, MaterialType, STARTING_BASIC_RESOURCES } from '../utils/Constants';
import { DataLoader } from '../systems/DataLoader';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENES.BOOT });
  }

  preload(): void {
    // Create loading bar
    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(COLORS.PANEL_BG, 0.8);
    progressBox.fillRect(GAME_WIDTH / 2 - 160, GAME_HEIGHT / 2 - 25, 320, 50);

    const loadingText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50, 'Loading...', {
      fontSize: '24px',
      color: '#ffffff'
    }).setOrigin(0.5);

    this.load.on('progress', (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(COLORS.PRIMARY, 1);
      progressBar.fillRect(GAME_WIDTH / 2 - 150, GAME_HEIGHT / 2 - 15, 300 * value, 30);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
    });

    // Generate procedural graphics as textures
    this.generateTextures();
  }

  create(): void {
    // Initialize DataLoader (loads JSON configuration)
    DataLoader.init();

    // Initialize game registry with new resource format (Energy + Materials)
    this.registry.set('sessionResources', {
      energy: 0,
      materials: {
        [MaterialType.CARBOX]: STARTING_BASIC_RESOURCES,
        [MaterialType.HYDRON]: STARTING_BASIC_RESOURCES,
        [MaterialType.TITAGEN]: 0,
        [MaterialType.OXYON]: 0,
        [MaterialType.PLUTONIA]: 0,
        [MaterialType.XITANIUM]: 0,
        [MaterialType.NANON]: 0
      }
    });

    // Initialize research progress
    this.registry.set('researchProgress', {
      completedNodes: [],
      currentlyResearching: null
    });

    // Initialize mines (extraction sites from successful drops)
    this.registry.set('mines', []);

    this.registry.set('selectedPlanet', null);
    this.registry.set('selectedZone', null);
    this.registry.set('completedDrops', 0);

    // Transition to main menu
    this.scene.start(SCENES.MAIN_MENU);
  }

  private generateTextures(): void {
    // Generate enemy textures
    this.generateCircleTexture('enemy-drone', 16, 0xff4444);
    this.generateCircleTexture('enemy-soldier', 20, 0xff6666);
    this.generateCircleTexture('enemy-tank', 28, 0x884444);
    this.generateCircleTexture('enemy-speeder', 14, 0xff8888);
    this.generateDiamondTexture('enemy-flyer', 18, 0xffaaaa);
    this.generateCircleTexture('enemy-teleporter', 16, 0xaa44ff);
    this.generateCircleTexture('enemy-spawner', 24, 0x44ff44);
    this.generateCircleTexture('enemy-boss', 40, 0xff0000);

    // Generate turret textures
    this.generateSquareTexture('turret-machinegun', TILE_SIZE - 8, 0x888888);
    this.generateSquareTexture('turret-laser', TILE_SIZE - 8, 0xff6600);
    this.generateSquareTexture('turret-cryo', TILE_SIZE - 8, 0x00ccff);
    this.generateSquareTexture('turret-tesla', TILE_SIZE - 8, 0xffff00);
    this.generateSquareTexture('turret-missile', TILE_SIZE - 8, 0xff3300);
    this.generateSquareTexture('turret-railgun', TILE_SIZE - 8, 0x00ff00);
    this.generateSquareTexture('turret-plasma', TILE_SIZE - 8, 0xff00ff);

    // Generate projectile textures
    this.generateCircleTexture('projectile-bullet', 4, 0xffffff);
    this.generateCircleTexture('projectile-laser', 6, 0xff6600);
    this.generateCircleTexture('projectile-cryo', 6, 0x00ccff);
    this.generateCircleTexture('projectile-electric', 8, 0xffff00);
    this.generateCircleTexture('projectile-missile', 8, 0xff3300);
    this.generateCircleTexture('projectile-railgun', 10, 0x00ff00);
    this.generateCircleTexture('projectile-plasma', 10, 0xff00ff);

    // Generate trap textures
    this.generateTriangleTexture('trap-spike', 24, 0xaaaaaa);
    this.generateCircleTexture('trap-slowfield', 32, 0x4444ff);
    this.generateCircleTexture('trap-mine', 20, 0xff4444);
    this.generateCircleTexture('trap-emp', 28, 0xffff44);
    this.generateCircleTexture('trap-fire', 28, 0xff6600);

    // Generate tile textures
    this.generateSquareTexture('tile-ground', TILE_SIZE, COLORS.TILE_GROUND);
    this.generateSquareTexture('tile-path', TILE_SIZE, COLORS.TILE_PATH);
    this.generateSquareTexture('tile-buildable', TILE_SIZE, COLORS.TILE_BUILDABLE);

    // Generate UI textures
    this.generateSquareTexture('button', 200, COLORS.PRIMARY);
    this.generateSquareTexture('panel', 100, COLORS.PANEL_BG);

    // Generate base texture
    this.generateSquareTexture('base', TILE_SIZE * 2, 0x00ff88);
  }

  private generateCircleTexture(key: string, radius: number, color: number): void {
    const graphics = this.make.graphics({ x: 0, y: 0 });
    graphics.fillStyle(color, 1);
    graphics.fillCircle(radius, radius, radius);
    graphics.generateTexture(key, radius * 2, radius * 2);
    graphics.destroy();
  }

  private generateSquareTexture(key: string, size: number, color: number): void {
    const graphics = this.make.graphics({ x: 0, y: 0 });
    graphics.fillStyle(color, 1);
    graphics.fillRect(0, 0, size, size);
    graphics.lineStyle(2, 0x000000, 0.3);
    graphics.strokeRect(0, 0, size, size);
    graphics.generateTexture(key, size, size);
    graphics.destroy();
  }

  private generateDiamondTexture(key: string, size: number, color: number): void {
    const graphics = this.make.graphics({ x: 0, y: 0 });
    graphics.fillStyle(color, 1);
    graphics.beginPath();
    graphics.moveTo(size, 0);
    graphics.lineTo(size * 2, size);
    graphics.lineTo(size, size * 2);
    graphics.lineTo(0, size);
    graphics.closePath();
    graphics.fillPath();
    graphics.generateTexture(key, size * 2, size * 2);
    graphics.destroy();
  }

  private generateTriangleTexture(key: string, size: number, color: number): void {
    const graphics = this.make.graphics({ x: 0, y: 0 });
    graphics.fillStyle(color, 1);
    graphics.beginPath();
    graphics.moveTo(size / 2, 0);
    graphics.lineTo(size, size);
    graphics.lineTo(0, size);
    graphics.closePath();
    graphics.fillPath();
    graphics.generateTexture(key, size, size);
    graphics.destroy();
  }
}
