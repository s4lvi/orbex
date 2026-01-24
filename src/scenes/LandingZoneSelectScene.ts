import Phaser from 'phaser';
import { SCENES, COLORS, GAME_WIDTH, GAME_HEIGHT, GRID_WIDTH, GRID_HEIGHT, FONTS, TEXT_COLORS, MaterialType, MATERIAL_COLORS } from '../utils/Constants';
import { PlanetData } from '../data/planets';

interface ResourceNode {
  x: number;
  y: number;
  type: MaterialType;
  amount: number;
  color: number;
}

export interface LandingZone {
  id: number;
  pathCount: number;
  paths: { startY: number; waypoints: { x: number; y: number }[] }[];
  resourceGeneration: { [key in MaterialType]?: number }; // per-wave generation for the mine
  difficulty: number;
}

export class LandingZoneSelectScene extends Phaser.Scene {
  private planet!: PlanetData;
  private resourceNodes: ResourceNode[] = [];
  private landingRadius: number = 120;
  private previewPanel!: Phaser.GameObjects.Container;
  private mapContainer!: Phaser.GameObjects.Container;
  private landingCircle!: Phaser.GameObjects.Graphics;
  private selectedResourceGeneration: { [key in MaterialType]?: number } = {};
  private calculatedDifficulty: number = 0;

  constructor() {
    super({ key: SCENES.LANDING_ZONE_SELECT });
  }

  create(): void {
    console.log('LandingZoneSelectScene create() called');
    this.planet = this.registry.get('selectedPlanet');

    if (!this.planet) {
      this.scene.start(SCENES.PLANET_SELECT);
      return;
    }

    // Background
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0a0a1a);

    // Title
    this.add.text(GAME_WIDTH / 2, 60, `${this.planet.name}`, {
      fontSize: '36px',
      fontFamily: FONTS.HEADER,
      color: TEXT_COLORS.PRIMARY,
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 100, 'SELECT LANDING ZONE', {
      fontSize: '18px',
      fontFamily: FONTS.HEADER,
      color: TEXT_COLORS.SECONDARY
    }).setOrigin(0.5);

    // Create planet map
    this.createPlanetMap();

    // Create preview panel
    this.createPreviewPanel();

    // Generate resource nodes
    this.generateResourceNodes();

    // Back button
    this.createBackButton();
  }

  private createPlanetMap(): void {
    const mapCenterX = GAME_WIDTH / 2;
    const mapCenterY = 470;
    const mapRadius = 260;

    // Create container for the map elements
    this.mapContainer = this.add.container(mapCenterX, mapCenterY);
    this.mapContainer.setDepth(10);

    // Planet surface circle (at 0,0 within container)
    const planetCircle = this.add.circle(0, 0, mapRadius, 0x2a2a3a);
    planetCircle.setStrokeStyle(3, this.getPlanetColor());
    this.mapContainer.add(planetCircle);

    // Use scene-level input instead of container input
    // Listen for all pointer clicks on the scene
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Calculate distance from pointer to planet center
      const dx = pointer.x - mapCenterX;
      const dy = pointer.y - mapCenterY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Only respond if click is within planet radius
      if (distance <= mapRadius) {
        this.selectLandingZone(dx, dy);
      }
    });

    // Landing circle (initially hidden)
    this.landingCircle = this.add.graphics();
    this.landingCircle.setVisible(false);
    this.landingCircle.setDepth(60);
    this.mapContainer.add(this.landingCircle);
  }

  private generateResourceNodes(): void {
    const mapRadius = 260;
    const nodeCount = Phaser.Math.Between(30, 50);

    // Resource types with weights - basic materials more common than rare
    const resourceTypes: { type: MaterialType; color: number; weight: number }[] = [
      { type: MaterialType.CARBOX, color: MATERIAL_COLORS[MaterialType.CARBOX], weight: 35 },
      { type: MaterialType.HYDRON, color: MATERIAL_COLORS[MaterialType.HYDRON], weight: 35 },
      { type: MaterialType.TITAGEN, color: MATERIAL_COLORS[MaterialType.TITAGEN], weight: 12 },
      { type: MaterialType.OXYON, color: MATERIAL_COLORS[MaterialType.OXYON], weight: 8 },
      { type: MaterialType.PLUTONIA, color: MATERIAL_COLORS[MaterialType.PLUTONIA], weight: 5 },
      { type: MaterialType.XITANIUM, color: MATERIAL_COLORS[MaterialType.XITANIUM], weight: 3 },
      { type: MaterialType.NANON, color: MATERIAL_COLORS[MaterialType.NANON], weight: 2 }
    ];

    for (let i = 0; i < nodeCount; i++) {
      // Random position within circle
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const radius = Math.sqrt(Phaser.Math.FloatBetween(0, 1)) * (mapRadius - 20);
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;

      // Pick weighted random resource type
      const totalWeight = resourceTypes.reduce((sum, rt) => sum + rt.weight, 0);
      let random = Phaser.Math.FloatBetween(0, totalWeight);
      let selectedType = resourceTypes[0];

      for (const rt of resourceTypes) {
        random -= rt.weight;
        if (random <= 0) {
          selectedType = rt;
          break;
        }
      }

      // Per-wave generation amount (smaller values since this is per-wave)
      const amount = Phaser.Math.Between(2, 8);

      const node: ResourceNode = {
        x,
        y,
        type: selectedType.type,
        amount,
        color: selectedType.color
      };

      this.resourceNodes.push(node);

      // Draw node - these are just visual, no interaction
      const nodeCircle = this.add.circle(x, y, 4, selectedType.color);
      nodeCircle.setAlpha(0.8);
      nodeCircle.setDepth(-1);
      this.mapContainer.add(nodeCircle);
    }
  }

  private selectLandingZone(x: number, y: number): void {
    // Update landing circle
    this.landingCircle.clear();
    this.landingCircle.lineStyle(3, COLORS.PRIMARY, 1);
    this.landingCircle.strokeCircle(x, y, this.landingRadius);
    this.landingCircle.fillStyle(COLORS.PRIMARY, 0.1);
    this.landingCircle.fillCircle(x, y, this.landingRadius);
    this.landingCircle.setVisible(true);

    // Calculate resources within radius
    this.calculateResourcesInRadius(x, y);

    // Update preview
    this.updatePreviewPanel();
  }

  private calculateResourcesInRadius(centerX: number, centerY: number): void {
    // Reset resource generation
    this.selectedResourceGeneration = {};

    this.resourceNodes.forEach(node => {
      const dx = node.x - centerX;
      const dy = node.y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= this.landingRadius) {
        this.selectedResourceGeneration[node.type] =
          (this.selectedResourceGeneration[node.type] || 0) + node.amount;
      }
    });

    // Calculate difficulty based on total resource generation
    const totalBasic = (this.selectedResourceGeneration[MaterialType.CARBOX] || 0) +
                       (this.selectedResourceGeneration[MaterialType.HYDRON] || 0);
    const totalRare = (this.selectedResourceGeneration[MaterialType.TITAGEN] || 0) +
                      (this.selectedResourceGeneration[MaterialType.OXYON] || 0) +
                      (this.selectedResourceGeneration[MaterialType.PLUTONIA] || 0) +
                      (this.selectedResourceGeneration[MaterialType.XITANIUM] || 0) +
                      (this.selectedResourceGeneration[MaterialType.NANON] || 0);

    // Difficulty from 0.3 to 1.0 based on resources
    const baseFromBasic = Math.min(totalBasic / 100, 0.4);
    const baseFromRare = Math.min(totalRare / 50, 0.6);
    this.calculatedDifficulty = this.planet.difficultyMultiplier * (0.3 + baseFromBasic + baseFromRare);
  }

  private createPreviewPanel(): void {
    console.log('createPreviewPanel() called');
    this.previewPanel = this.add.container(GAME_WIDTH / 2, 920);
    this.previewPanel.setDepth(100); // Make sure it's on top but doesn't block map input

    // Panel background
    const panelBg = this.add.rectangle(0, 0, 680, 300, COLORS.PANEL_BG);
    panelBg.setStrokeStyle(3, COLORS.PANEL_BORDER);
    this.previewPanel.add(panelBg);

    // Instruction text (shown initially)
    const instructionText = this.add.text(0, 0, 'Click on the map to select your landing zone', {
      fontSize: '18px',
      fontFamily: FONTS.BODY,
      color: TEXT_COLORS.MUTED,
      align: 'center'
    }).setOrigin(0.5);
    this.previewPanel.add(instructionText);
  }

  private updatePreviewPanel(): void {
    // Clear existing content
    this.previewPanel.removeAll(true);

    // Panel background
    const panelBg = this.add.rectangle(0, 0, 680, 300, COLORS.PANEL_BG);
    panelBg.setStrokeStyle(3, COLORS.PANEL_BORDER);
    this.previewPanel.add(panelBg);

    // Title
    this.previewPanel.add(this.add.text(0, -120, 'EXTRACTION SITE PREVIEW', {
      fontSize: '22px',
      fontFamily: FONTS.HEADER,
      color: TEXT_COLORS.PRIMARY,
    }).setOrigin(0.5));

    // Difficulty
    const diffPercent = Math.floor(this.calculatedDifficulty * 100);
    const diffColor = diffPercent < 40 ? '#44aa44' : diffPercent < 70 ? '#aaaa44' : '#aa4444';
    this.previewPanel.add(this.add.text(0, -85, `Difficulty: ${diffPercent}%`, {
      fontSize: '18px',
      fontFamily: FONTS.HEADER,
      color: diffColor
    }).setOrigin(0.5));

    // Resource generation header
    let resourceY = -50;
    const resourceDisplay: { key: MaterialType; label: string }[] = [
      { key: MaterialType.CARBOX, label: 'Carbox' },
      { key: MaterialType.HYDRON, label: 'Hydron' },
      { key: MaterialType.TITAGEN, label: 'Titagen' },
      { key: MaterialType.OXYON, label: 'Oxyon' },
      { key: MaterialType.PLUTONIA, label: 'Plutonia' },
      { key: MaterialType.XITANIUM, label: 'Xitanium' },
      { key: MaterialType.NANON, label: 'Nanon' }
    ];

    this.previewPanel.add(this.add.text(-250, resourceY, 'Mine Output (per wave on success):', {
      fontSize: '16px',
      fontFamily: FONTS.BODY,
      color: TEXT_COLORS.SECONDARY
    }).setOrigin(0, 0.5));

    resourceY += 30;
    resourceDisplay.forEach(({ key, label }) => {
      const amount = this.selectedResourceGeneration[key] || 0;
      if (amount > 0) {
        const colorHex = MATERIAL_COLORS[key].toString(16).padStart(6, '0');
        this.previewPanel.add(this.add.text(-250, resourceY, `${label}: +${amount}/wave`, {
          fontSize: '14px',
          fontFamily: FONTS.BODY,
          color: `#${colorHex}`
        }).setOrigin(0, 0.5));
        resourceY += 22;
      }
    });

    // Launch button with industrial style
    const btnWidth = 300;
    const btnHeight = 60;
    const btnX = 0;
    const btnY = 110;
    const cutSize = 12;

    const launchBg = this.add.graphics();
    const drawLaunchBtn = (color: number) => {
      launchBg.clear();
      launchBg.fillStyle(color, 1);
      launchBg.fillRect(btnX - btnWidth / 2, btnY - btnHeight / 2, btnWidth, btnHeight);
      launchBg.lineStyle(2, 0x000000, 0.3);
      launchBg.strokeRect(btnX - btnWidth / 2 + 3, btnY - btnHeight / 2 + 3, btnWidth - 6, btnHeight - 6);
      launchBg.fillStyle(COLORS.PANEL_BG, 1);
      launchBg.fillTriangle(
        btnX - btnWidth / 2, btnY - btnHeight / 2,
        btnX - btnWidth / 2 + cutSize, btnY - btnHeight / 2,
        btnX - btnWidth / 2, btnY - btnHeight / 2 + cutSize
      );
      launchBg.fillTriangle(
        btnX + btnWidth / 2, btnY + btnHeight / 2,
        btnX + btnWidth / 2 - cutSize, btnY + btnHeight / 2,
        btnX + btnWidth / 2, btnY + btnHeight / 2 - cutSize
      );
    };
    drawLaunchBtn(COLORS.PRIMARY);
    this.previewPanel.add(launchBg);

    const launchText = this.add.text(btnX, btnY - 5, '▼ DEPLOY ▼', {
      fontSize: '24px',
      fontFamily: FONTS.HEADER,
      color: '#000000',
    }).setOrigin(0.5);
    this.previewPanel.add(launchText);

    const launchSubtext = this.add.text(btnX, btnY + 18, 'START MISSION', {
      fontSize: '12px',
      fontFamily: FONTS.BODY,
      color: '#004422'
    }).setOrigin(0.5);
    this.previewPanel.add(launchSubtext);

    const launchHit = this.add.rectangle(btnX, btnY, btnWidth, btnHeight, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    this.previewPanel.add(launchHit);

    launchHit.on('pointerover', () => drawLaunchBtn(0x44ffaa));
    launchHit.on('pointerout', () => drawLaunchBtn(COLORS.PRIMARY));
    launchHit.on('pointerup', () => this.launchMission());
  }

  private launchMission(): void {
    // Generate tactical map based on difficulty
    const pathCount = Math.max(1, Math.min(4, Math.floor(this.calculatedDifficulty * 5)));
    const paths = this.generatePaths(pathCount);
    const waveCount = Math.floor(this.planet.waves * (0.7 + this.calculatedDifficulty * 0.6));

    const zone: LandingZone = {
      id: Date.now(), // Unique ID for each zone
      pathCount,
      paths,
      resourceGeneration: { ...this.selectedResourceGeneration },
      difficulty: this.calculatedDifficulty
    };

    this.registry.set('selectedZone', zone);
    this.registry.set('zoneWaveCount', waveCount);
    this.scene.start(SCENES.GAME);
  }

  private generatePaths(count: number): { startY: number; waypoints: { x: number; y: number }[] }[] {
    const paths: { startY: number; waypoints: { x: number; y: number }[] }[] = [];
    const usedStartYs: number[] = [];

    for (let i = 0; i < count; i++) {
      let startY: number;
      do {
        startY = Phaser.Math.Between(1, GRID_HEIGHT - 2);
      } while (usedStartYs.some(y => Math.abs(y - startY) < 2));
      usedStartYs.push(startY);

      const waypoints: { x: number; y: number }[] = [];
      const waypointCount = Phaser.Math.Between(2, 4);

      let currentX = 0;
      let currentY = startY;

      for (let j = 0; j < waypointCount; j++) {
        const segmentLength = Math.floor((GRID_WIDTH - 2) / waypointCount);
        currentX += segmentLength;
        currentY = Phaser.Math.Clamp(
          currentY + Phaser.Math.Between(-2, 2),
          1,
          GRID_HEIGHT - 2
        );
        waypoints.push({ x: currentX, y: currentY });
      }

      // Final waypoint at exit
      waypoints.push({ x: GRID_WIDTH - 1, y: Math.floor(GRID_HEIGHT / 2) });

      paths.push({ startY, waypoints });
    }

    return paths;
  }

  private getPlanetColor(): number {
    switch (this.planet.difficulty) {
      case 'easy': return COLORS.PLANET_EASY;
      case 'medium': return COLORS.PLANET_MEDIUM;
      case 'hard': return COLORS.PLANET_HARD;
      default: return COLORS.PRIMARY;
    }
  }

  private createBackButton(): void {
    const btn = this.add.text(40, 40, '< BACK', {
      fontSize: '22px',
      fontFamily: FONTS.HEADER,
      color: TEXT_COLORS.MUTED
    }).setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => btn.setColor('#ffffff'));
    btn.on('pointerout', () => btn.setColor(TEXT_COLORS.MUTED));
    btn.on('pointerup', () => this.scene.start(SCENES.PLANET_SELECT));
  }
}
