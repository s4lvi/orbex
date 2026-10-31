import Phaser from 'phaser';
import { SCENES, COLORS, GAME_WIDTH, GAME_HEIGHT, MaterialType, STARTING_BASIC_RESOURCES } from '../utils/Constants';
import { DataLoader } from '../systems/DataLoader';
import { SpriteFactory } from '../utils/SpriteFactory';

export class BootScene extends Phaser.Scene {
  private nextScene: string = SCENES.MAIN_MENU;

  constructor() {
    super({ key: SCENES.BOOT });
  }

  init(data?: { next?: string }): void {
    this.nextScene = data?.next || SCENES.MAIN_MENU;
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

    // All art is procedural; bake it once per boot.
    new SpriteFactory(this).generateAll();
  }

  create(): void {
    DataLoader.init();

    // Persistent keys: only set defaults if PersistenceManager didn't hydrate them.
    this.initIfMissing('sessionResources', () => ({
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
    }));

    this.initIfMissing('researchProgress', () => ({
      completedNodes: [],
      currentlyResearching: null
    }));

    this.initIfMissing('mines', () => []);
    this.initIfMissing('completedDrops', () => 0);

    // Per-session keys: always reset on boot.
    this.registry.set('selectedPlanet', null);
    this.registry.set('selectedZone', null);

    this.scene.start(this.nextScene);
  }

  private initIfMissing(key: string, factory: () => unknown): void {
    if (this.registry.get(key) === undefined) {
      this.registry.set(key, factory());
    }
  }
}
