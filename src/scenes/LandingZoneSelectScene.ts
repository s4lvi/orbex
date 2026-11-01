import Phaser from 'phaser';
import { SCENES, COLORS, GAME_WIDTH, GAME_HEIGHT, FONTS, TEXT_COLORS, MaterialType, MATERIAL_COLORS, DEFAULT_GRID_WIDTH, DEFAULT_GRID_HEIGHT, DROP_CARGO, DROP_CARGO_FREE } from '../utils/Constants';
import { ResourceManager } from '../systems/ResourceManager';
import { PlanetData } from '../data/planets';
import { ModifierId, MODIFIERS, rollModifiers } from '../data/modifiers';
import { ContractId, CONTRACTS, rollContract } from '../data/contracts';
import { PathData } from '../types/GameData';

/** Resource-derived threat range for a zone, before the planet multiplier. */
export const ZONE_DIFFICULTY_MIN = 0.8;
export const ZONE_DIFFICULTY_MAX = 1.4;

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
  paths: PathData[];
  resourceGeneration: { [key in MaterialType]?: number }; // per-wave generation for the mine
  /** Resource-derived threat (ZONE_DIFFICULTY_MIN..MAX). Planet multiplier applied by DifficultyManager. */
  difficulty: number;
  modifiers: ModifierId[]; // drop-level conditions, see data/modifiers.ts
  contract: ContractId;    // optional bonus objective, see data/contracts.ts
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
  private rolledModifiers: ModifierId[] = [];
  private rolledContract: ContractId = 'STANDARD';

  constructor() {
    super({ key: SCENES.LANDING_ZONE_SELECT });
  }

  create(): void {
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

    // Roll drop modifiers based on the (now-known) difficulty, normalised 0..1.
    this.rolledModifiers = rollModifiers(this.normalizedDifficulty());

    // Roll a contract objective for this drop.
    this.rolledContract = rollContract();

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

    // Richer sites are better defended: 0.8 (nothing) to 1.4 (dense rare nodes).
    const baseFromBasic = Math.min(totalBasic / 160, 0.25);
    const baseFromRare = Math.min(totalRare / 85, 0.35);
    this.calculatedDifficulty = ZONE_DIFFICULTY_MIN + baseFromBasic + baseFromRare;
  }

  /** Zone difficulty mapped to 0..1 for display and modifier rolls. */
  private normalizedDifficulty(): number {
    return (this.calculatedDifficulty - ZONE_DIFFICULTY_MIN) / (ZONE_DIFFICULTY_MAX - ZONE_DIFFICULTY_MIN);
  }

  private createPreviewPanel(): void {
    this.previewPanel = this.add.container(GAME_WIDTH / 2, 950);
    this.previewPanel.setDepth(100); // Make sure it's on top but doesn't block map input

    // Panel background
    const panelBg = this.add.rectangle(0, 0, 680, 360, COLORS.PANEL_BG);
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
    const panelBg = this.add.rectangle(0, 0, 680, 360, COLORS.PANEL_BG);
    panelBg.setStrokeStyle(3, COLORS.PANEL_BORDER);
    this.previewPanel.add(panelBg);

    // Title
    this.previewPanel.add(this.add.text(0, -155, 'EXTRACTION SITE PREVIEW', {
      fontSize: '22px',
      fontFamily: FONTS.HEADER,
      color: TEXT_COLORS.PRIMARY,
    }).setOrigin(0.5));

    // Difficulty
    const diffPercent = Math.round(this.normalizedDifficulty() * 100);
    const diffColor = diffPercent < 40 ? '#44aa44' : diffPercent < 70 ? '#aaaa44' : '#aa4444';
    const waves = this.computeWaveCount();
    const pathCount = this.computePathCount();
    this.previewPanel.add(this.add.text(0, -125, `Threat: ${diffPercent}%  ·  ${waves} waves  ·  ${pathCount} path${pathCount === 1 ? '' : 's'}`, {
      fontSize: '18px',
      fontFamily: FONTS.HEADER,
      color: diffColor
    }).setOrigin(0.5));

    // Cargo the dropship will carry down: the only materials spendable in the drop.
    const cargo = new ResourceManager(this).previewCargo(DROP_CARGO, DROP_CARGO_FREE);
    const cargoText = Object.entries(cargo).map(([mat, amount]) => `${amount} ${mat}`).join('  ·  ');
    this.previewPanel.add(this.add.text(0, -104, `Cargo: ${cargoText}`, {
      fontSize: '13px',
      fontFamily: FONTS.BODY,
      color: '#00ffff'
    }).setOrigin(0.5));

    // Two columns below the header: mine output (left), contract + conditions (right).
    const columnTop = -80;
    const leftX = -320;
    const rightX = 20;
    let resourceY = columnTop;
    const resourceDisplay: { key: MaterialType; label: string }[] = [
      { key: MaterialType.CARBOX, label: 'Carbox' },
      { key: MaterialType.HYDRON, label: 'Hydron' },
      { key: MaterialType.TITAGEN, label: 'Titagen' },
      { key: MaterialType.OXYON, label: 'Oxyon' },
      { key: MaterialType.PLUTONIA, label: 'Plutonia' },
      { key: MaterialType.XITANIUM, label: 'Xitanium' },
      { key: MaterialType.NANON, label: 'Nanon' }
    ];

    this.previewPanel.add(this.add.text(leftX, resourceY, 'Mine output per wave:', {
      fontSize: '15px',
      fontFamily: FONTS.BODY,
      color: TEXT_COLORS.SECONDARY
    }).setOrigin(0, 0.5));

    resourceY += 24;
    const anyResources = Object.values(this.selectedResourceGeneration).some(v => (v || 0) > 0);
    if (!anyResources) {
      this.previewPanel.add(this.add.text(leftX, resourceY, 'No resource nodes in radius', {
        fontSize: '13px',
        fontFamily: FONTS.BODY,
        color: TEXT_COLORS.MUTED
      }).setOrigin(0, 0.5));
    }
    resourceDisplay.forEach(({ key, label }) => {
      const amount = this.selectedResourceGeneration[key] || 0;
      if (amount > 0) {
        const colorHex = MATERIAL_COLORS[key].toString(16).padStart(6, '0');
        this.previewPanel.add(this.add.text(leftX, resourceY, `${label}: +${amount}`, {
          fontSize: '13px',
          fontFamily: FONTS.BODY,
          color: `#${colorHex}`
        }).setOrigin(0, 0.5));
        resourceY += 19;
      }
    });

    // Contract objective
    const contract = CONTRACTS[this.rolledContract];
    let rightY = columnTop;
    this.previewPanel.add(this.add.text(rightX, rightY, 'Contract:', {
      fontSize: '15px',
      fontFamily: FONTS.BODY,
      color: TEXT_COLORS.SECONDARY,
    }).setOrigin(0, 0.5));
    this.previewPanel.add(this.add.text(rightX + 80, rightY, contract.name, {
      fontSize: '15px',
      fontFamily: FONTS.HEADER,
      color: '#ffcc44',
    }).setOrigin(0, 0.5));
    rightY += 20;
    this.previewPanel.add(this.add.text(rightX, rightY, contract.objective, {
      fontSize: '12px',
      fontFamily: FONTS.BODY,
      color: TEXT_COLORS.MUTED,
      wordWrap: { width: 300 },
    }).setOrigin(0, 0.5));
    rightY += 30;

    // Drop conditions / modifiers
    this.previewPanel.add(this.add.text(rightX, rightY, 'Drop conditions:', {
      fontSize: '15px',
      fontFamily: FONTS.BODY,
      color: TEXT_COLORS.SECONDARY,
    }).setOrigin(0, 0.5));
    rightY += 22;

    if (this.rolledModifiers.length === 0) {
      this.previewPanel.add(this.add.text(rightX, rightY, 'Nominal - no anomalies detected.', {
        fontSize: '13px',
        fontFamily: FONTS.BODY,
        color: TEXT_COLORS.MUTED,
      }).setOrigin(0, 0.5));
    } else {
      for (const id of this.rolledModifiers) {
        const mod = MODIFIERS[id];
        this.previewPanel.add(this.add.text(rightX, rightY, mod.name, {
          fontSize: '13px',
          fontFamily: FONTS.HEADER,
          color: mod.color,
        }).setOrigin(0, 0.5));
        rightY += 16;
        const desc = this.add.text(rightX + 10, rightY, mod.description, {
          fontSize: '11px',
          fontFamily: FONTS.BODY,
          color: TEXT_COLORS.MUTED,
          wordWrap: { width: 300 },
        }).setOrigin(0, 0);
        this.previewPanel.add(desc);
        rightY += desc.height + 8;
      }
    }

    // Launch button with industrial style
    const btnWidth = 300;
    const btnHeight = 60;
    const btnX = 0;
    const btnY = 140;
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

  /** Path count scales with threat, within the planet's configured range. */
  private computePathCount(): number {
    const t = this.normalizedDifficulty();
    return Math.round(this.planet.minPaths + (this.planet.maxPaths - this.planet.minPaths) * t);
  }

  /** Wave count: 75%-120% of the planet baseline by threat, then the contract multiplier. */
  private computeWaveCount(): number {
    const t = this.normalizedDifficulty();
    const base = Math.round(this.planet.waves * (0.75 + 0.45 * t));
    const contractData = CONTRACTS[this.rolledContract];
    return Math.max(1, Math.round(base * (contractData.waveCountMultiplier ?? 1)));
  }

  private launchMission(): void {
    const pathCount = this.computePathCount();
    const paths = this.generatePaths(pathCount);
    const adjustedWaveCount = this.computeWaveCount();

    const zone: LandingZone = {
      id: Date.now(), // Unique ID for each zone
      pathCount,
      paths,
      resourceGeneration: { ...this.selectedResourceGeneration },
      difficulty: this.calculatedDifficulty,
      modifiers: [...this.rolledModifiers],
      contract: this.rolledContract,
    };

    this.registry.set('selectedZone', zone);
    this.registry.set('zoneWaveCount', adjustedWaveCount);
    this.registry.set('defendingMineId', null);
    this.scene.start(SCENES.GAME);
  }

  private generatePaths(count: number): PathData[] {
    // Get grid size from planet configuration
    const gridWidth = this.planet.gridSize?.width || DEFAULT_GRID_WIDTH;
    const gridHeight = this.planet.gridSize?.height || DEFAULT_GRID_HEIGHT;
    const centerX = Math.floor(gridWidth / 2);
    const centerY = Math.floor(gridHeight / 2);

    const paths: PathData[] = [];

    // Paths enter from a different edge each, starting on a random side.
    const edges: ('left' | 'top' | 'right' | 'bottom')[] = ['left', 'top', 'right', 'bottom'];
    const firstEdge = Phaser.Math.Between(0, edges.length - 1);

    for (let i = 0; i < count; i++) {
      const edge = edges[(firstEdge + i) % edges.length];

      let startX: number;
      let startY: number;

      // Determine starting position based on edge
      switch (edge) {
        case 'left':
          startX = 0;
          startY = Phaser.Math.Between(1, gridHeight - 2);
          break;
        case 'top':
          startX = Phaser.Math.Between(1, gridWidth - 2);
          startY = 0;
          break;
        case 'right':
          startX = gridWidth - 1;
          startY = Phaser.Math.Between(1, gridHeight - 2);
          break;
        case 'bottom':
          startX = Phaser.Math.Between(1, gridWidth - 2);
          startY = gridHeight - 1;
          break;
      }

      const waypoints: { x: number; y: number }[] = [];
      const waypointCount = Phaser.Math.Between(2, 4);

      let currentX = startX;
      let currentY = startY;

      // Generate waypoints that gradually move toward center
      for (let j = 0; j < waypointCount; j++) {
        // Progress factor increases as we get closer to center
        const progressFactor = 0.3 + (j + 1) / (waypointCount + 1) * 0.2;

        // Interpolate toward center with some randomness
        const targetX = Math.floor(currentX + (centerX - currentX) * progressFactor);
        const targetY = Math.floor(currentY + (centerY - currentY) * progressFactor);

        currentX = Phaser.Math.Clamp(
          targetX + Phaser.Math.Between(-2, 2),
          1,
          gridWidth - 2
        );
        currentY = Phaser.Math.Clamp(
          targetY + Phaser.Math.Between(-2, 2),
          1,
          gridHeight - 2
        );

        waypoints.push({ x: currentX, y: currentY });
      }

      // Final waypoint at center (the base location)
      waypoints.push({ x: centerX, y: centerY });

      paths.push({ startX, startY, waypoints });
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
