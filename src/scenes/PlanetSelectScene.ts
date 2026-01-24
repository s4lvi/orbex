import Phaser from "phaser";
import {
  SCENES,
  COLORS,
  GAME_WIDTH,
  GAME_HEIGHT,
  PlanetDifficulty,
  FONTS,
  TEXT_COLORS,
} from "../utils/Constants";
import { PLANETS, PlanetData } from "../data/planets";
import { ResourceManager } from "../systems/ResourceManager";
import { getShipUpgrade, canAffordUpgrade } from "../data/ship";

export class PlanetSelectScene extends Phaser.Scene {
  private resourceManager!: ResourceManager;

  constructor() {
    super({ key: SCENES.PLANET_SELECT });
  }

  create(): void {
    this.resourceManager = new ResourceManager(this);

    // Background
    this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      0x0a0a1a,
    );

    // Title
    const title = this.add
      .text(GAME_WIDTH / 2, 60, "SELECT PLANET", {
        fontSize: "38px",
        fontFamily: FONTS.HEADER,
        color: TEXT_COLORS.PRIMARY,
      })
      .setOrigin(0.5);
    title.setDepth(1000); // Ensure title is on top

    // Create planet cards (stacked vertically for portrait)
    const cardHeight = 260;
    const cardSpacing = 15;
    const startY = 220;

    PLANETS.forEach((planet, index) => {
      this.createPlanetCard(
        GAME_WIDTH / 2,
        startY + index * (cardHeight + cardSpacing),
        planet,
      );
    });

    // Back button
    this.createBackButton();

    // Resources display
    this.displayResources();
  }

  private createPlanetCard(x: number, y: number, planet: PlanetData): void {
    const cardWidth = 680;
    const cardHeight = 260;
    const isUnlocked = this.resourceManager.isPlanetUnlocked(planet.id);

    // Card background
    const card = this.add.container(x, y);

    const bg = this.add
      .rectangle(0, 0, cardWidth, cardHeight, COLORS.PANEL_BG)
      .setStrokeStyle(3, this.getDifficultyColor(planet.difficulty));
    card.add(bg);

    // Lock overlay if not unlocked
    if (!isUnlocked) {
      const lockOverlay = this.add.rectangle(
        0,
        0,
        cardWidth,
        cardHeight,
        0x000000,
        0.6,
      );
      card.add(lockOverlay);

      const lockIcon = this.add
        .text(220, -65, "🔒", {
          fontSize: "48px",
        })
        .setOrigin(0.5);
      card.add(lockIcon);
    }

    // Planet circle
    const planetCircle = this.add.circle(
      -220,
      0,
      45,
      this.getDifficultyColor(planet.difficulty),
    );
    card.add(planetCircle);

    // Planet name
    const nameText = this.add
      .text(-130, -65, planet.name, {
        fontSize: "26px",
        fontFamily: FONTS.HEADER,
        color: isUnlocked ? "#ffffff" : TEXT_COLORS.MUTED,
      })
      .setOrigin(0, 0.5);
    card.add(nameText);

    // Difficulty label
    const diffText = this.add
      .text(-130, -35, planet.difficulty.toUpperCase(), {
        fontSize: "16px",
        fontFamily: FONTS.HEADER,
        color: this.getDifficultyColorHex(planet.difficulty),
      })
      .setOrigin(0, 0.5);
    card.add(diffText);

    // Description
    const descText = this.add
      .text(-130, 0, planet.description, {
        fontSize: "15px",
        fontFamily: FONTS.BODY,
        color: isUnlocked ? TEXT_COLORS.SECONDARY : TEXT_COLORS.DIM,
        wordWrap: { width: 420 },
      })
      .setOrigin(0, 0.5);
    card.add(descText);

    // Stats
    const statsText = this.add
      .text(
        -130,
        45,
        [
          `Waves: ${planet.waves}`,
          `Paths: ${planet.minPaths}-${planet.maxPaths}`,
          `Reward: ${planet.rewardMultiplier}x`,
        ].join("  |  "),
        {
          fontSize: "15px",
          fontFamily: FONTS.BODY,
          color: isUnlocked ? TEXT_COLORS.SECONDARY : TEXT_COLORS.DIM,
        },
      )
      .setOrigin(0, 0.5);
    card.add(statsText);

    // Action button
    const btnY = 80;
    if (isUnlocked) {
      this.createIndustrialButton(card, 0, btnY, 200, 45, "SELECT", true, () => {
        this.registry.set("selectedPlanet", planet);
        this.scene.start(SCENES.LANDING_ZONE_SELECT);
      });
    } else {
      // Show upgrade button with cost below
      const upgrade = getShipUpgrade(planet.id);
      if (upgrade) {
        const canAfford = canAffordUpgrade(
          upgrade,
          this.resourceManager.getSessionResources(),
        );

        this.createIndustrialButton(card, 0, btnY - 10, 220, 40, "UNLOCK", canAfford, () => {
          this.showUpgradeConfirm(planet, upgrade);
        });

        // Cost display - smaller and further down
        const costText = this.add
          .text(0, btnY + 25, this.formatCost(upgrade.cost), {
            fontSize: "12px",
            fontFamily: FONTS.BODY,
            color: canAfford ? TEXT_COLORS.SECONDARY : TEXT_COLORS.DIM,
          })
          .setOrigin(0.5);
        card.add(costText);
      }
    }
  }

  private createIndustrialButton(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    width: number,
    height: number,
    text: string,
    enabled: boolean,
    callback: () => void
  ): void {
    const cutSize = 10;
    const btnBg = this.add.graphics();

    const drawButton = (fillColor: number) => {
      btnBg.clear();
      btnBg.fillStyle(fillColor, 1);
      btnBg.fillRect(x - width / 2, y - height / 2, width, height);

      btnBg.lineStyle(2, 0x000000, 0.3);
      btnBg.strokeRect(x - width / 2 + 2, y - height / 2 + 2, width - 4, height - 4);

      btnBg.fillStyle(COLORS.PANEL_BG, 1);
      btnBg.fillTriangle(
        x - width / 2, y - height / 2,
        x - width / 2 + cutSize, y - height / 2,
        x - width / 2, y - height / 2 + cutSize
      );
      btnBg.fillTriangle(
        x + width / 2, y + height / 2,
        x + width / 2 - cutSize, y + height / 2,
        x + width / 2, y + height / 2 - cutSize
      );
    };

    drawButton(enabled ? COLORS.PRIMARY : 0x444444);
    container.add(btnBg);

    const label = this.add
      .text(x, y, text, {
        fontSize: "16px",
        fontFamily: FONTS.HEADER,
        color: enabled ? "#000000" : TEXT_COLORS.DIM,
      })
      .setOrigin(0.5);
    container.add(label);

    if (enabled) {
      const hitZone = this.add
        .rectangle(x, y, width, height, 0xffffff, 0)
        .setInteractive({ useHandCursor: true });

      hitZone.on("pointerover", () => drawButton(0x44ffaa));
      hitZone.on("pointerout", () => drawButton(COLORS.PRIMARY));
      hitZone.on("pointerup", callback);

      container.add(hitZone);
    }
  }

  private showUpgradeConfirm(planet: PlanetData, upgrade: any): void {
    // Create modal overlay
    const overlay = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      0x000000,
      0.8,
    );
    overlay.setDepth(1000);

    // Modal panel
    const panel = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      550,
      400,
      COLORS.PANEL_BG,
    );
    panel.setStrokeStyle(4, COLORS.PRIMARY);
    panel.setDepth(1001);

    // Title
    const title = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 140, "UNLOCK PLANET", {
        fontSize: "32px",
        fontFamily: FONTS.HEADER,
        color: TEXT_COLORS.PRIMARY,
      })
      .setOrigin(0.5)
      .setDepth(1002);

    // Description
    const desc = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80, upgrade.description, {
        fontSize: "16px",
        fontFamily: FONTS.BODY,
        color: TEXT_COLORS.SECONDARY,
        align: "center",
        wordWrap: { width: 480 },
      })
      .setOrigin(0.5)
      .setDepth(1002);

    // Cost breakdown
    const costLines = Object.entries(upgrade.cost).map(([key, value]) => {
      const name = key.charAt(0).toUpperCase() + key.slice(1);
      const current = this.resourceManager.getSessionResource(key);
      const costValue = value as number;
      const color = current >= costValue ? "#44ff44" : "#ff4444";
      return { text: `${name}: ${costValue} (have: ${current})`, color };
    });

    let costY = GAME_HEIGHT / 2 - 10;
    costLines.forEach((line) => {
      this.add
        .text(GAME_WIDTH / 2, costY, line.text, {
          fontSize: "16px",
          fontFamily: FONTS.BODY,
          color: line.color,
        })
        .setOrigin(0.5)
        .setDepth(1002);
      costY += 30;
    });

    // Buttons with industrial style
    const btnY = GAME_HEIGHT / 2 + 140;
    const cutSize = 10;

    // Confirm button
    const confirmBg = this.add.graphics().setDepth(1002);
    const drawConfirmBtn = (color: number) => {
      confirmBg.clear();
      confirmBg.fillStyle(color, 1);
      confirmBg.fillRect(GAME_WIDTH / 2 - 100 - 90, btnY - 25, 180, 50);
      confirmBg.lineStyle(2, 0x000000, 0.3);
      confirmBg.strokeRect(GAME_WIDTH / 2 - 100 - 88, btnY - 23, 176, 46);
      confirmBg.fillStyle(0x1a1a2e, 1);
      confirmBg.fillTriangle(
        GAME_WIDTH / 2 - 100 - 90, btnY - 25,
        GAME_WIDTH / 2 - 100 - 90 + cutSize, btnY - 25,
        GAME_WIDTH / 2 - 100 - 90, btnY - 25 + cutSize
      );
      confirmBg.fillTriangle(
        GAME_WIDTH / 2 - 100 + 90, btnY + 25,
        GAME_WIDTH / 2 - 100 + 90 - cutSize, btnY + 25,
        GAME_WIDTH / 2 - 100 + 90, btnY + 25 - cutSize
      );
    };
    drawConfirmBtn(COLORS.PRIMARY);

    const confirmText = this.add
      .text(GAME_WIDTH / 2 - 100, btnY, "CONFIRM", {
        fontSize: "18px",
        fontFamily: FONTS.HEADER,
        color: "#000000",
      })
      .setOrigin(0.5)
      .setDepth(1002);

    const confirmHit = this.add
      .rectangle(GAME_WIDTH / 2 - 100, btnY, 180, 50, 0xffffff, 0)
      .setDepth(1002)
      .setInteractive({ useHandCursor: true });

    confirmHit.on("pointerover", () => drawConfirmBtn(0x44ffaa));
    confirmHit.on("pointerout", () => drawConfirmBtn(COLORS.PRIMARY));

    // Cancel button
    const cancelBg = this.add.graphics().setDepth(1002);
    const drawCancelBtn = (color: number) => {
      cancelBg.clear();
      cancelBg.fillStyle(color, 1);
      cancelBg.fillRect(GAME_WIDTH / 2 + 100 - 90, btnY - 25, 180, 50);
      cancelBg.lineStyle(2, 0x000000, 0.3);
      cancelBg.strokeRect(GAME_WIDTH / 2 + 100 - 88, btnY - 23, 176, 46);
      cancelBg.fillStyle(0x1a1a2e, 1);
      cancelBg.fillTriangle(
        GAME_WIDTH / 2 + 100 - 90, btnY - 25,
        GAME_WIDTH / 2 + 100 - 90 + cutSize, btnY - 25,
        GAME_WIDTH / 2 + 100 - 90, btnY - 25 + cutSize
      );
      cancelBg.fillTriangle(
        GAME_WIDTH / 2 + 100 + 90, btnY + 25,
        GAME_WIDTH / 2 + 100 + 90 - cutSize, btnY + 25,
        GAME_WIDTH / 2 + 100 + 90, btnY + 25 - cutSize
      );
    };
    drawCancelBtn(0x555555);

    const cancelText = this.add
      .text(GAME_WIDTH / 2 + 100, btnY, "CANCEL", {
        fontSize: "18px",
        fontFamily: FONTS.HEADER,
        color: TEXT_COLORS.SECONDARY,
      })
      .setOrigin(0.5)
      .setDepth(1002);

    const cancelHit = this.add
      .rectangle(GAME_WIDTH / 2 + 100, btnY, 180, 50, 0xffffff, 0)
      .setDepth(1002)
      .setInteractive({ useHandCursor: true });

    cancelHit.on("pointerover", () => drawCancelBtn(0x777777));
    cancelHit.on("pointerout", () => drawCancelBtn(0x555555));

    const closeModal = () => {
      [
        overlay,
        panel,
        title,
        desc,
        confirmBg,
        confirmText,
        confirmHit,
        cancelBg,
        cancelText,
        cancelHit,
        ...costLines.map(() => null),
      ].forEach((obj) => obj?.destroy?.());
      this.scene.restart(); // Refresh to show updated state
    };

    confirmHit.on("pointerup", () => {
      if (this.resourceManager.unlockPlanet(planet.id, upgrade.cost)) {
        closeModal();
      }
    });

    cancelHit.on("pointerup", closeModal);
    overlay.setInteractive().on("pointerup", closeModal);
  }

  private formatCost(cost: { [key: string]: number }): string {
    return Object.entries(cost)
      .map(
        ([key, value]) =>
          `${value} ${key.charAt(0).toUpperCase() + key.slice(1)}`,
      )
      .join(", ");
  }

  private getDifficultyColor(difficulty: PlanetDifficulty): number {
    switch (difficulty) {
      case PlanetDifficulty.EASY:
        return COLORS.PLANET_EASY;
      case PlanetDifficulty.MEDIUM:
        return COLORS.PLANET_MEDIUM;
      case PlanetDifficulty.HARD:
        return COLORS.PLANET_HARD;
    }
  }

  private getDifficultyColorHex(difficulty: PlanetDifficulty): string {
    switch (difficulty) {
      case PlanetDifficulty.EASY:
        return "#44aa44";
      case PlanetDifficulty.MEDIUM:
        return "#aa8844";
      case PlanetDifficulty.HARD:
        return "#aa4444";
    }
  }

  private createBackButton(): void {
    const btn = this.add
      .text(40, 40, "< BACK", {
        fontSize: "22px",
        fontFamily: FONTS.HEADER,
        color: TEXT_COLORS.MUTED,
      })
      .setInteractive({ useHandCursor: true });

    btn.on("pointerover", () => btn.setColor("#ffffff"));
    btn.on("pointerout", () => btn.setColor(TEXT_COLORS.MUTED));
    btn.on("pointerup", () => this.scene.start(SCENES.HANGAR));
  }

  private displayResources(): void {
    const resources = this.resourceManager.getSessionResources();
    const basicText = `Min: ${resources.minerals} | Eng: ${resources.energy} | Allo: ${resources.alloys}`;
    const exoticText = `Plas: ${resources.plasma} | Crys: ${resources.crystals} | DM: ${resources.darkMatter}`;

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 65, basicText, {
        fontSize: "14px",
        fontFamily: FONTS.BODY,
        color: TEXT_COLORS.MUTED,
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 45, exoticText, {
        fontSize: "14px",
        fontFamily: FONTS.BODY,
        color: TEXT_COLORS.MUTED,
      })
      .setOrigin(0.5);
  }
}
