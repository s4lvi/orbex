import Phaser from 'phaser';
import {
  COLORS, GAME_WIDTH, GAME_HEIGHT, BASE_HEALTH, DEPTH,
  MaterialType, MATERIAL_COLORS, ENERGY_COLOR, FONTS, TEXT_COLORS, UI_INSETS
} from '../utils/Constants';
import { GameScene } from '../scenes/GameScene';
import { Resources } from '../systems/ResourceManager';

/**
 * In-mission heads-up display: resources, wave info, base health, drop
 * modifiers, contract progress, and the wave / pause / speed controls.
 */
export class HUD {
  private scene: GameScene;
  private container: Phaser.GameObjects.Container;

  private energyText!: Phaser.GameObjects.Text;
  private carboxText!: Phaser.GameObjects.Text;
  private hydronText!: Phaser.GameObjects.Text;
  private rareText!: Phaser.GameObjects.Text;

  private waveText!: Phaser.GameObjects.Text;
  private waveProgressBar!: Phaser.GameObjects.Graphics;
  private nextWaveButton!: Phaser.GameObjects.Container;
  private nextWaveLabel!: Phaser.GameObjects.Text;
  private nextWaveSublabel!: Phaser.GameObjects.Text;
  private pauseLabel!: Phaser.GameObjects.Text;
  private speedLabel!: Phaser.GameObjects.Text;

  private healthText!: Phaser.GameObjects.Text;
  private healthBar!: Phaser.GameObjects.Graphics;
  private enemyCountText!: Phaser.GameObjects.Text;
  private contractText: Phaser.GameObjects.Text | null = null;
  /** Screen rects of the control buttons, so clicks on them never reach the map. */
  private controlBounds: Phaser.Geom.Rectangle[] = [];

  constructor(scene: GameScene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0);
    this.container.setDepth(DEPTH.UI);
    this.container.setScrollFactor(0);

    this.createTopBar();
    this.createControlButtons();
    this.createWaveProgressBar();
    this.createModifierPills();
    this.createContractBanner();

    this.scene.events.on('resourcesChanged', this.updateResources, this);
    this.scene.events.on('waveStart', this.onWaveStart, this);
    this.scene.events.on('waveComplete', this.onWaveComplete, this);
    this.scene.events.on('pauseChanged', this.refreshControlLabels, this);
    this.scene.events.on('speedChanged', this.refreshControlLabels, this);

    this.updateResources(this.scene.resourceManager.getAllResources());
  }

  public getTopBarBounds(): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(0, 0, GAME_WIDTH, UI_INSETS.top);
  }

  public getControlBounds(): Phaser.Geom.Rectangle[] {
    return this.controlBounds;
  }

  private createTopBar(): void {
    const panelHeight = UI_INSETS.top;
    const cutSize = 15;

    const topBg = this.scene.add.graphics();
    topBg.fillStyle(COLORS.PANEL_BG, 0.95);
    topBg.beginPath();
    topBg.moveTo(cutSize, 0);
    topBg.lineTo(GAME_WIDTH - cutSize, 0);
    topBg.lineTo(GAME_WIDTH, cutSize);
    topBg.lineTo(GAME_WIDTH, panelHeight);
    topBg.lineTo(0, panelHeight);
    topBg.lineTo(0, cutSize);
    topBg.closePath();
    topBg.fillPath();
    topBg.lineStyle(2, COLORS.PRIMARY, 0.8);
    topBg.strokePath();
    this.container.add(topBg);

    // Resources
    const leftSectionX = 15;
    const sectionLabel = this.scene.add.text(leftSectionX, 8, 'RESOURCES', {
      fontSize: '10px',
      fontFamily: FONTS.HEADER,
      color: TEXT_COLORS.DIM
    });
    this.container.add(sectionLabel);

    let resourceX = leftSectionX;
    const resourceY = 32;

    const energyIcon = this.scene.add.graphics();
    energyIcon.fillStyle(ENERGY_COLOR, 1);
    energyIcon.fillCircle(resourceX + 8, resourceY, 8);
    energyIcon.lineStyle(2, 0xffffff, 0.3);
    energyIcon.strokeCircle(resourceX + 8, resourceY, 8);
    this.container.add(energyIcon);

    this.energyText = this.scene.add.text(resourceX + 22, resourceY, '0', {
      fontSize: '18px',
      fontFamily: FONTS.HEADER,
      color: '#00ffff'
    }).setOrigin(0, 0.5);
    this.container.add(this.energyText);
    resourceX += 80;

    const carboxIcon = this.scene.add.graphics();
    carboxIcon.fillStyle(MATERIAL_COLORS[MaterialType.CARBOX], 1);
    carboxIcon.fillRoundedRect(resourceX, resourceY - 7, 14, 14, 3);
    this.container.add(carboxIcon);
    this.carboxText = this.scene.add.text(resourceX + 20, resourceY, '0', {
      fontSize: '16px',
      fontFamily: FONTS.BODY,
      color: '#CD853F'
    }).setOrigin(0, 0.5);
    this.container.add(this.carboxText);
    resourceX += 70;

    const hydronIcon = this.scene.add.graphics();
    hydronIcon.fillStyle(MATERIAL_COLORS[MaterialType.HYDRON], 1);
    hydronIcon.fillRoundedRect(resourceX, resourceY - 7, 14, 14, 3);
    this.container.add(hydronIcon);
    this.hydronText = this.scene.add.text(resourceX + 20, resourceY, '0', {
      fontSize: '16px',
      fontFamily: FONTS.BODY,
      color: '#6495ED'
    }).setOrigin(0, 0.5);
    this.container.add(this.hydronText);
    resourceX += 70;

    const rareIcon = this.scene.add.graphics();
    rareIcon.fillStyle(0x9932cc, 1);
    rareIcon.fillTriangle(resourceX + 7, resourceY - 7, resourceX + 14, resourceY + 7, resourceX, resourceY + 7);
    this.container.add(rareIcon);
    this.rareText = this.scene.add.text(resourceX + 20, resourceY, '0', {
      fontSize: '16px',
      fontFamily: FONTS.BODY,
      color: '#BA55D3'
    }).setOrigin(0, 0.5);
    this.container.add(this.rareText);

    // Wave info
    const centerX = GAME_WIDTH / 2;
    this.waveText = this.scene.add.text(centerX, 72, 'WAVE 0/0', {
      fontSize: '22px',
      fontFamily: FONTS.HEADER,
      color: TEXT_COLORS.PRIMARY
    }).setOrigin(0.5);
    this.container.add(this.waveText);

    this.enemyCountText = this.scene.add.text(centerX, 98, 'ENEMIES: 0', {
      fontSize: '14px',
      fontFamily: FONTS.BODY,
      color: '#ff6666'
    }).setOrigin(0.5);
    this.container.add(this.enemyCountText);

    // Base health
    const rightX = GAME_WIDTH - 20;
    const baseLabel = this.scene.add.text(rightX, 8, 'BASE', {
      fontSize: '10px',
      fontFamily: FONTS.HEADER,
      color: TEXT_COLORS.DIM
    }).setOrigin(1, 0);
    this.container.add(baseLabel);

    this.healthText = this.scene.add.text(rightX, 28, `${BASE_HEALTH}`, {
      fontSize: '28px',
      fontFamily: FONTS.HEADER,
      color: TEXT_COLORS.PRIMARY
    }).setOrigin(1, 0);
    this.container.add(this.healthText);

    const barWidth = 120;
    const barHeight = 10;
    const barX = rightX - barWidth;
    const barY = 62;
    const healthBarBg = this.scene.add.graphics();
    healthBarBg.fillStyle(0x333344, 1);
    healthBarBg.fillRoundedRect(barX, barY, barWidth, barHeight, 3);
    healthBarBg.lineStyle(1, COLORS.PANEL_BORDER, 1);
    healthBarBg.strokeRoundedRect(barX, barY, barWidth, barHeight, 3);
    this.container.add(healthBarBg);

    this.healthBar = this.scene.add.graphics();
    this.container.add(this.healthBar);
    this.updateHealthBar(BASE_HEALTH);
  }

  /** NEXT WAVE (right), PAUSE and SPEED (left) sit just above the build bar. */
  private createControlButtons(): void {
    const y = GAME_HEIGHT - UI_INSETS.bottom - 26;

    this.nextWaveButton = this.createButton(GAME_WIDTH - 100, y, 160, 45, 'NEXT WAVE', 'SPACE', COLORS.PRIMARY, () => {
      if (this.scene.isGamePaused()) return;
      this.scene.waveManager.startNextWave();
    });
    this.nextWaveLabel = this.nextWaveButton.getData('label') as Phaser.GameObjects.Text;
    this.nextWaveSublabel = this.nextWaveButton.getData('sublabel') as Phaser.GameObjects.Text;

    const pauseButton = this.createButton(55, y, 80, 45, 'PAUSE', 'P', 0x445566, () => this.scene.togglePause());
    this.pauseLabel = pauseButton.getData('label') as Phaser.GameObjects.Text;

    const speedButton = this.createButton(145, y, 80, 45, '1x', 'F', 0x445566, () => this.scene.toggleGameSpeed());
    this.speedLabel = speedButton.getData('label') as Phaser.GameObjects.Text;

    this.refreshControlLabels();
  }

  private createButton(
    x: number, y: number, width: number, height: number,
    label: string, sublabel: string, fillColor: number, onClick: () => void
  ): Phaser.GameObjects.Container {
    const cutSize = 10;
    const button = this.scene.add.container(x, y);
    button.setDepth(DEPTH.UI);
    button.setScrollFactor(0);
    this.controlBounds.push(new Phaser.Geom.Rectangle(x - width / 2, y - height / 2, width, height));

    const bg = this.scene.add.graphics();
    const draw = (color: number) => {
      bg.clear();
      bg.fillStyle(color, 1);
      bg.beginPath();
      bg.moveTo(-width / 2 + cutSize, -height / 2);
      bg.lineTo(width / 2 - cutSize, -height / 2);
      bg.lineTo(width / 2, -height / 2 + cutSize);
      bg.lineTo(width / 2, height / 2);
      bg.lineTo(-width / 2, height / 2);
      bg.lineTo(-width / 2, -height / 2 + cutSize);
      bg.closePath();
      bg.fillPath();
      bg.lineStyle(2, 0x000000, 0.3);
      bg.strokePath();
    };
    draw(fillColor);
    button.add(bg);

    const dark = fillColor === COLORS.PRIMARY;
    const text = this.scene.add.text(0, -3, label, {
      fontSize: '16px',
      fontFamily: FONTS.HEADER,
      color: dark ? '#000000' : '#ffffff'
    }).setOrigin(0.5);
    button.add(text);

    const sub = this.scene.add.text(0, 12, sublabel, {
      fontSize: '10px',
      fontFamily: FONTS.BODY,
      color: dark ? '#004422' : TEXT_COLORS.SECONDARY
    }).setOrigin(0.5);
    button.add(sub);

    const hitArea = this.scene.add.rectangle(0, 0, width, height, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    button.add(hitArea);
    hitArea.on('pointerover', () => draw(dark ? 0x44ffaa : 0x667788));
    hitArea.on('pointerout', () => draw(fillColor));
    hitArea.on('pointerup', onClick);

    button.setData('label', text);
    button.setData('sublabel', sub);
    this.container.add(button);
    return button;
  }

  private refreshControlLabels(): void {
    this.pauseLabel.setText(this.scene.isGamePaused() ? 'RESUME' : 'PAUSE');
    this.speedLabel.setText(`${this.scene.getGameSpeed()}x`);
  }

  private createWaveProgressBar(): void {
    this.waveProgressBar = this.scene.add.graphics();
    this.waveProgressBar.setDepth(DEPTH.UI);
    this.container.add(this.waveProgressBar);
  }

  /** Active drop modifiers as a row of pills under the top bar. */
  private createModifierPills(): void {
    const mods = this.scene.activeModifiers;
    if (!mods || mods.length === 0) return;

    const pillY = 56;
    let pillX = 15;
    for (let i = 0; i < mods.length; i++) {
      const mod = mods[i];
      const text = this.scene.add.text(0, 0, mod.shortName, {
        fontSize: '12px',
        fontFamily: FONTS.HEADER,
        color: '#000000',
        backgroundColor: mod.color,
        padding: { left: 8, right: 8, top: 4, bottom: 4 }
      });
      const w = text.width;
      const thisX = pillX;
      text.setPosition(thisX, pillY);
      this.container.add(text);

      text.setInteractive({ useHandCursor: true });
      let tooltip: Phaser.GameObjects.Text | null = null;
      text.on('pointerover', () => {
        tooltip = this.scene.add.text(thisX, UI_INSETS.top + 6, `${mod.name}: ${mod.description}`, {
          fontSize: '11px',
          fontFamily: FONTS.BODY,
          color: '#ffffff',
          backgroundColor: '#000000',
          padding: { left: 6, right: 6, top: 4, bottom: 4 },
          wordWrap: { width: 300 }
        }).setScrollFactor(0).setDepth(DEPTH.UI + 1).setOrigin(0, 0);
        this.scene.getCameraManager().addUIObject(tooltip);
      });
      text.on('pointerout', () => {
        tooltip?.destroy();
        tooltip = null;
      });

      pillX += w + 6;
    }
  }

  private createContractBanner(): void {
    const c = this.scene.activeContract;
    if (!c || c.id === 'STANDARD') return;

    this.contractText = this.scene.add.text(15, 88, '', {
      fontSize: '11px',
      fontFamily: FONTS.HEADER,
      color: '#ffcc44',
      backgroundColor: 'rgba(0,0,0,0.55)',
      padding: { left: 8, right: 8, top: 4, bottom: 4 }
    }).setOrigin(0, 0);
    this.container.add(this.contractText);
    this.refreshContractBanner();
  }

  private refreshContractBanner(): void {
    if (!this.contractText) return;
    const c = this.scene.activeContract;
    const p = this.scene.contractProgress;
    let progress = '';
    switch (c.id) {
      case 'SURVEY':
        progress = p.failed ? 'FAILED' : 'no base damage so far';
        break;
      case 'BOUNTY':
        progress = `${p.eliteKills}/5 elites`;
        break;
      case 'PURIST':
        progress = p.failed ? 'FAILED' : `${p.turretsBuilt}/3 turrets`;
        break;
      case 'ENDURANCE':
        progress = 'extended waves';
        break;
    }
    this.contractText.setColor(p.failed ? '#ff6666' : '#ffcc44');
    this.contractText.setText(`${c.name.toUpperCase()} - ${progress}`);
  }

  public update(): void {
    this.refreshContractBanner();

    const wm = this.scene.waveManager;
    const waveNum = wm.getCurrentWave();
    const totalWaves = wm.getTotalWaves();
    this.waveText.setText(`WAVE ${waveNum}/${totalWaves}`);

    const enemyCount = this.scene.enemies.getLength();
    this.enemyCountText.setText(`ENEMIES: ${enemyCount}`);
    this.enemyCountText.setColor(enemyCount > 10 ? '#ff4444' : enemyCount > 5 ? '#ffaa44' : '#ff6666');

    const showButton = !wm.isWaveInProgress() && !wm.isComplete() && waveNum < totalWaves;
    this.nextWaveButton.setVisible(showButton);
    if (wm.isWaitingForNextWave()) {
      this.nextWaveLabel.setText('NEXT WAVE');
      this.nextWaveSublabel.setText(`auto in ${Math.ceil(wm.getTimeUntilNextWave() / 1000)}s`);
    } else {
      this.nextWaveLabel.setText(waveNum === 0 ? 'START' : 'NEXT WAVE');
      this.nextWaveSublabel.setText('SPACE');
    }

    this.updateWaveProgress();
  }

  private updateResources(resources: Resources): void {
    this.energyText.setText(Math.floor(resources.energy || 0).toString());
    this.carboxText.setText(Math.floor(resources.carbox || 0).toString());
    this.hydronText.setText(Math.floor(resources.hydron || 0).toString());
    const rare = (resources.titagen || 0) + (resources.oxyon || 0) + (resources.plutonia || 0)
      + (resources.xitanium || 0) + (resources.nanon || 0);
    this.rareText.setText(Math.floor(rare).toString());
  }

  public updateBaseHealth(health: number): void {
    this.healthText.setText(health.toString());
    const percent = health / BASE_HEALTH;
    this.healthText.setColor(percent > 0.5 ? TEXT_COLORS.PRIMARY : percent > 0.25 ? '#ffaa00' : '#ff4444');
    this.updateHealthBar(health);

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
    const barWidth = 120;
    const barHeight = 10;
    const barX = GAME_WIDTH - 20 - barWidth;
    const barY = 62;

    this.healthBar.clear();
    const healthPercent = Math.max(0, health / BASE_HEALTH);
    const healthColor = healthPercent > 0.5 ? 0x00ff88 : healthPercent > 0.25 ? 0xffaa00 : 0xff4444;
    this.healthBar.fillStyle(healthColor);
    this.healthBar.fillRoundedRect(barX + 2, barY + 2, (barWidth - 4) * healthPercent, barHeight - 4, 2);
  }

  private updateWaveProgress(): void {
    this.waveProgressBar.clear();
    if (!this.scene.waveManager.isWaveInProgress()) return;

    const progress = this.scene.waveManager.getSpawnProgress();
    const barWidth = GAME_WIDTH - 40;
    const barX = 20;
    const barY = GAME_HEIGHT - 8;
    const barHeight = 4;

    this.waveProgressBar.fillStyle(0x333344, 1);
    this.waveProgressBar.fillRect(barX, barY, barWidth, barHeight);
    this.waveProgressBar.fillStyle(COLORS.PRIMARY, 1);
    this.waveProgressBar.fillRect(barX, barY, barWidth * progress, barHeight);
  }

  private showBanner(main: string, sub: string, borderColor: number, mainColor: string): void {
    const notification = this.scene.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 100);
    notification.setDepth(DEPTH.UI + 10);
    notification.setScrollFactor(0);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.8);
    bg.fillRect(-150, -40, 300, 80);
    bg.lineStyle(2, borderColor, 1);
    bg.strokeRect(-150, -40, 300, 80);
    notification.add(bg);

    notification.add(this.scene.add.text(0, -10, main, {
      fontSize: '32px',
      fontFamily: FONTS.HEADER,
      color: mainColor
    }).setOrigin(0.5));
    notification.add(this.scene.add.text(0, 20, sub, {
      fontSize: '14px',
      fontFamily: FONTS.BODY,
      color: TEXT_COLORS.SECONDARY
    }).setOrigin(0.5));
    this.scene.getCameraManager().addUIObject(notification);

    this.scene.tweens.add({
      targets: notification,
      alpha: 0,
      y: GAME_HEIGHT / 2 - 150,
      duration: 1500,
      ease: 'Power2',
      onComplete: () => notification.destroy()
    });
  }

  private onWaveStart(waveNum: number): void {
    this.showBanner(`WAVE ${waveNum}`, 'INCOMING', COLORS.DANGER, '#ff4444');
  }

  private onWaveComplete(): void {
    this.showBanner('WAVE CLEAR', 'RESUPPLY INCOMING', COLORS.PRIMARY, TEXT_COLORS.PRIMARY);
  }

  public getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  public destroy(): void {
    this.scene.events.off('resourcesChanged', this.updateResources, this);
    this.scene.events.off('waveStart', this.onWaveStart, this);
    this.scene.events.off('waveComplete', this.onWaveComplete, this);
    this.scene.events.off('pauseChanged', this.refreshControlLabels, this);
    this.scene.events.off('speedChanged', this.refreshControlLabels, this);
    this.container.destroy();
  }
}
