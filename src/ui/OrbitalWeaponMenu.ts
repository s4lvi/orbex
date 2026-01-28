import Phaser from 'phaser';
import { COLORS, DEPTH, FONTS, TEXT_COLORS } from '../utils/Constants';
import { GameScene } from '../scenes/GameScene';
import { OrbitalWeaponManager } from '../systems/OrbitalWeaponManager';
import { OrbitalWeaponType, OrbitalWeaponData, getScaledOrbitalWeaponStats } from '../data/orbitalWeapons';

interface WeaponButton {
  container: Phaser.GameObjects.Container;
  type: OrbitalWeaponType;
  cooldownOverlay: Phaser.GameObjects.Graphics;
  cooldownText: Phaser.GameObjects.Text;
}

/**
 * OrbitalWeaponMenu - UI for selecting and firing orbital weapons
 */
export class OrbitalWeaponMenu {
  private scene: GameScene;
  private orbitalManager: OrbitalWeaponManager;
  private container: Phaser.GameObjects.Container;
  private weaponButtons: WeaponButton[] = [];
  private selectedIndicator: Phaser.GameObjects.Graphics;

  constructor(scene: GameScene, orbitalManager: OrbitalWeaponManager) {
    this.scene = scene;
    this.orbitalManager = orbitalManager;

    // Position on left side of screen, below top HUD
    this.container = scene.add.container(15, 150);
    this.container.setDepth(DEPTH.UI);

    // Create selected indicator (shown when a weapon is selected for targeting)
    this.selectedIndicator = scene.add.graphics();
    this.container.add(this.selectedIndicator);

    this.createMenu();

    // Listen for weapon fired event
    this.scene.events.on('orbitalWeaponFired', this.onWeaponFired, this);
  }

  private createMenu(): void {
    // Panel background
    const panelWidth = 70;
    const unlockedWeapons = this.orbitalManager.getUnlockedWeapons();
    const panelHeight = unlockedWeapons.length * 75 + 40;

    const bg = this.scene.add.graphics();
    bg.fillStyle(COLORS.PANEL_BG, 0.9);
    bg.fillRoundedRect(0, 0, panelWidth, panelHeight, 8);
    bg.lineStyle(2, COLORS.PRIMARY, 0.5);
    bg.strokeRoundedRect(0, 0, panelWidth, panelHeight, 8);
    this.container.add(bg);

    // Title
    const title = this.scene.add.text(panelWidth / 2, 12, 'ORB', {
      fontSize: '12px',
      fontFamily: FONTS.HEADER,
      color: TEXT_COLORS.PRIMARY
    }).setOrigin(0.5);
    this.container.add(title);

    // Create weapon buttons
    let y = 35;
    for (const weapon of unlockedWeapons) {
      this.createWeaponButton(panelWidth / 2, y, weapon);
      y += 75;
    }
  }

  private createWeaponButton(x: number, y: number, data: OrbitalWeaponData): void {
    const size = 50;
    const btnContainer = this.scene.add.container(x, y);

    // Background
    const bgGraphics = this.scene.add.graphics();
    const drawBg = (fillColor: number, borderColor: number = COLORS.PANEL_BORDER) => {
      bgGraphics.clear();
      bgGraphics.fillStyle(fillColor, 1);
      bgGraphics.fillRoundedRect(-size / 2, -size / 2, size, size, 6);
      bgGraphics.lineStyle(2, borderColor, 1);
      bgGraphics.strokeRoundedRect(-size / 2, -size / 2, size, size, 6);
    };
    drawBg(0x2a2a4e);
    btnContainer.add(bgGraphics);

    // Weapon icon (colored circle based on damage type)
    const iconColor = this.getWeaponColor(data);
    const icon = this.scene.add.graphics();
    icon.fillStyle(iconColor, 1);
    icon.fillCircle(0, -5, 12);
    icon.lineStyle(2, 0xffffff, 0.3);
    icon.strokeCircle(0, -5, 12);
    btnContainer.add(icon);

    // Energy cost label
    const costLabel = this.scene.add.text(0, 18, data.energyCost.toString(), {
      fontSize: '10px',
      fontFamily: FONTS.BODY,
      color: '#00ffff'
    }).setOrigin(0.5);
    btnContainer.add(costLabel);

    // Cooldown overlay (covers button when on cooldown)
    const cooldownOverlay = this.scene.add.graphics();
    cooldownOverlay.setVisible(false);
    btnContainer.add(cooldownOverlay);

    // Cooldown text
    const cooldownText = this.scene.add.text(0, 0, '', {
      fontSize: '14px',
      fontFamily: FONTS.HEADER,
      color: '#ffffff'
    }).setOrigin(0.5);
    cooldownText.setVisible(false);
    btnContainer.add(cooldownText);

    // Hit area - interactive rectangle
    const hitArea = this.scene.add.rectangle(0, 0, size, size, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    btnContainer.add(hitArea);

    // Events
    hitArea.on('pointerover', () => {
      if (!this.orbitalManager.getCooldown(data.id)) {
        drawBg(0x3a3a5e, COLORS.PRIMARY);
      }
      this.showTooltip(data, btnContainer.x + 70, btnContainer.y);
    });

    hitArea.on('pointerout', () => {
      drawBg(0x2a2a4e);
      this.hideTooltip();
    });

    hitArea.on('pointerdown', () => {
      console.log('[OrbitalWeaponMenu] Button clicked for weapon:', data.id);
      this.selectWeapon(data.id);
    });

    this.container.add(btnContainer);

    // Store reference
    this.weaponButtons.push({
      container: btnContainer,
      type: data.id,
      cooldownOverlay,
      cooldownText
    });
  }

  private getWeaponColor(data: OrbitalWeaponData): number {
    switch (data.id) {
      case OrbitalWeaponType.ORBITAL_LASER:
        return 0xff6600;  // Orange for thermal
      case OrbitalWeaponType.KINETIC_STRIKE:
        return 0xaaaaaa;  // Gray for kinetic
      case OrbitalWeaponType.CRYO_BOMB:
        return 0x00ccff;  // Cyan for cryo
      case OrbitalWeaponType.EMP_PULSE:
        return 0xffff00;  // Yellow for electric
      case OrbitalWeaponType.PLASMA_BARRAGE:
        return 0xff00ff;  // Magenta for plasma
      default:
        return COLORS.PRIMARY;
    }
  }

  private selectWeapon(type: OrbitalWeaponType): void {
    console.log('[OrbitalWeaponMenu] selectWeapon called:', type);

    // Check if already targeting with this weapon - cancel if so
    if (this.orbitalManager.getSelectedWeapon() === type) {
      console.log('[OrbitalWeaponMenu] Canceling targeting (same weapon clicked again)');
      this.orbitalManager.cancelTargeting();
      this.updateSelectedIndicator();
      return;
    }

    // Try to start targeting
    const started = this.orbitalManager.startTargeting(type);
    console.log('[OrbitalWeaponMenu] startTargeting result:', started);
    if (started) {
      this.updateSelectedIndicator();
    }
  }

  private updateSelectedIndicator(): void {
    this.selectedIndicator.clear();

    const selectedType = this.orbitalManager.getSelectedWeapon();
    if (!selectedType) return;

    const button = this.weaponButtons.find(b => b.type === selectedType);
    if (!button) return;

    // Draw selection indicator
    this.selectedIndicator.lineStyle(3, COLORS.PRIMARY, 1);
    this.selectedIndicator.strokeRoundedRect(
      button.container.x - 28,
      button.container.y - 28,
      56,
      56,
      8
    );
  }

  // Tooltip handling
  private tooltipContainer: Phaser.GameObjects.Container | null = null;

  private showTooltip(data: OrbitalWeaponData, x: number, y: number): void {
    this.hideTooltip();

    const level = this.orbitalManager.getWeaponLevel(data.id);
    const scaled = getScaledOrbitalWeaponStats(data.id, level);

    this.tooltipContainer = this.scene.add.container(x, y);
    this.tooltipContainer.setDepth(DEPTH.UI + 10);
    this.tooltipContainer.setScrollFactor(0);

    // Background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.95);
    bg.fillRoundedRect(0, -50, 180, 120, 6);
    bg.lineStyle(1, COLORS.PRIMARY, 0.8);
    bg.strokeRoundedRect(0, -50, 180, 120, 6);
    this.tooltipContainer.add(bg);

    // Name
    const name = this.scene.add.text(10, -40, data.name, {
      fontSize: '14px',
      fontFamily: FONTS.HEADER,
      color: TEXT_COLORS.PRIMARY
    });
    this.tooltipContainer.add(name);

    // Level
    const levelText = this.scene.add.text(10, -22, `Level ${level}/${data.maxLevel}`, {
      fontSize: '10px',
      fontFamily: FONTS.BODY,
      color: '#888888'
    });
    this.tooltipContainer.add(levelText);

    // Stats
    const statsText = [
      `DMG: ${scaled.damage}`,
      `AOE: ${scaled.aoeRadius > 0 ? scaled.aoeRadius : 'Single'}`,
      `CD: ${(scaled.cooldown / 1000).toFixed(1)}s`,
      `Cost: ${data.energyCost} Energy`
    ].join('\n');

    const stats = this.scene.add.text(10, -5, statsText, {
      fontSize: '11px',
      fontFamily: FONTS.MONO,
      color: TEXT_COLORS.SECONDARY,
      lineSpacing: 3
    });
    this.tooltipContainer.add(stats);
    this.scene.getCameraManager().addUIObject(this.tooltipContainer);
  }

  private hideTooltip(): void {
    if (this.tooltipContainer) {
      this.tooltipContainer.destroy();
      this.tooltipContainer = null;
    }
  }

  private onWeaponFired(_type: OrbitalWeaponType): void {
    this.updateSelectedIndicator();
  }

  /**
   * Update cooldown displays (call each frame)
   */
  public update(): void {
    for (const button of this.weaponButtons) {
      const cooldown = this.orbitalManager.getCooldown(button.type);

      if (cooldown > 0) {
        // Show cooldown overlay
        button.cooldownOverlay.clear();
        button.cooldownOverlay.fillStyle(0x000000, 0.7);
        button.cooldownOverlay.fillRoundedRect(-25, -25, 50, 50, 6);
        button.cooldownOverlay.setVisible(true);

        // Update cooldown text
        const seconds = Math.ceil(cooldown / 1000);
        button.cooldownText.setText(seconds.toString());
        button.cooldownText.setVisible(true);
      } else {
        button.cooldownOverlay.setVisible(false);
        button.cooldownText.setVisible(false);
      }
    }

    // Update selected indicator
    this.updateSelectedIndicator();
  }

  public getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  public destroy(): void {
    this.scene.events.off('orbitalWeaponFired', this.onWeaponFired, this);
    this.hideTooltip();
    this.weaponButtons = [];
    this.container.destroy();
  }
}
