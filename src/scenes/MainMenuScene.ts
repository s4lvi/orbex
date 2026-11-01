import Phaser from "phaser";
import { SCENES, COLORS, GAME_WIDTH, GAME_HEIGHT, FONTS, TEXT_COLORS } from "../utils/Constants";
import { PersistenceManager } from "../systems/PersistenceManager";
import { SaveSlotPanel } from "../ui/SaveSlotPanel";

export class MainMenuScene extends Phaser.Scene {
  private slotPanel: SaveSlotPanel | null = null;

  constructor() {
    super({ key: SCENES.MAIN_MENU });
  }

  create(): void {
    this.slotPanel = null;

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0a0a1a);

    this.add
      .text(GAME_WIDTH / 2, 150, "ORBEX", {
        fontSize: "80px",
        fontFamily: FONTS.HEADER,
        color: "#00ff88",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 240, "TOWER DEFENSE", {
        fontSize: "28px",
        fontFamily: FONTS.HEADER,
        color: TEXT_COLORS.SECONDARY,
        letterSpacing: 8,
      })
      .setOrigin(0.5);

    const persistence = PersistenceManager.get();
    const canContinue = persistence.hasProgress();
    const canLoad = persistence.anySlotHasProgress();

    this.createButton(GAME_WIDTH / 2, 380, "NEW GAME", () => this.openSlots("new"));
    this.createButton(GAME_WIDTH / 2, 460, "CONTINUE", () => this.scene.start(SCENES.HANGAR), canContinue);
    this.createButton(GAME_WIDTH / 2, 540, "LOAD GAME", () => this.openSlots("load"), canLoad);

    this.add
      .text(GAME_WIDTH / 2, 660, "Defend your extraction point from alien waves", {
        fontSize: "20px",
        fontFamily: FONTS.BODY,
        color: TEXT_COLORS.MUTED,
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 700, "Build turrets, collect resources, survive!", {
        fontSize: "20px",
        fontFamily: FONTS.BODY,
        color: TEXT_COLORS.MUTED,
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 760, `Slot ${persistence.getActiveSlot()} active  ·  progress auto-saves`, {
        fontSize: "14px",
        fontFamily: FONTS.BODY,
        color: TEXT_COLORS.DIM,
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH - 20, GAME_HEIGHT - 20, "v1.1.0", {
        fontSize: "16px",
        fontFamily: FONTS.BODY,
        color: TEXT_COLORS.DIM,
      })
      .setOrigin(1, 1);
  }

  private openSlots(mode: "new" | "load"): void {
    if (this.slotPanel) return;
    const persistence = PersistenceManager.get();
    this.slotPanel = new SaveSlotPanel(
      this,
      mode,
      (slot) => {
        this.slotPanel = null;
        if (mode === "new") {
          persistence.startNewGame(slot);
        } else if (!persistence.loadSlot(slot)) {
          return;
        }
        // Boot re-applies defaults for any missing keys, then jumps to the hangar.
        this.scene.start(SCENES.BOOT, { next: SCENES.HANGAR });
      },
      () => {
        const changed = this.slotPanel?.changed ?? false;
        this.slotPanel = null;
        // A deleted slot can flip CONTINUE / LOAD availability and the active-slot label.
        if (changed) this.scene.restart();
      },
    );
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
      btnBg.lineStyle(2, 0x000000, 0.3);
      btnBg.strokeRect(x - buttonWidth / 2 + 3, y - buttonHeight / 2 + 3, buttonWidth - 6, buttonHeight - 6);
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

    drawButton(enabled ? COLORS.PRIMARY : 0x333333);

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
      hitZone.on("pointerover", () => drawButton(0x44ffaa));
      hitZone.on("pointerout", () => drawButton(COLORS.PRIMARY));
      hitZone.on("pointerup", () => {
        if (!this.slotPanel) callback();
      });
    }
  }
}
