import Phaser from "phaser";
import { SCENES, GAME_WIDTH, GAME_HEIGHT, FONTS, TEXT_COLORS, MaterialType, MATERIAL_COLORS, ENERGY_COLOR } from "../utils/Constants";
import { ResourceManager } from "../systems/ResourceManager";
import { ResearchPanel } from "../ui/ResearchPanel";

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
  private researchPanel: ResearchPanel | null = null;

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
        fontSize: "36px",
        fontFamily: FONTS.HEADER,
        color: "#00ff88",
      })
      .setOrigin(0.5);

    // Resources panel
    this.createResourcesPanel();

    // Stats panel
    this.createStatsPanel();

    // RESEARCH button
    this.createResearchButton();

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
    graphics.lineBetween(40, GAME_HEIGHT - 280, GAME_WIDTH - 40, GAME_HEIGHT - 280);
  }

  private createResourcesPanel(): void {
    const panelY = 140;

    // Panel title
    this.add
      .text(GAME_WIDTH / 2, panelY, "— RESOURCES —", {
        fontSize: "20px",
        fontFamily: FONTS.HEADER,
        color: TEXT_COLORS.SECONDARY,
      })
      .setOrigin(0.5);

    // Get resources from resource manager
    const energy = this.resourceManager.getEnergy();
    const materials = this.resourceManager.getAllMaterials();

    // Resource grid - Energy + 7 materials in 2 rows of 4
    const startY = panelY + 50;
    const colWidth = 160;
    const rowHeight = 65;

    // Define resource data with new material types
    const resourceData = [
      { name: "Energy", value: energy, color: ENERGY_COLOR },
      { name: "Carbox", value: materials[MaterialType.CARBOX], color: MATERIAL_COLORS[MaterialType.CARBOX] },
      { name: "Hydron", value: materials[MaterialType.HYDRON], color: MATERIAL_COLORS[MaterialType.HYDRON] },
      { name: "Titagen", value: materials[MaterialType.TITAGEN], color: MATERIAL_COLORS[MaterialType.TITAGEN] },
      { name: "Oxyon", value: materials[MaterialType.OXYON], color: MATERIAL_COLORS[MaterialType.OXYON] },
      { name: "Plutonia", value: materials[MaterialType.PLUTONIA], color: MATERIAL_COLORS[MaterialType.PLUTONIA] },
      { name: "Xitanium", value: materials[MaterialType.XITANIUM], color: MATERIAL_COLORS[MaterialType.XITANIUM] },
      { name: "Nanon", value: materials[MaterialType.NANON], color: MATERIAL_COLORS[MaterialType.NANON] },
    ];

    resourceData.forEach((res, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const x = 90 + col * colWidth;
      const y = startY + row * rowHeight;

      // Resource icon
      this.add.circle(x, y, 10, res.color);

      // Resource name
      this.add
        .text(x + 18, y - 12, res.name, {
          fontSize: "14px",
          fontFamily: FONTS.BODY,
          color: TEXT_COLORS.SECONDARY,
        })
        .setOrigin(0, 0.5);

      // Resource value
      this.add
        .text(x + 18, y + 12, Math.floor(res.value).toString(), {
          fontSize: "22px",
          fontFamily: FONTS.HEADER,
          color: `#${res.color.toString(16).padStart(6, "0")}`,
        })
        .setOrigin(0, 0.5);
    });
  }

  private createStatsPanel(): void {
    const panelY = 400;

    // Panel title
    this.add
      .text(GAME_WIDTH / 2, panelY, "— MISSION STATS —", {
        fontSize: "20px",
        fontFamily: FONTS.HEADER,
        color: TEXT_COLORS.SECONDARY,
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

    const startY = panelY + 45;
    const colWidth = 220;

    statsData.forEach((stat, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 120 + col * colWidth;
      const y = startY + row * 80;

      // Stat label
      this.add
        .text(x, y, stat.label, {
          fontSize: "16px",
          fontFamily: FONTS.BODY,
          color: TEXT_COLORS.SECONDARY,
        })
        .setOrigin(0.5);

      // Stat value
      this.add
        .text(x, y + 30, stat.value.toString(), {
          fontSize: "36px",
          fontFamily: FONTS.HEADER,
          color: stat.color || "#ffffff",
        })
        .setOrigin(0.5);
    });

    // Success rate
    const successRate =
      this.stats.totalDrops > 0
        ? Math.round((this.stats.successfulDrops / this.stats.totalDrops) * 100)
        : 0;

    this.add
      .text(GAME_WIDTH / 2, startY + 180, `Success Rate: ${successRate}%`, {
        fontSize: "20px",
        fontFamily: FONTS.HEADER,
        color: successRate >= 50 ? "#44ff44" : "#ff4444",
      })
      .setOrigin(0.5);
  }

  private createResearchButton(): void {
    const btnY = GAME_HEIGHT - 200;
    const btnWidth = 200;
    const btnHeight = 50;

    // Button background with industrial style
    const btnBg = this.add.graphics();

    // Main button shape
    btnBg.fillStyle(0x0088ff, 1);
    btnBg.fillRect(
      GAME_WIDTH / 2 - btnWidth / 2,
      btnY - btnHeight / 2,
      btnWidth,
      btnHeight
    );

    // Inner border
    btnBg.lineStyle(2, 0x000000, 0.5);
    btnBg.strokeRect(
      GAME_WIDTH / 2 - btnWidth / 2 + 3,
      btnY - btnHeight / 2 + 3,
      btnWidth - 6,
      btnHeight - 6
    );

    // Corner cuts for industrial look
    const cutSize = 10;
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
      .text(GAME_WIDTH / 2, btnY, "RESEARCH", {
        fontSize: "24px",
        fontFamily: FONTS.HEADER,
        color: "#ffffff",
      })
      .setOrigin(0.5);

    // Interactive zone
    const hitZone = this.add
      .rectangle(GAME_WIDTH / 2, btnY, btnWidth, btnHeight, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });

    hitZone.on("pointerover", () => {
      btnBg.clear();
      btnBg.fillStyle(0x44aaff, 1);
      btnBg.fillRect(
        GAME_WIDTH / 2 - btnWidth / 2,
        btnY - btnHeight / 2,
        btnWidth,
        btnHeight
      );
      btnBg.lineStyle(2, 0x000000, 0.5);
      btnBg.strokeRect(
        GAME_WIDTH / 2 - btnWidth / 2 + 3,
        btnY - btnHeight / 2 + 3,
        btnWidth - 6,
        btnHeight - 6
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
      btnBg.fillStyle(0x0088ff, 1);
      btnBg.fillRect(
        GAME_WIDTH / 2 - btnWidth / 2,
        btnY - btnHeight / 2,
        btnWidth,
        btnHeight
      );
      btnBg.lineStyle(2, 0x000000, 0.5);
      btnBg.strokeRect(
        GAME_WIDTH / 2 - btnWidth / 2 + 3,
        btnY - btnHeight / 2 + 3,
        btnWidth - 6,
        btnHeight - 6
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
      this.openResearchPanel();
    });
  }

  private openResearchPanel(): void {
    if (this.researchPanel) return;

    this.researchPanel = new ResearchPanel(
      this,
      this.resourceManager,
      () => {
        this.researchPanel = null;
        // Refresh the scene to show updated resources
        this.scene.restart();
      }
    );
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
      .text(GAME_WIDTH / 2, btnY - 5, "DROP", {
        fontSize: "36px",
        fontFamily: FONTS.HEADER,
        color: "#000000",
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, btnY + 22, "SELECT MISSION", {
        fontSize: "14px",
        fontFamily: FONTS.BODY,
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
      .text(60, 60, "EXIT", {
        fontSize: "22px",
        fontFamily: FONTS.HEADER,
        color: TEXT_COLORS.MUTED,
      })
      .setInteractive({ useHandCursor: true });

    btn.on("pointerover", () => btn.setColor("#ffffff"));
    btn.on("pointerout", () => btn.setColor(TEXT_COLORS.MUTED));
    btn.on("pointerup", () => this.scene.start(SCENES.MAIN_MENU));
  }
}
