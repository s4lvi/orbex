import Phaser from "phaser";
import {
  COLORS,
  GAME_WIDTH,
  GAME_HEIGHT,
  BASE_HEALTH,
  DEPTH,
  MaterialType,
  MATERIAL_COLORS,
  ENERGY_COLOR,
  FONTS,
  TEXT_COLORS,
} from "../utils/Constants";
import { GameScene } from "../scenes/GameScene";
import { Resources } from "../systems/ResourceManager";

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
  private healthBarBg!: Phaser.GameObjects.Graphics;

  // Enemy counter
  private enemyCountText!: Phaser.GameObjects.Text;

  constructor(scene: GameScene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0);
    this.container.setDepth(DEPTH.UI);

    this.createTopBar();
    this.createNextWaveButton();
    this.createWaveProgressBar();

    // Listen for events
    this.scene.events.on("resourcesChanged", this.updateResources, this);
    this.scene.events.on("waveStart", this.onWaveStart, this);
    this.scene.events.on("waveComplete", this.onWaveComplete, this);
  }

  private createTopBar(): void {
    // Main background panel with industrial cut corners
    const panelHeight = 130;
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

    // Border
    topBg.lineStyle(2, COLORS.PRIMARY, 0.8);
    topBg.beginPath();
    topBg.moveTo(cutSize, 0);
    topBg.lineTo(GAME_WIDTH - cutSize, 0);
    topBg.lineTo(GAME_WIDTH, cutSize);
    topBg.lineTo(GAME_WIDTH, panelHeight);
    topBg.lineTo(0, panelHeight);
    topBg.lineTo(0, cutSize);
    topBg.closePath();
    topBg.strokePath();
    this.container.add(topBg);

    // === LEFT SECTION: Resources ===
    const leftSectionX = 15;

    // Section label
    this.scene.add.text(leftSectionX, 8, "RESOURCES", {
      fontSize: "10px",
      fontFamily: FONTS.HEADER,
      color: TEXT_COLORS.DIM,
    });
    this.container.add(this.container.last!);

    // Resource row
    let resourceX = leftSectionX;
    const resourceY = 32;

    // Energy with icon
    const energyIcon = this.scene.add.graphics();
    energyIcon.fillStyle(ENERGY_COLOR, 1);
    energyIcon.fillCircle(resourceX + 8, resourceY, 8);
    energyIcon.lineStyle(2, 0xffffff, 0.3);
    energyIcon.strokeCircle(resourceX + 8, resourceY, 8);
    this.container.add(energyIcon);

    this.energyText = this.scene.add
      .text(resourceX + 22, resourceY, "0", {
        fontSize: "18px",
        fontFamily: FONTS.HEADER,
        color: "#00ffff",
      })
      .setOrigin(0, 0.5);
    this.container.add(this.energyText);

    resourceX += 80;

    // Carbox
    const carboxIcon = this.scene.add.graphics();
    carboxIcon.fillStyle(MATERIAL_COLORS[MaterialType.CARBOX], 1);
    carboxIcon.fillRoundedRect(resourceX, resourceY - 7, 14, 14, 3);
    this.container.add(carboxIcon);

    this.carboxText = this.scene.add
      .text(resourceX + 20, resourceY, "0", {
        fontSize: "16px",
        fontFamily: FONTS.BODY,
        color: "#CD853F",
      })
      .setOrigin(0, 0.5);
    this.container.add(this.carboxText);

    resourceX += 70;

    // Hydron
    const hydronIcon = this.scene.add.graphics();
    hydronIcon.fillStyle(MATERIAL_COLORS[MaterialType.HYDRON], 1);
    hydronIcon.fillRoundedRect(resourceX, resourceY - 7, 14, 14, 3);
    this.container.add(hydronIcon);

    this.hydronText = this.scene.add
      .text(resourceX + 20, resourceY, "0", {
        fontSize: "16px",
        fontFamily: FONTS.BODY,
        color: "#6495ED",
      })
      .setOrigin(0, 0.5);
    this.container.add(this.hydronText);

    resourceX += 70;

    // Rare materials (combined)
    const rareIcon = this.scene.add.graphics();
    rareIcon.fillStyle(0x9932cc, 1);
    rareIcon.fillTriangle(
      resourceX + 7,
      resourceY - 7,
      resourceX + 14,
      resourceY + 7,
      resourceX,
      resourceY + 7,
    );
    this.container.add(rareIcon);

    this.rareText = this.scene.add
      .text(resourceX + 20, resourceY, "0", {
        fontSize: "16px",
        fontFamily: FONTS.BODY,
        color: "#BA55D3",
      })
      .setOrigin(0, 0.5);
    this.container.add(this.rareText);

    // === CENTER SECTION: Wave Info ===
    const centerX = GAME_WIDTH / 2;

    this.waveText = this.scene.add
      .text(centerX, 25, "WAVE 0/0", {
        fontSize: "22px",
        fontFamily: FONTS.HEADER,
        color: TEXT_COLORS.PRIMARY,
      })
      .setOrigin(0.5);
    this.container.add(this.waveText);

    // Enemy counter below wave
    this.enemyCountText = this.scene.add
      .text(centerX, 50, "ENEMIES: 0", {
        fontSize: "14px",
        fontFamily: FONTS.BODY,
        color: "#ff6666",
      })
      .setOrigin(0.5);
    this.container.add(this.enemyCountText);

    // === RIGHT SECTION: Base Health ===
    const rightX = GAME_WIDTH - 20;

    // Section label
    const baseLabel = this.scene.add
      .text(rightX, 8, "BASE", {
        fontSize: "10px",
        fontFamily: FONTS.HEADER,
        color: TEXT_COLORS.DIM,
      })
      .setOrigin(1, 0);
    this.container.add(baseLabel);

    // Health text
    this.healthText = this.scene.add
      .text(rightX, 28, `${BASE_HEALTH}`, {
        fontSize: "28px",
        fontFamily: FONTS.HEADER,
        color: TEXT_COLORS.PRIMARY,
      })
      .setOrigin(1, 0);
    this.container.add(this.healthText);

    // Health bar
    const barWidth = 120;
    const barHeight = 10;
    const barX = rightX - barWidth;
    const barY = 62;

    this.healthBarBg = this.scene.add.graphics();
    this.healthBarBg.fillStyle(0x333344, 1);
    this.healthBarBg.fillRoundedRect(barX, barY, barWidth, barHeight, 3);
    this.healthBarBg.lineStyle(1, COLORS.PANEL_BORDER, 1);
    this.healthBarBg.strokeRoundedRect(barX, barY, barWidth, barHeight, 3);
    this.container.add(this.healthBarBg);

    this.healthBar = this.scene.add.graphics();
    this.container.add(this.healthBar);
    this.updateHealthBar(BASE_HEALTH);
  }

  private createNextWaveButton(): void {
    // Position above the TurretMenu
    const btnX = GAME_WIDTH - 100;
    const btnY = GAME_HEIGHT - 155;
    const btnWidth = 160;
    const btnHeight = 45;
    const cutSize = 10;

    this.nextWaveButton = this.scene.add.container(btnX, btnY);

    // Button background with cut corners
    const btnBg = this.scene.add.graphics();
    const drawButton = (fillColor: number) => {
      btnBg.clear();
      btnBg.fillStyle(fillColor, 1);
      btnBg.beginPath();
      btnBg.moveTo(-btnWidth / 2 + cutSize, -btnHeight / 2);
      btnBg.lineTo(btnWidth / 2 - cutSize, -btnHeight / 2);
      btnBg.lineTo(btnWidth / 2, -btnHeight / 2 + cutSize);
      btnBg.lineTo(btnWidth / 2, btnHeight / 2);
      btnBg.lineTo(-btnWidth / 2, btnHeight / 2);
      btnBg.lineTo(-btnWidth / 2, -btnHeight / 2 + cutSize);
      btnBg.closePath();
      btnBg.fillPath();

      btnBg.lineStyle(2, 0x000000, 0.3);
      btnBg.strokePath();
    };
    drawButton(COLORS.PRIMARY);
    this.nextWaveButton.add(btnBg);

    const text = this.scene.add
      .text(0, -3, "NEXT WAVE", {
        fontSize: "16px",
        fontFamily: FONTS.HEADER,
        color: "#000000",
      })
      .setOrigin(0.5);
    this.nextWaveButton.add(text);

    const subtext = this.scene.add
      .text(0, 12, "SPACE", {
        fontSize: "10px",
        fontFamily: FONTS.BODY,
        color: "#004422",
      })
      .setOrigin(0.5);
    this.nextWaveButton.add(subtext);

    // Hit area
    const hitArea = this.scene.add
      .rectangle(0, 0, btnWidth, btnHeight, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    this.nextWaveButton.add(hitArea);

    hitArea.on("pointerover", () => drawButton(0x44ffaa));
    hitArea.on("pointerout", () => drawButton(COLORS.PRIMARY));
    hitArea.on("pointerup", () => {
      if (
        !this.scene.waveManager.isWaveInProgress() &&
        !this.scene.waveManager.isComplete()
      ) {
        this.scene.waveManager.startNextWave();
      }
    });

    this.nextWaveButton.setDepth(DEPTH.UI);
    this.nextWaveButton.setData("text", text);
    this.nextWaveButton.setData("subtext", subtext);
  }

  private createWaveProgressBar(): void {
    this.waveProgressBar = this.scene.add.graphics();
    this.waveProgressBar.setDepth(DEPTH.UI);
    this.container.add(this.waveProgressBar);
  }

  public update(): void {
    // Update resources
    this.updateResources(this.scene.resourceManager.getAllResources());

    // Update wave info
    const waveNum = this.scene.waveManager.getCurrentWave();
    const totalWaves = this.scene.waveManager.getTotalWaves();
    this.waveText.setText(`WAVE ${waveNum}/${totalWaves}`);

    // Update enemy count
    const enemyCount = this.scene.enemies.getLength();
    this.enemyCountText.setText(`ENEMIES: ${enemyCount}`);
    this.enemyCountText.setColor(
      enemyCount > 10 ? "#ff4444" : enemyCount > 5 ? "#ffaa44" : "#ff6666",
    );

    // Update next wave button visibility
    const showButton =
      !this.scene.waveManager.isWaveInProgress() &&
      !this.scene.waveManager.isComplete() &&
      waveNum < totalWaves;
    this.nextWaveButton.setVisible(showButton);

    // Show countdown if waiting
    if (this.scene.waveManager.isWaitingForNextWave()) {
      const timeLeft = Math.ceil(
        this.scene.waveManager.getTimeUntilNextWave() / 1000,
      );
      const textObj = this.nextWaveButton.getData(
        "text",
      ) as Phaser.GameObjects.Text;
      const subtextObj = this.nextWaveButton.getData(
        "subtext",
      ) as Phaser.GameObjects.Text;
      if (textObj) {
        textObj.setText(`NEXT WAVE`);
        subtextObj.setText(`${timeLeft}s`);
      }
    } else {
      const textObj = this.nextWaveButton.getData(
        "text",
      ) as Phaser.GameObjects.Text;
      const subtextObj = this.nextWaveButton.getData(
        "subtext",
      ) as Phaser.GameObjects.Text;
      if (textObj) {
        textObj.setText("NEXT WAVE");
        subtextObj.setText("SPACE");
      }
    }

    // Update wave progress
    this.updateWaveProgress();
  }

  private updateResources(resources: Resources): void {
    // Energy
    this.energyText.setText(Math.floor(resources.energy || 0).toString());

    // Basic materials
    this.carboxText.setText(Math.floor(resources.carbox || 0).toString());
    this.hydronText.setText(Math.floor(resources.hydron || 0).toString());

    // Sum rare materials
    const rare =
      (resources.titagen || 0) +
      (resources.oxyon || 0) +
      (resources.plutonia || 0) +
      (resources.xitanium || 0) +
      (resources.nanon || 0);
    this.rareText.setText(Math.floor(rare).toString());
  }

  public updateBaseHealth(health: number): void {
    this.healthText.setText(health.toString());

    // Color based on health
    const percent = health / BASE_HEALTH;
    if (percent > 0.5) {
      this.healthText.setColor(TEXT_COLORS.PRIMARY);
    } else if (percent > 0.25) {
      this.healthText.setColor("#ffaa00");
    } else {
      this.healthText.setColor("#ff4444");
    }

    this.updateHealthBar(health);

    // Flash effect when damaged
    if (health < BASE_HEALTH) {
      this.scene.tweens.add({
        targets: this.healthText,
        alpha: 0.3,
        duration: 100,
        yoyo: true,
        repeat: 2,
      });
    }
  }

  private updateHealthBar(health: number): void {
    const barWidth = 120;
    const barHeight = 10;
    const barX = GAME_WIDTH - 20 - barWidth;
    const barY = 62;

    this.healthBar.clear();

    // Health fill
    const healthPercent = health / BASE_HEALTH;
    const healthColor =
      healthPercent > 0.5
        ? 0x00ff88
        : healthPercent > 0.25
          ? 0xffaa00
          : 0xff4444;
    this.healthBar.fillStyle(healthColor);
    this.healthBar.fillRoundedRect(
      barX + 2,
      barY + 2,
      (barWidth - 4) * healthPercent,
      barHeight - 4,
      2,
    );
  }

  private updateWaveProgress(): void {
    this.waveProgressBar.clear();

    if (!this.scene.waveManager.isWaveInProgress()) return;

    const progress = this.scene.waveManager.getSpawnProgress();
    const barWidth = GAME_WIDTH - 40;
    const barX = 20;
    const barY = GAME_HEIGHT - 8;
    const barHeight = 4;

    // Background
    this.waveProgressBar.fillStyle(0x333344, 1);
    this.waveProgressBar.fillRect(barX, barY, barWidth, barHeight);

    // Progress fill
    this.waveProgressBar.fillStyle(COLORS.PRIMARY, 1);
    this.waveProgressBar.fillRect(barX, barY, barWidth * progress, barHeight);
  }

  private onWaveStart(waveNum: number): void {
    // Show wave start notification with industrial style
    const notification = this.scene.add.container(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2 - 100,
    );
    notification.setDepth(DEPTH.UI + 10);

    // Background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.8);
    bg.fillRect(-150, -40, 300, 80);
    bg.lineStyle(2, COLORS.DANGER, 1);
    bg.strokeRect(-150, -40, 300, 80);
    notification.add(bg);

    const waveText = this.scene.add
      .text(0, -10, `WAVE ${waveNum}`, {
        fontSize: "36px",
        fontFamily: FONTS.HEADER,
        color: "#ff4444",
      })
      .setOrigin(0.5);
    notification.add(waveText);

    const subText = this.scene.add
      .text(0, 20, "INCOMING", {
        fontSize: "14px",
        fontFamily: FONTS.BODY,
        color: TEXT_COLORS.SECONDARY,
      })
      .setOrigin(0.5);
    notification.add(subText);

    this.scene.tweens.add({
      targets: notification,
      alpha: 0,
      y: GAME_HEIGHT / 2 - 150,
      duration: 1500,
      ease: "Power2",
      onComplete: () => notification.destroy(),
    });
  }

  private onWaveComplete(_waveNum: number): void {
    // Show wave complete notification
    const notification = this.scene.add.container(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2 - 100,
    );
    notification.setDepth(DEPTH.UI + 10);

    // Background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.8);
    bg.fillRect(-150, -40, 300, 80);
    bg.lineStyle(2, COLORS.PRIMARY, 1);
    bg.strokeRect(-150, -40, 300, 80);
    notification.add(bg);

    const waveText = this.scene.add
      .text(0, -10, "WAVE CLEAR", {
        fontSize: "32px",
        fontFamily: FONTS.HEADER,
        color: TEXT_COLORS.PRIMARY,
      })
      .setOrigin(0.5);
    notification.add(waveText);

    const subText = this.scene.add
      .text(0, 20, "RESUPPLY INCOMING", {
        fontSize: "14px",
        fontFamily: FONTS.BODY,
        color: TEXT_COLORS.SECONDARY,
      })
      .setOrigin(0.5);
    notification.add(subText);

    this.scene.tweens.add({
      targets: notification,
      alpha: 0,
      y: GAME_HEIGHT / 2 - 150,
      duration: 1500,
      ease: "Power2",
      onComplete: () => notification.destroy(),
    });
  }

  public destroy(): void {
    this.scene.events.off("resourcesChanged", this.updateResources, this);
    this.scene.events.off("waveStart", this.onWaveStart, this);
    this.scene.events.off("waveComplete", this.onWaveComplete, this);
    this.container.destroy();
    this.nextWaveButton.destroy();
  }
}
