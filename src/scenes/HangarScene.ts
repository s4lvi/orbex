import Phaser from "phaser";
import { SCENES, GAME_WIDTH, GAME_HEIGHT, FONTS, TEXT_COLORS, MaterialType, MATERIAL_COLORS, ENERGY_COLOR, COLORS } from "../utils/Constants";
import { ResourceManager } from "../systems/ResourceManager";
import { ResearchPanel } from "../ui/ResearchPanel";
import { TurretInventoryManager } from "../systems/TurretInventoryManager";
import { TurretInstance } from "../types/GameData";
import { MineManager, Mine, MINE_MAX_HEALTH, THREAT_RAID_THRESHOLD } from "../systems/MineManager";
import { getPlanetById } from "../data/planets";
import { LandingZone } from "./LandingZoneSelectScene";
import { PathData } from "../types/GameData";
import { PersistenceManager } from "../systems/PersistenceManager";
import { SaveSlotPanel } from "../ui/SaveSlotPanel";

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
  private slotPanel: SaveSlotPanel | null = null;

  constructor() {
    super({ key: SCENES.HANGAR });
  }

  create(): void {
    this.resourceManager = new ResourceManager(this);
    this.loadStats();

    // Tick the world clock — surfaces any new raids or mine losses that happened
    // since the last time the player visited the hangar.
    const mineMgr = new MineManager(this);
    const events = mineMgr.tickWorldClock();
    if (events.length > 0) this.showWorldEvents(events);

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

    // Secondary actions row, then the primary DROP button.
    this.createActionRow();
    this.createDropButton();

    // Back button
    this.createBackButton();
  }

  /** MINES / RESEARCH / ROSTER / SAVE across one row above DROP. */
  private createActionRow(): void {
    const y = GAME_HEIGHT - 200;
    const width = 150;
    const height = 50;
    const xs = [105, 275, 445, 615];

    const mines = new MineManager(this).getMines();
    const raided = mines.filter(m => m.raid).length;
    const minesLabel = raided > 0 ? `MINES (${raided}!)` : `MINES (${mines.length})`;

    this.createHangarButton(xs[0], y, width, height, minesLabel,
      raided > 0 ? 0x882200 : 0x444444, raided > 0 ? 0xaa3300 : 0x666666, () => this.openMinesPanel());
    this.createHangarButton(xs[1], y, width, height, "RESEARCH", 0x0088ff, 0x44aaff, () => this.openResearchPanel());
    this.createHangarButton(xs[2], y, width, height, "ROSTER", 0x664400, 0x886600, () => this.openRosterPanel());
    this.createHangarButton(xs[3], y, width, height, "SAVE", 0x225544, 0x338866, () => this.openSavePanel());
  }

  private createHangarButton(
    x: number, y: number, width: number, height: number,
    label: string, color: number, hoverColor: number, onClick: () => void
  ): void {
    const cutSize = 10;
    const bg = this.add.graphics();
    const draw = (fill: number) => {
      bg.clear();
      bg.fillStyle(fill, 1);
      bg.fillRect(x - width / 2, y - height / 2, width, height);
      bg.lineStyle(2, 0x000000, 0.5);
      bg.strokeRect(x - width / 2 + 3, y - height / 2 + 3, width - 6, height - 6);
      bg.fillStyle(0x0a0a1a, 1);
      bg.fillTriangle(x - width / 2, y - height / 2, x - width / 2 + cutSize, y - height / 2, x - width / 2, y - height / 2 + cutSize);
      bg.fillTriangle(x + width / 2, y + height / 2, x + width / 2 - cutSize, y + height / 2, x + width / 2, y + height / 2 - cutSize);
    };
    draw(color);

    this.add.text(x, y, label, {
      fontSize: "17px",
      fontFamily: FONTS.HEADER,
      color: "#ffffff",
    }).setOrigin(0.5);

    const hit = this.add.rectangle(x, y, width, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerover", () => draw(hoverColor));
    hit.on("pointerout", () => draw(color));
    hit.on("pointerup", () => {
      if (!this.slotPanel && !this.researchPanel) onClick();
    });
  }

  private openSavePanel(): void {
    if (this.slotPanel) return;
    this.slotPanel = new SaveSlotPanel(
      this,
      "save",
      (slot) => {
        this.slotPanel = null;
        PersistenceManager.get().saveToSlot(slot);
        this.showToast(`Game saved to slot ${slot}`, "#00ff88");
      },
      () => {
        this.slotPanel = null;
      },
    );
  }

  /** Transient message in the empty band above the action row. */
  private showToast(text: string, color: string, index: number = 0): void {
    const toast = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 300 - index * 36, text, {
      fontSize: "14px",
      fontFamily: FONTS.HEADER,
      color: "#000000",
      backgroundColor: color,
      padding: { left: 12, right: 12, top: 6, bottom: 6 },
    }).setOrigin(0.5).setDepth(2000);
    this.tweens.add({
      targets: toast,
      alpha: 0,
      delay: 5000,
      duration: 800,
      onComplete: () => toast.destroy(),
    });
  }

  private openMinesPanel(): void {
    const mineMgr = new MineManager(this);
    const mines = mineMgr.getMines();

    const overlay = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.75)
      .setInteractive()
      .setDepth(1000);

    const pw = 760, ph = 560;
    const px = GAME_WIDTH / 2 - pw / 2;
    const py = GAME_HEIGHT / 2 - ph / 2;
    const panel = this.add.graphics().setDepth(1001);
    panel.fillStyle(0x0a0a1a, 1);
    panel.fillRect(px, py, pw, ph);
    panel.lineStyle(2, COLORS.PRIMARY, 1);
    panel.strokeRect(px, py, pw, ph);

    const title = this.add
      .text(GAME_WIDTH / 2, py + 30, "EXTRACTION SITES", {
        fontSize: "26px",
        fontFamily: FONTS.HEADER,
        color: "#00ff88",
      })
      .setOrigin(0.5)
      .setDepth(1001);

    const subtitle = this.add
      .text(
        GAME_WIDTH / 2,
        py + 62,
        mines.length === 0
          ? "No active sites. Win a drop to establish your first mine."
          : "Mines accrue threat over time. Defend raided sites before the deadline expires.",
        { fontSize: "13px", fontFamily: FONTS.BODY, color: TEXT_COLORS.MUTED },
      )
      .setOrigin(0.5)
      .setDepth(1001);

    const created: Phaser.GameObjects.GameObject[] = [];
    const cleanup = () => {
      overlay.destroy();
      panel.destroy();
      title.destroy();
      subtitle.destroy();
      created.forEach(o => o.destroy());
      closeBtn.destroy();
    };

    let rowY = py + 100;
    const rowH = 70;
    for (const mine of mines) {
      const rowBg = this.add
        .rectangle(GAME_WIDTH / 2, rowY + rowH / 2, pw - 40, rowH - 6, 0x111122)
        .setStrokeStyle(1, 0x224422)
        .setDepth(1001);
      created.push(rowBg);

      const planet = getPlanetById(mine.planetId);
      const planetName = planet?.name || mine.planetId;
      const nameText = this.add
        .text(px + 30, rowY + 10, mine.zoneName, {
          fontSize: "16px",
          fontFamily: FONTS.HEADER,
          color: "#ffffff",
        })
        .setDepth(1001);
      created.push(nameText);

      const planetText = this.add
        .text(px + 30, rowY + 32, planetName, {
          fontSize: "12px",
          fontFamily: FONTS.BODY,
          color: TEXT_COLORS.MUTED,
        })
        .setDepth(1001);
      created.push(planetText);

      // HP bar
      const hpBarX = px + 30;
      const hpBarY = rowY + 50;
      const hpBarW = 200;
      const hpFrac = mine.health / MINE_MAX_HEALTH;
      const hpBg = this.add.rectangle(hpBarX, hpBarY, hpBarW, 8, 0x222222).setOrigin(0, 0).setDepth(1001);
      const hpFg = this.add
        .rectangle(hpBarX, hpBarY, hpBarW * hpFrac, 8, hpFrac > 0.5 ? 0x00ff88 : hpFrac > 0.25 ? 0xffaa00 : 0xff4444)
        .setOrigin(0, 0)
        .setDepth(1001);
      created.push(hpBg, hpFg);

      // Threat / status
      let statusText: string;
      let statusColor: string;
      if (mine.raid) {
        const remainingMs = Math.max(0, mine.raid.deadline - Date.now());
        const minutes = Math.ceil(remainingMs / 60_000);
        statusText = `UNDER RAID — ${minutes}m to defend`;
        statusColor = "#ff6666";
      } else {
        const threatPct = Math.round((mine.threat / THREAT_RAID_THRESHOLD) * 100);
        statusText = `Threat: ${threatPct}%  ·  HP ${Math.round(mine.health)}/${MINE_MAX_HEALTH}`;
        statusColor = threatPct > 60 ? "#ffaa44" : TEXT_COLORS.SECONDARY;
      }
      const status = this.add
        .text(px + 250, rowY + 14, statusText, {
          fontSize: "13px",
          fontFamily: FONTS.MONO,
          color: statusColor,
        })
        .setDepth(1001);
      created.push(status);

      // DEFEND button — only on raided mines
      if (mine.raid) {
        const btn = this.add
          .text(px + pw - 30, rowY + rowH / 2, "DEFEND", {
            fontSize: "16px",
            fontFamily: FONTS.HEADER,
            color: "#ffffff",
            backgroundColor: "#882200",
            padding: { left: 16, right: 16, top: 8, bottom: 8 },
          })
          .setOrigin(1, 0.5)
          .setDepth(1001)
          .setInteractive({ useHandCursor: true });
        btn.on("pointerover", () => btn.setBackgroundColor("#aa3300"));
        btn.on("pointerout", () => btn.setBackgroundColor("#882200"));
        btn.on("pointerup", () => {
          cleanup();
          this.launchDefense(mine);
        });
        created.push(btn);
      }

      rowY += rowH;
    }

    const closeBtn = this.add
      .text(GAME_WIDTH / 2, py + ph - 36, "CLOSE", {
        fontSize: "18px",
        fontFamily: FONTS.HEADER,
        color: "#ffffff",
        backgroundColor: "#222222",
        padding: { left: 24, right: 24, top: 8, bottom: 8 },
      })
      .setOrigin(0.5)
      .setDepth(1001)
      .setInteractive({ useHandCursor: true });
    closeBtn.on("pointerup", cleanup);
    overlay.on("pointerup", cleanup);
  }

  /**
   * Synthesize a defense zone for the given mine and drop straight into GameScene.
   * Uses the mine's resource generation as the per-wave reward, fewer waves than
   * a normal drop, and tags the run with `defendingMineId` so GameScene knows to
   * resolve the raid on victory/defeat.
   */
  private launchDefense(mine: Mine): void {
    const planet = getPlanetById(mine.planetId);
    if (!planet) {
      console.warn("[HangarScene] Cannot defend mine — planet not found", mine.planetId);
      return;
    }

    // Two paths from opposite corners converging on the centre.
    const gridWidth = planet.gridSize?.width || 16;
    const gridHeight = planet.gridSize?.height || 16;
    const centerX = Math.floor(gridWidth / 2);
    const centerY = Math.floor(gridHeight / 2);

    const paths: PathData[] = [
      {
        startX: 0,
        startY: Math.floor(gridHeight / 3),
        waypoints: [
          { x: Math.floor(gridWidth / 3), y: Math.floor(gridHeight / 3) },
          { x: centerX, y: centerY },
        ],
      },
      {
        startX: gridWidth - 1,
        startY: Math.floor((gridHeight * 2) / 3),
        waypoints: [
          { x: Math.floor((gridWidth * 2) / 3), y: Math.floor((gridHeight * 2) / 3) },
          { x: centerX, y: centerY },
        ],
      },
    ];

    const zone: LandingZone = {
      id: Date.now(),
      pathCount: paths.length,
      paths,
      resourceGeneration: { ...mine.resourceGeneration },
      difficulty: 0.9, // defenses are a little easier than a fresh drop
      modifiers: [],
      contract: 'STANDARD',
    };

    this.registry.set('selectedPlanet', planet);
    this.registry.set('selectedZone', zone);
    this.registry.set('zoneWaveCount', 5); // shorter mission
    this.registry.set('defendingMineId', mine.id);
    this.scene.start(SCENES.GAME);
  }

  private showWorldEvents(events: Array<{ type: string; mineName: string }>): void {
    events.forEach((ev, i) => {
      let text: string;
      let color = '#ffaa44';
      if (ev.type === 'raid_triggered') {
        text = `RAID INCOMING - ${ev.mineName}`;
        color = '#ff6666';
      } else if (ev.type === 'raid_failed') {
        text = `Raid undefended - ${ev.mineName} damaged`;
        color = '#ff4444';
      } else {
        text = `Mine lost - ${ev.mineName}`;
        color = '#ff4444';
      }
      this.showToast(text, color, i);
    });
  }

  private openRosterPanel(): void {
    const inv = new TurretInventoryManager(this).getInventory();
    const sorted = [...inv.turrets]
      .filter((t): t is TurretInstance & { identity: NonNullable<TurretInstance["identity"]> } => !!t.identity)
      .sort((a, b) => b.identity.kills - a.identity.kills);

    const overlay = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.75)
      .setInteractive()
      .setDepth(1000);

    const pw = 700, ph = 520;
    const px = GAME_WIDTH / 2 - pw / 2;
    const py = GAME_HEIGHT / 2 - ph / 2;
    const panel = this.add.graphics().setDepth(1001);
    panel.fillStyle(0x0a0a1a, 1);
    panel.fillRect(px, py, pw, ph);
    panel.lineStyle(2, COLORS.PRIMARY, 1);
    panel.strokeRect(px, py, pw, ph);

    const title = this.add
      .text(GAME_WIDTH / 2, py + 30, "ROSTER", {
        fontSize: "28px",
        fontFamily: FONTS.HEADER,
        color: "#00ff88",
      })
      .setOrigin(0.5)
      .setDepth(1001);

    const subtitle = this.add
      .text(
        GAME_WIDTH / 2,
        py + 62,
        sorted.length === 0
          ? "No surviving units yet — bring some home from a drop."
          : `${inv.turrets.length}/${inv.maxCapacity} units in active inventory`,
        { fontSize: "14px", fontFamily: FONTS.BODY, color: TEXT_COLORS.MUTED },
      )
      .setOrigin(0.5)
      .setDepth(1001);

    // Header row
    const headerY = py + 100;
    const headers = [
      { text: "CALLSIGN", x: px + 40 },
      { text: "TYPE", x: px + 220 },
      { text: "LVL", x: px + 360 },
      { text: "KILLS", x: px + 440 },
      { text: "DROPS", x: px + 540 },
    ];
    const headerObjs = headers.map(h =>
      this.add
        .text(h.x, headerY, h.text, {
          fontSize: "13px",
          fontFamily: FONTS.HEADER,
          color: TEXT_COLORS.SECONDARY,
        })
        .setDepth(1001),
    );

    const rowObjs: Phaser.GameObjects.Text[] = [];
    const maxRows = 10;
    sorted.slice(0, maxRows).forEach((t, i) => {
      const ry = headerY + 30 + i * 32;
      const id = t.identity;
      const cells = [
        { text: id.callsign, x: px + 40, color: "#ffffff" },
        { text: t.type.toUpperCase(), x: px + 220, color: TEXT_COLORS.SECONDARY },
        { text: `${t.level}`, x: px + 360, color: TEXT_COLORS.SECONDARY },
        { text: `${id.kills}`, x: px + 440, color: "#ffcc44" },
        { text: `${id.dropsSurvived}`, x: px + 540, color: "#44ff88" },
      ];
      for (const c of cells) {
        rowObjs.push(
          this.add
            .text(c.x, ry, c.text, {
              fontSize: "14px",
              fontFamily: FONTS.MONO,
              color: c.color,
            })
            .setDepth(1001),
        );
      }
    });

    const closeBtn = this.add
      .text(GAME_WIDTH / 2, py + ph - 40, "CLOSE", {
        fontSize: "18px",
        fontFamily: FONTS.HEADER,
        color: "#ffffff",
        backgroundColor: "#222222",
        padding: { left: 24, right: 24, top: 8, bottom: 8 },
      })
      .setOrigin(0.5)
      .setDepth(1001)
      .setInteractive({ useHandCursor: true });

    const cleanup = () => {
      overlay.destroy();
      panel.destroy();
      title.destroy();
      subtitle.destroy();
      headerObjs.forEach(o => o.destroy());
      rowObjs.forEach(o => o.destroy());
      closeBtn.destroy();
    };
    closeBtn.on("pointerup", cleanup);
    overlay.on("pointerup", cleanup);
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
