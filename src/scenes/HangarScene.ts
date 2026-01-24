import Phaser from "phaser";
import { SCENES, GAME_WIDTH, GAME_HEIGHT } from "../utils/Constants";
import { ResourceManager } from "../systems/ResourceManager";

export interface PlayerStats {
  totalDrops: number;
  successfulDrops: number;
  failedDrops: number;
  enemiesKilled: number;
  turretsBuilt: number;
  wavesCompleted: number;
}

export class HangarScene extends Phaser.Scene {
  private resourceManager!: ResourceManager;
  private stats!: PlayerStats;

  constructor() {
    super({ key: SCENES.HANGAR });
  }

  create(): void {
    this.resourceManager = new ResourceManager(this);
    this.loadStats();

    // Background
    this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      0x0a0a1a
    );

    // Industrial frame/border
    this.createIndustrialFrame();

    // Title
    this.add
      .text(GAME_WIDTH / 2, 60, "COMMAND CENTER", {
        fontSize: "32px",
        fontFamily: "Arial",
        color: "#00ff88",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    // Resources panel
    this.createResourcesPanel();

    // Stats panel
    this.createStatsPanel();

    // DROP button
    this.createDropButton();

    // Back button
    this.createBackButton();
  }

  private loadStats(): void {
    const savedStats = this.registry.get("playerStats");
    this.stats = savedStats || {
      totalDrops: 0,
      successfulDrops: 0,
      failedDrops: 0,
      enemiesKilled: 0,
      turretsBuilt: 0,
      wavesCompleted: 0,
    };
  }

  private createIndustrialFrame(): void {
    const graphics = this.add.graphics();

    // Outer border with industrial corners
    graphics.lineStyle(3, 0x00ff88, 0.8);
    graphics.strokeRect(20, 20, GAME_WIDTH - 40, GAME_HEIGHT - 40);

    // Corner accents
    const cornerSize = 30;
    const corners = [
      { x: 20, y: 20 },
      { x: GAME_WIDTH - 20, y: 20 },
      { x: 20, y: GAME_HEIGHT - 20 },
      { x: GAME_WIDTH - 20, y: GAME_HEIGHT - 20 },
    ];

    graphics.lineStyle(4, 0x00ff88, 1);
    corners.forEach((corner, i) => {
      const dirX = i % 2 === 0 ? 1 : -1;
      const dirY = i < 2 ? 1 : -1;

      graphics.beginPath();
      graphics.moveTo(corner.x, corner.y + dirY * cornerSize);
      graphics.lineTo(corner.x, corner.y);
      graphics.lineTo(corner.x + dirX * cornerSize, corner.y);
      graphics.strokePath();
    });

    // Horizontal divider lines
    graphics.lineStyle(1, 0x00ff88, 0.3);
    graphics.lineBetween(40, 100, GAME_WIDTH - 40, 100);
    graphics.lineBetween(40, GAME_HEIGHT - 200, GAME_WIDTH - 40, GAME_HEIGHT - 200);
  }

  private createResourcesPanel(): void {
    const panelY = 140;
    const resources = this.resourceManager.getSessionResources();

    // Panel title
    this.add
      .text(GAME_WIDTH / 2, panelY, "— RESOURCES —", {
        fontSize: "18px",
        fontFamily: "Arial",
        color: "#666666",
      })
      .setOrigin(0.5);

    // Resource grid - 2 rows of 4
    const startY = panelY + 50;
    const colWidth = 160;
    const rowHeight = 60;

    const resourceData = [
      { name: "Minerals", value: resources.minerals, color: 0x8888ff },
      { name: "Energy", value: resources.energy, color: 0xffff00 },
      { name: "Alloys", value: resources.alloys, color: 0x888888 },
      { name: "Plasma", value: resources.plasma, color: 0xff00ff },
      { name: "Crystals", value: resources.crystals, color: 0x00ffff },
      { name: "Dark Matter", value: resources.darkMatter, color: 0x440088 },
      { name: "Antimatter", value: resources.antimatter, color: 0xff4400 },
      { name: "Quantum Flux", value: resources.quantumFlux, color: 0x00ff44 },
    ];

    resourceData.forEach((res, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const x = 90 + col * colWidth;
      const y = startY + row * rowHeight;

      // Resource icon
      this.add.circle(x, y, 8, res.color);

      // Resource name
      this.add
        .text(x + 15, y - 10, res.name, {
          fontSize: "12px",
          fontFamily: "Arial",
          color: "#666666",
        })
        .setOrigin(0, 0.5);

      // Resource value
      this.add
        .text(x + 15, y + 10, Math.floor(res.value).toString(), {
          fontSize: "18px",
          fontFamily: "Arial",
          color: `#${res.color.toString(16).padStart(6, "0")}`,
          fontStyle: "bold",
        })
        .setOrigin(0, 0.5);
    });
  }

  private createStatsPanel(): void {
    const panelY = 380;

    // Panel title
    this.add
      .text(GAME_WIDTH / 2, panelY, "— MISSION STATS —", {
        fontSize: "18px",
        fontFamily: "Arial",
        color: "#666666",
      })
      .setOrigin(0.5);

    const statsData = [
      { label: "Total Drops", value: this.stats.totalDrops },
      { label: "Successful", value: this.stats.successfulDrops, color: "#44ff44" },
      { label: "Failed", value: this.stats.failedDrops, color: "#ff4444" },
      { label: "Enemies Killed", value: this.stats.enemiesKilled },
      { label: "Turrets Built", value: this.stats.turretsBuilt },
      { label: "Waves Completed", value: this.stats.wavesCompleted },
    ];

    const startY = panelY + 40;
    const colWidth = 220;

    statsData.forEach((stat, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 120 + col * colWidth;
      const y = startY + row * 70;

      // Stat label
      this.add
        .text(x, y, stat.label, {
          fontSize: "14px",
          fontFamily: "Arial",
          color: "#666666",
        })
        .setOrigin(0.5);

      // Stat value
      this.add
        .text(x, y + 25, stat.value.toString(), {
          fontSize: "28px",
          fontFamily: "Arial",
          color: stat.color || "#ffffff",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
    });

    // Success rate
    const successRate =
      this.stats.totalDrops > 0
        ? Math.round((this.stats.successfulDrops / this.stats.totalDrops) * 100)
        : 0;

    this.add
      .text(GAME_WIDTH / 2, startY + 160, `Success Rate: ${successRate}%`, {
        fontSize: "16px",
        fontFamily: "Arial",
        color: successRate >= 50 ? "#44ff44" : "#ff4444",
      })
      .setOrigin(0.5);
  }

  private createDropButton(): void {
    const btnY = GAME_HEIGHT - 120;
    const btnWidth = 300;
    const btnHeight = 70;

    // Button background with industrial style
    const btnBg = this.add.graphics();

    // Main button shape
    btnBg.fillStyle(0x00ff88, 1);
    btnBg.fillRect(
      GAME_WIDTH / 2 - btnWidth / 2,
      btnY - btnHeight / 2,
      btnWidth,
      btnHeight
    );

    // Inner border
    btnBg.lineStyle(3, 0x000000, 0.5);
    btnBg.strokeRect(
      GAME_WIDTH / 2 - btnWidth / 2 + 4,
      btnY - btnHeight / 2 + 4,
      btnWidth - 8,
      btnHeight - 8
    );

    // Corner cuts for industrial look
    const cutSize = 15;
    btnBg.fillStyle(0x0a0a1a, 1);
    // Top-left cut
    btnBg.fillTriangle(
      GAME_WIDTH / 2 - btnWidth / 2,
      btnY - btnHeight / 2,
      GAME_WIDTH / 2 - btnWidth / 2 + cutSize,
      btnY - btnHeight / 2,
      GAME_WIDTH / 2 - btnWidth / 2,
      btnY - btnHeight / 2 + cutSize
    );
    // Bottom-right cut
    btnBg.fillTriangle(
      GAME_WIDTH / 2 + btnWidth / 2,
      btnY + btnHeight / 2,
      GAME_WIDTH / 2 + btnWidth / 2 - cutSize,
      btnY + btnHeight / 2,
      GAME_WIDTH / 2 + btnWidth / 2,
      btnY + btnHeight / 2 - cutSize
    );

    // Button text
    this.add
      .text(GAME_WIDTH / 2, btnY - 5, "▼ DROP ▼", {
        fontSize: "32px",
        fontFamily: "Arial",
        color: "#000000",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, btnY + 20, "SELECT MISSION", {
        fontSize: "12px",
        fontFamily: "Arial",
        color: "#004422",
      })
      .setOrigin(0.5);

    // Interactive zone
    const hitZone = this.add
      .rectangle(GAME_WIDTH / 2, btnY, btnWidth, btnHeight, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });

    hitZone.on("pointerover", () => {
      btnBg.clear();
      btnBg.fillStyle(0x44ffaa, 1);
      btnBg.fillRect(
        GAME_WIDTH / 2 - btnWidth / 2,
        btnY - btnHeight / 2,
        btnWidth,
        btnHeight
      );
      btnBg.lineStyle(3, 0x000000, 0.5);
      btnBg.strokeRect(
        GAME_WIDTH / 2 - btnWidth / 2 + 4,
        btnY - btnHeight / 2 + 4,
        btnWidth - 8,
        btnHeight - 8
      );
      btnBg.fillStyle(0x0a0a1a, 1);
      btnBg.fillTriangle(
        GAME_WIDTH / 2 - btnWidth / 2,
        btnY - btnHeight / 2,
        GAME_WIDTH / 2 - btnWidth / 2 + cutSize,
        btnY - btnHeight / 2,
        GAME_WIDTH / 2 - btnWidth / 2,
        btnY - btnHeight / 2 + cutSize
      );
      btnBg.fillTriangle(
        GAME_WIDTH / 2 + btnWidth / 2,
        btnY + btnHeight / 2,
        GAME_WIDTH / 2 + btnWidth / 2 - cutSize,
        btnY + btnHeight / 2,
        GAME_WIDTH / 2 + btnWidth / 2,
        btnY + btnHeight / 2 - cutSize
      );
    });

    hitZone.on("pointerout", () => {
      btnBg.clear();
      btnBg.fillStyle(0x00ff88, 1);
      btnBg.fillRect(
        GAME_WIDTH / 2 - btnWidth / 2,
        btnY - btnHeight / 2,
        btnWidth,
        btnHeight
      );
      btnBg.lineStyle(3, 0x000000, 0.5);
      btnBg.strokeRect(
        GAME_WIDTH / 2 - btnWidth / 2 + 4,
        btnY - btnHeight / 2 + 4,
        btnWidth - 8,
        btnHeight - 8
      );
      btnBg.fillStyle(0x0a0a1a, 1);
      btnBg.fillTriangle(
        GAME_WIDTH / 2 - btnWidth / 2,
        btnY - btnHeight / 2,
        GAME_WIDTH / 2 - btnWidth / 2 + cutSize,
        btnY - btnHeight / 2,
        GAME_WIDTH / 2 - btnWidth / 2,
        btnY - btnHeight / 2 + cutSize
      );
      btnBg.fillTriangle(
        GAME_WIDTH / 2 + btnWidth / 2,
        btnY + btnHeight / 2,
        GAME_WIDTH / 2 + btnWidth / 2 - cutSize,
        btnY + btnHeight / 2,
        GAME_WIDTH / 2 + btnWidth / 2,
        btnY + btnHeight / 2 - cutSize
      );
    });

    hitZone.on("pointerup", () => {
      this.scene.start(SCENES.PLANET_SELECT);
    });
  }

  private createBackButton(): void {
    const btn = this.add
      .text(60, 60, "< BACK", {
        fontSize: "20px",
        fontFamily: "Arial",
        color: "#666666",
      })
      .setInteractive({ useHandCursor: true });

    btn.on("pointerover", () => btn.setColor("#ffffff"));
    btn.on("pointerout", () => btn.setColor("#666666"));
    btn.on("pointerup", () => this.scene.start(SCENES.MAIN_MENU));
  }
}
