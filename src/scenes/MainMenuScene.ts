import Phaser from "phaser";
import { SCENES, COLORS, GAME_WIDTH, GAME_HEIGHT, FONTS } from "../utils/Constants";

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
        fontSize: "80px",
        fontFamily: FONTS.HEADER,
        color: "#00ff88",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    // Subtitle
    this.add
      .text(GAME_WIDTH / 2, 240, "TOWER DEFENSE", {
        fontSize: "28px",
        fontFamily: FONTS.HEADER,
        color: "#666666",
        letterSpacing: 8,
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
          fontSize: "20px",
          fontFamily: FONTS.BODY,
          color: "#666666",
        },
      )
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 620, "Build turrets, collect resources, survive!", {
        fontSize: "20px",
        fontFamily: FONTS.BODY,
        color: "#666666",
      })
      .setOrigin(0.5);

    // Version
    this.add
      .text(GAME_WIDTH - 20, GAME_HEIGHT - 20, "v1.0.0", {
        fontSize: "16px",
        fontFamily: FONTS.BODY,
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
    const cutSize = 12;

    const btnBg = this.add.graphics();

    const drawButton = (fillColor: number) => {
      btnBg.clear();
      btnBg.fillStyle(fillColor, 1);
      btnBg.fillRect(x - buttonWidth / 2, y - buttonHeight / 2, buttonWidth, buttonHeight);

      // Inner border
      btnBg.lineStyle(2, 0x000000, 0.3);
      btnBg.strokeRect(x - buttonWidth / 2 + 3, y - buttonHeight / 2 + 3, buttonWidth - 6, buttonHeight - 6);

      // Cut corners
      btnBg.fillStyle(0x0a0a1a, 1);
      btnBg.fillTriangle(
        x - buttonWidth / 2, y - buttonHeight / 2,
        x - buttonWidth / 2 + cutSize, y - buttonHeight / 2,
        x - buttonWidth / 2, y - buttonHeight / 2 + cutSize
      );
      btnBg.fillTriangle(
        x + buttonWidth / 2, y + buttonHeight / 2,
        x + buttonWidth / 2 - cutSize, y + buttonHeight / 2,
        x + buttonWidth / 2, y + buttonHeight / 2 - cutSize
      );
    };

    if (enabled) {
      drawButton(COLORS.PRIMARY);
    } else {
      drawButton(0x333333);
    }

    this.add
      .text(x, y, text, {
        fontSize: "24px",
        fontFamily: FONTS.HEADER,
        color: enabled ? "#000000" : "#666666",
      })
      .setOrigin(0.5);

    if (enabled) {
      const hitZone = this.add
        .rectangle(x, y, buttonWidth, buttonHeight, 0xffffff, 0)
        .setInteractive({ useHandCursor: true });

      hitZone.on("pointerover", () => {
        drawButton(0x44ffaa);
      });

      hitZone.on("pointerout", () => {
        drawButton(COLORS.PRIMARY);
      });

      hitZone.on("pointerup", () => {
        callback();
      });
    }
  }
}
