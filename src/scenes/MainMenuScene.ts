import Phaser from "phaser";
import { SCENES, COLORS, GAME_WIDTH, GAME_HEIGHT } from "../utils/Constants";

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENES.MAIN_MENU });
  }

  create(): void {
    // Background
    this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      0x0a0a1a,
    );

    // Title
    this.add
      .text(GAME_WIDTH / 2, 150, "ORBEX", {
        fontSize: "64px",
        fontFamily: "Arial",
        color: "#00ff88",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    // Subtitle
    this.add
      .text(GAME_WIDTH / 2, 220, "Tower Defense", {
        fontSize: "32px",
        fontFamily: "Arial",
        color: "#888888",
      })
      .setOrigin(0.5);

    // Create buttons
    this.createButton(GAME_WIDTH / 2, 380, "NEW GAME", () => {
      this.scene.start(SCENES.HANGAR);
    });

    this.createButton(
      GAME_WIDTH / 2,
      460,
      "CONTINUE",
      () => {
        // Check if there's saved progress
        const completedDrops = this.registry.get("completedDrops") || 0;
        if (completedDrops > 0) {
          this.scene.start(SCENES.HANGAR);
        }
      },
      this.registry.get("completedDrops") > 0,
    );

    // Instructions
    this.add
      .text(
        GAME_WIDTH / 2,
        580,
        "Defend your extraction point from alien waves",
        {
          fontSize: "18px",
          fontFamily: "Arial",
          color: "#666666",
        },
      )
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 610, "Build turrets, collect resources, survive!", {
        fontSize: "18px",
        fontFamily: "Arial",
        color: "#666666",
      })
      .setOrigin(0.5);

    // Version
    this.add
      .text(GAME_WIDTH - 20, GAME_HEIGHT - 20, "v1.0.0", {
        fontSize: "14px",
        fontFamily: "Arial",
        color: "#444444",
      })
      .setOrigin(1, 1);
  }

  private createButton(
    x: number,
    y: number,
    text: string,
    callback: () => void,
    enabled: boolean = true,
  ): void {
    const buttonWidth = 250;
    const buttonHeight = 60;

    const bg = this.add
      .rectangle(
        x,
        y,
        buttonWidth,
        buttonHeight,
        enabled ? COLORS.PANEL_BG : 0x1a1a1a,
      )
      .setStrokeStyle(2, enabled ? COLORS.PRIMARY : 0x333333);

    const label = this.add
      .text(x, y, text, {
        fontSize: "24px",
        fontFamily: "Arial",
        color: enabled ? "#00ff88" : "#333333",
      })
      .setOrigin(0.5);

    if (enabled) {
      bg.setInteractive({ useHandCursor: true });

      bg.on("pointerover", () => {
        bg.setFillStyle(0x2a2a4e);
        label.setColor("#88ffbb");
      });

      bg.on("pointerout", () => {
        bg.setFillStyle(COLORS.PANEL_BG);
        label.setColor("#00ff88");
      });

      bg.on("pointerdown", () => {
        bg.setFillStyle(COLORS.PRIMARY);
        label.setColor("#000000");
      });

      bg.on("pointerup", () => {
        callback();
      });
    }
  }
}
