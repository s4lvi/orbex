import Phaser from 'phaser';
import { COLORS, GAME_WIDTH, GAME_HEIGHT, BASE_HEALTH, DEPTH, MaterialType, MATERIAL_COLORS, ENERGY_COLOR } from '../utils/Constants';
import { GameScene } from '../scenes/GameScene';
import { Resources } from '../systems/ResourceManager';

export class HUD {
  private scene: GameScene;
  private container: Phaser.GameObjects.Container;

  // Resource displays
  private energyText!: Phaser.GameObjects.Text;
  private carboxText!: Phaser.GameObjects.Text;
  private hydronText!: Phaser.GameObjects.Text;
  private rareText!: Phaser.GameObjects.Text;

  // Wave display
  private waveText!: Phaser.GameObjects.Text;
  private waveProgressBar!: Phaser.GameObjects.Graphics;
  private nextWaveButton!: Phaser.GameObjects.Container;

  // Base health
  private healthText!: Phaser.GameObjects.Text;
  private healthBar!: Phaser.GameObjects.Graphics;

  // Enemy counter
  private enemyCountText!: Phaser.GameObjects.Text;

  constructor(scene: GameScene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0);
    this.container.setDepth(DEPTH.UI);

    this.createTopBar();
    this.createBottomBar();
    this.createNextWaveButton();

    // Listen for events
    this.scene.events.on('resourcesChanged', this.updateResources, this);
    this.scene.events.on('waveStart', this.onWaveStart, this);
    this.scene.events.on('waveComplete', this.onWaveComplete, this);
  }

  private createTopBar(): void {
    // Background - taller for two rows
    const topBg = this.scene.add.rectangle(GAME_WIDTH / 2, 30, GAME_WIDTH, 60, COLORS.PANEL_BG, 0.9);
    this.container.add(topBg);

    // Row 1: Resources - Energy + Carbox + Hydron + Rare (combined)
    const resourceY = 18;
    let resourceX = 15;

    // Energy
    const energyIcon = this.scene.add.circle(resourceX, resourceY, 6, ENERGY_COLOR);
    this.container.add(energyIcon);
    this.energyText = this.scene.add.text(resourceX + 12, resourceY, 'E: 0', {
      fontSize: '13px',
      color: '#00ffff'
    }).setOrigin(0, 0.5);
    this.container.add(this.energyText);

    resourceX += 70;

    // Carbox
    const carboxIcon = this.scene.add.circle(resourceX, resourceY, 6, MATERIAL_COLORS[MaterialType.CARBOX]);
    this.container.add(carboxIcon);
    this.carboxText = this.scene.add.text(resourceX + 12, resourceY, '0', {
      fontSize: '13px',
      color: '#8B4513'
    }).setOrigin(0, 0.5);
    this.container.add(this.carboxText);

    resourceX += 65;

    // Hydron
    const hydronIcon = this.scene.add.circle(resourceX, resourceY, 6, MATERIAL_COLORS[MaterialType.HYDRON]);
    this.container.add(hydronIcon);
    this.hydronText = this.scene.add.text(resourceX + 12, resourceY, '0', {
      fontSize: '13px',
      color: '#4169E1'
    }).setOrigin(0, 0.5);
    this.container.add(this.hydronText);

    resourceX += 65;

    // Rare (combined: titagen, oxyon, plutonia, xitanium, nanon)
    const rareIcon = this.scene.add.circle(resourceX, resourceY, 6, 0x9932CC);
    this.container.add(rareIcon);
    this.rareText = this.scene.add.text(resourceX + 12, resourceY, 'R: 0', {
      fontSize: '13px',
      color: '#9932CC'
    }).setOrigin(0, 0.5);
    this.container.add(this.rareText);

    // Row 2: Wave counter, enemy counter, health
    const row2Y = 42;

    // Wave counter (left)
    this.waveText = this.scene.add.text(80, row2Y, 'Wave: 0/0', {
      fontSize: '16px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0, 0.5);
    this.container.add(this.waveText);

    // Enemy counter (center)
    this.enemyCountText = this.scene.add.text(280, row2Y, 'Enemies: 0', {
      fontSize: '14px',
      color: '#ff6666'
    }).setOrigin(0, 0.5);
    this.container.add(this.enemyCountText);

    // Base health (right side)
    const healthX = GAME_WIDTH - 160;

    this.healthText = this.scene.add.text(healthX, row2Y - 8, `HP: ${BASE_HEALTH}`, {
      fontSize: '13px',
      color: '#00ff88'
    }).setOrigin(0, 0.5);
    this.container.add(this.healthText);

    // Health bar background
    this.healthBar = this.scene.add.graphics();
    this.container.add(this.healthBar);
    this.updateHealthBar(BASE_HEALTH);
  }

  private createBottomBar(): void {
    // Wave progress bar at bottom
    this.waveProgressBar = this.scene.add.graphics();
    this.waveProgressBar.setDepth(DEPTH.UI);
    this.container.add(this.waveProgressBar);
  }

  private createNextWaveButton(): void {
    // Position above the TurretMenu (which is at GAME_HEIGHT - 120)
    this.nextWaveButton = this.scene.add.container(GAME_WIDTH - 100, GAME_HEIGHT - 145);

    const bg = this.scene.add.rectangle(0, 0, 150, 40, COLORS.PRIMARY)
      .setInteractive({ useHandCursor: true });
    this.nextWaveButton.add(bg);

    const text = this.scene.add.text(0, 0, 'NEXT WAVE', {
      fontSize: '16px',
      color: '#000000',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    this.nextWaveButton.add(text);

    bg.on('pointerover', () => bg.setFillStyle(0x44ffaa));
    bg.on('pointerout', () => bg.setFillStyle(COLORS.PRIMARY));
    bg.on('pointerup', () => {
      if (!this.scene.waveManager.isWaveInProgress() && !this.scene.waveManager.isComplete()) {
        this.scene.waveManager.startNextWave();
      }
    });

    this.nextWaveButton.setDepth(DEPTH.UI);
    this.nextWaveButton.setVisible(true);
  }

  public update(): void {
    // Update resources
    this.updateResources(this.scene.resourceManager.getAllResources());

    // Update wave info
    const waveNum = this.scene.waveManager.getCurrentWave();
    const totalWaves = this.scene.waveManager.getTotalWaves();
    this.waveText.setText(`Wave: ${waveNum}/${totalWaves}`);

    // Update enemy count
    const enemyCount = this.scene.enemies.getLength();
    this.enemyCountText.setText(`Enemies: ${enemyCount}`);

    // Update next wave button visibility
    const showButton = !this.scene.waveManager.isWaveInProgress() &&
      !this.scene.waveManager.isComplete() &&
      waveNum < totalWaves;
    this.nextWaveButton.setVisible(showButton);

    // Show countdown if waiting
    if (this.scene.waveManager.isWaitingForNextWave()) {
      const timeLeft = Math.ceil(this.scene.waveManager.getTimeUntilNextWave() / 1000);
      const children = this.nextWaveButton.getAll() as Phaser.GameObjects.GameObject[];
      const textObj = children.find(c => c instanceof Phaser.GameObjects.Text) as Phaser.GameObjects.Text;
      if (textObj) {
        textObj.setText(`NEXT WAVE (${timeLeft}s)`);
      }
    }

    // Update wave progress
    this.updateWaveProgress();
  }

  private updateResources(resources: Resources): void {
    // Energy
    this.energyText.setText(`E: ${Math.floor(resources.energy || 0)}`);

    // Basic materials
    this.carboxText.setText(Math.floor(resources.carbox || 0).toString());
    this.hydronText.setText(Math.floor(resources.hydron || 0).toString());

    // Sum rare materials
    const rare = (resources.titagen || 0) + (resources.oxyon || 0) +
      (resources.plutonia || 0) + (resources.xitanium || 0) +
      (resources.nanon || 0);
    this.rareText.setText(`R: ${Math.floor(rare)}`);
  }

  public updateBaseHealth(health: number): void {
    this.healthText.setText(`HP: ${health}`);
    this.updateHealthBar(health);

    // Flash red when damaged
    if (health < BASE_HEALTH) {
      this.scene.tweens.add({
        targets: this.healthText,
        alpha: 0.3,
        duration: 100,
        yoyo: true,
        repeat: 2
      });
    }
  }

  private updateHealthBar(health: number): void {
    const barX = GAME_WIDTH - 160;
    const barY = 48;
    const barWidth = 120;
    const barHeight = 6;

    this.healthBar.clear();

    // Background
    this.healthBar.fillStyle(0x333333);
    this.healthBar.fillRect(barX, barY, barWidth, barHeight);

    // Health fill
    const healthPercent = health / BASE_HEALTH;
    const healthColor = healthPercent > 0.5 ? 0x00ff88 : healthPercent > 0.25 ? 0xffff00 : 0xff4444;
    this.healthBar.fillStyle(healthColor);
    this.healthBar.fillRect(barX, barY, barWidth * healthPercent, barHeight);
  }

  private updateWaveProgress(): void {
    this.waveProgressBar.clear();

    if (!this.scene.waveManager.isWaveInProgress()) return;

    const progress = this.scene.waveManager.getSpawnProgress();
    const barWidth = GAME_WIDTH * 0.6;
    const barX = (GAME_WIDTH - barWidth) / 2;
    const barY = GAME_HEIGHT - 10;
    const barHeight = 4;

    // Background
    this.waveProgressBar.fillStyle(0x333333);
    this.waveProgressBar.fillRect(barX, barY, barWidth, barHeight);

    // Progress fill
    this.waveProgressBar.fillStyle(COLORS.PRIMARY);
    this.waveProgressBar.fillRect(barX, barY, barWidth * progress, barHeight);
  }

  private onWaveStart(waveNum: number): void {
    // Show wave start notification
    const notification = this.scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 100, `WAVE ${waveNum}`, {
      fontSize: '48px',
      color: '#ff4444',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(DEPTH.UI + 10);

    this.scene.tweens.add({
      targets: notification,
      alpha: 0,
      y: GAME_HEIGHT / 2 - 150,
      duration: 1500,
      ease: 'Power2',
      onComplete: () => notification.destroy()
    });
  }

  private onWaveComplete(_waveNum: number): void {
    // Show wave complete notification
    const notification = this.scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 100, 'WAVE COMPLETE!', {
      fontSize: '36px',
      color: '#00ff88',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(DEPTH.UI + 10);

    this.scene.tweens.add({
      targets: notification,
      alpha: 0,
      y: GAME_HEIGHT / 2 - 150,
      duration: 1500,
      ease: 'Power2',
      onComplete: () => notification.destroy()
    });
  }

  public destroy(): void {
    this.scene.events.off('resourcesChanged', this.updateResources, this);
    this.scene.events.off('waveStart', this.onWaveStart, this);
    this.scene.events.off('waveComplete', this.onWaveComplete, this);
    this.container.destroy();
  }
}
