import Phaser from "phaser";
import {
  SCENES,
  COLORS,
  GAME_WIDTH,
  GAME_HEIGHT,
  PlanetDifficulty,
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
        fontSize: "36px",
        fontFamily: "Arial",
        color: "#00ff88",
        fontStyle: "bold",
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
        fontSize: "24px",
        fontFamily: "Arial",
        color: isUnlocked ? "#ffffff" : "#888888",
        fontStyle: "bold",
      })
      .setOrigin(0, 0.5);
    card.add(nameText);

    // Difficulty label
    const diffText = this.add
      .text(-130, -38, planet.difficulty.toUpperCase(), {
        fontSize: "15px",
        fontFamily: "Arial",
        color: this.getDifficultyColorHex(planet.difficulty),
      })
      .setOrigin(0, 0.5);
    card.add(diffText);

    // Description
    const descText = this.add
      .text(-130, -5, planet.description, {
        fontSize: "13px",
        fontFamily: "Arial",
        color: isUnlocked ? "#888888" : "#555555",
        wordWrap: { width: 420 },
      })
      .setOrigin(0, 0.5);
    card.add(descText);

    // Stats
    const statsText = this.add
      .text(
        -130,
        40,
        [
          `Waves: ${planet.waves}`,
          `Paths: ${planet.minPaths}-${planet.maxPaths}`,
          `Reward: ${planet.rewardMultiplier}x`,
        ].join("  |  "),
        {
          fontSize: "13px",
          fontFamily: "Arial",
          color: isUnlocked ? "#aaaaaa" : "#555555",
        },
      )
      .setOrigin(0, 0.5);
    card.add(statsText);

    // Action button
    const btnY = 80;
    if (isUnlocked) {
      const selectBtn = this.add
        .rectangle(0, btnY, 200, 45, COLORS.PRIMARY)
        .setStrokeStyle(2, 0xffffff);
      const selectText = this.add
        .text(0, btnY, "SELECT", {
          fontSize: "18px",
          fontFamily: "Arial",
          color: "#000000",
          fontStyle: "bold",
        })
        .setOrigin(0.5);

      selectBtn.setInteractive({ useHandCursor: true });
      selectBtn.on("pointerover", () => selectBtn.setFillStyle(0x00cc66));
      selectBtn.on("pointerout", () => selectBtn.setFillStyle(COLORS.PRIMARY));
      selectBtn.on("pointerup", () => {
        this.registry.set("selectedPlanet", planet);
        this.scene.start(SCENES.LANDING_ZONE_SELECT);
      });

      card.add(selectBtn);
      card.add(selectText);
    } else {
      // Show upgrade button with cost below
      const upgrade = getShipUpgrade(planet.id);
      if (upgrade) {
        const canAfford = canAffordUpgrade(
          upgrade,
          this.resourceManager.getSessionResources(),
        );
        const btnColor = canAfford ? COLORS.PRIMARY : 0x555555;

        const upgradeBtn = this.add
          .rectangle(0, btnY - 10, 220, 40, btnColor)
          .setStrokeStyle(2, canAfford ? 0xffffff : 0x333333);
        const upgradeText = this.add
          .text(0, btnY - 10, "UNLOCK", {
            fontSize: "18px",
            fontFamily: "Arial",
            color: canAfford ? "#000000" : "#666666",
            fontStyle: "bold",
          })
          .setOrigin(0.5);

        if (canAfford) {
          upgradeBtn.setInteractive({ useHandCursor: true });
          upgradeBtn.on("pointerover", () => upgradeBtn.setFillStyle(0x00cc66));
          upgradeBtn.on("pointerout", () =>
            upgradeBtn.setFillStyle(COLORS.PRIMARY),
          );
          upgradeBtn.on("pointerup", () =>
            this.showUpgradeConfirm(planet, upgrade),
          );
        }

        card.add(upgradeBtn);
        card.add(upgradeText);

        // Cost display - smaller and further down
        const costText = this.add
          .text(0, btnY + 25, this.formatCost(upgrade.cost), {
            fontSize: "11px",
            fontFamily: "Arial",
            color: canAfford ? "#999999" : "#555555",
          })
          .setOrigin(0.5);
        card.add(costText);
      }
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
        fontFamily: "Arial",
        color: "#00ff88",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(1002);

    // Description
    const desc = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80, upgrade.description, {
        fontSize: "16px",
        fontFamily: "Arial",
        color: "#aaaaaa",
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
          fontFamily: "Arial",
          color: line.color,
        })
        .setOrigin(0.5)
        .setDepth(1002);
      costY += 30;
    });

    // Buttons
    const btnY = GAME_HEIGHT / 2 + 140;
    const confirmBtn = this.add.rectangle(
      GAME_WIDTH / 2 - 100,
      btnY,
      180,
      50,
      COLORS.PRIMARY,
    );
    confirmBtn
      .setStrokeStyle(2, 0xffffff)
      .setDepth(1002)
      .setInteractive({ useHandCursor: true });
    const confirmText = this.add
      .text(GAME_WIDTH / 2 - 100, btnY, "CONFIRM", {
        fontSize: "20px",
        fontFamily: "Arial",
        color: "#000000",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(1002);

    const cancelBtn = this.add.rectangle(
      GAME_WIDTH / 2 + 100,
      btnY,
      180,
      50,
      0x666666,
    );
    cancelBtn
      .setStrokeStyle(2, 0xffffff)
      .setDepth(1002)
      .setInteractive({ useHandCursor: true });
    const cancelText = this.add
      .text(GAME_WIDTH / 2 + 100, btnY, "CANCEL", {
        fontSize: "20px",
        fontFamily: "Arial",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(1002);

    const closeModal = () => {
      [
        overlay,
        panel,
        title,
        desc,
        confirmBtn,
        confirmText,
        cancelBtn,
        cancelText,
        ...costLines.map(() => null),
      ].forEach((obj) => obj?.destroy?.());
      this.scene.restart(); // Refresh to show updated state
    };

    confirmBtn.on("pointerup", () => {
      if (this.resourceManager.unlockPlanet(planet.id, upgrade.cost)) {
        closeModal();
      }
    });

    cancelBtn.on("pointerup", closeModal);
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
        fontSize: "24px",
        fontFamily: "Arial",
        color: "#888888",
      })
      .setInteractive({ useHandCursor: true });

    btn.on("pointerover", () => btn.setColor("#ffffff"));
    btn.on("pointerout", () => btn.setColor("#888888"));
    btn.on("pointerup", () => this.scene.start(SCENES.MAIN_MENU));
  }

  private displayResources(): void {
    const resources = this.resourceManager.getSessionResources();
    const basicText = `Min: ${resources.minerals} | Eng: ${resources.energy} | Allo: ${resources.alloys}`;
    const exoticText = `Plas: ${resources.plasma} | Crys: ${resources.crystals} | DM: ${resources.darkMatter}`;

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 65, basicText, {
        fontSize: "13px",
        fontFamily: "Arial",
        color: "#888888",
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 45, exoticText, {
        fontSize: "13px",
        fontFamily: "Arial",
        color: "#888888",
      })
      .setOrigin(0.5);
  }
}
