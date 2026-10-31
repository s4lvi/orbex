import Phaser from 'phaser';
import { TILE_SIZE, COLORS, EnemyType, TurretType, TrapType } from './Constants';

type G = Phaser.GameObjects.Graphics;

/**
 * Procedural sprite generation. Everything the game draws is produced here at
 * boot with the Graphics API and baked into textures, so the art stays
 * consistent and needs no external assets.
 *
 * Conventions:
 *  - Enemies and turret guns face +x; entities rotate to their heading.
 *  - Enemy texture keys: `enemy-<type>`; turret keys: `turret-<type>` (base)
 *    and `turret-<type>-gun` (rotating part, pivot at ~20% from the left).
 */
export class SpriteFactory {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  public generateAll(): void {
    this.generateEnemies();
    this.generateTurrets();
    this.generateBase();
    this.generateTraps();
    this.generateProjectiles();
    this.generateTiles();
    this.generateUI();
  }

  private bake(key: string, width: number, height: number, draw: (g: G) => void): void {
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    draw(g);
    g.generateTexture(key, width, height);
    g.destroy();
  }

  private polygon(g: G, cx: number, cy: number, radius: number, sides: number, rotation: number = 0): void {
    g.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = rotation + (i / sides) * Math.PI * 2;
      const x = cx + Math.cos(a) * radius;
      const y = cy + Math.sin(a) * radius;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath();
    g.fillPath();
  }

  // ---------------------------------------------------------------- enemies

  private generateEnemies(): void {
    // Scout drone: small saucer with twin stabilisers.
    this.bake(`enemy-${EnemyType.DRONE}`, 32, 32, (g) => {
      const c = 16;
      g.fillStyle(0x551111, 1); g.fillTriangle(c - 4, c - 14, c - 14, c - 4, c - 2, c - 2);
      g.fillTriangle(c - 4, c + 14, c - 14, c + 4, c - 2, c + 2);
      g.fillStyle(0xaa2222, 1); g.fillCircle(c, c, 11);
      g.fillStyle(0xff5555, 1); g.fillCircle(c, c, 6);
      g.fillStyle(0xffffff, 0.9); g.fillCircle(c + 6, c, 2);
    });

    // Infantry: armoured hexagon with a visor.
    this.bake(`enemy-${EnemyType.SOLDIER}`, 40, 40, (g) => {
      const c = 20;
      g.fillStyle(0x661111, 1); this.polygon(g, c, c, 18, 6);
      g.fillStyle(0xcc4444, 1); this.polygon(g, c, c, 14, 6);
      g.fillStyle(0x22ffff, 0.9); g.fillRect(c + 4, c - 5, 5, 10);
      g.fillStyle(0x330808, 1); g.fillRect(c - 10, c - 2, 10, 4);
    });

    // Heavy tank: hull with treads and a turret.
    this.bake(`enemy-${EnemyType.TANK}`, 56, 56, (g) => {
      const c = 28;
      g.fillStyle(0x221111, 1); g.fillRoundedRect(c - 24, c - 22, 48, 10, 3); g.fillRoundedRect(c - 24, c + 12, 48, 10, 3);
      g.fillStyle(0x3a2a1a, 1);
      for (let x = c - 20; x < c + 22; x += 8) { g.fillRect(x, c - 20, 4, 6); g.fillRect(x, c + 14, 4, 6); }
      g.fillStyle(0x774433, 1); g.fillRoundedRect(c - 22, c - 13, 44, 26, 4);
      g.fillStyle(0x995544, 1); g.fillCircle(c - 2, c, 11);
      g.fillStyle(0x553322, 1); g.fillRect(c + 4, c - 3, 22, 6);
      g.fillStyle(0xffaa33, 0.9); g.fillCircle(c - 2, c, 3);
    });

    // Speeder: swept chevron.
    this.bake(`enemy-${EnemyType.SPEEDER}`, 30, 28, (g) => {
      g.fillStyle(0xff8888, 1);
      g.beginPath(); g.moveTo(28, 14); g.lineTo(4, 2); g.lineTo(11, 14); g.lineTo(4, 26); g.closePath(); g.fillPath();
      g.fillStyle(0xffdddd, 1);
      g.beginPath(); g.moveTo(22, 14); g.lineTo(10, 8); g.lineTo(13, 14); g.lineTo(10, 20); g.closePath(); g.fillPath();
      g.fillStyle(0x66ccff, 0.8); g.fillCircle(6, 14, 2);
    });

    // Air drone: diamond fuselage with wings.
    this.bake(`enemy-${EnemyType.FLYER}`, 40, 36, (g) => {
      g.fillStyle(0x884444, 1);
      g.fillTriangle(8, 2, 22, 18, 2, 18); g.fillTriangle(8, 34, 22, 18, 2, 18);
      g.fillStyle(0xffaaaa, 1);
      g.beginPath(); g.moveTo(38, 18); g.lineTo(20, 6); g.lineTo(8, 18); g.lineTo(20, 30); g.closePath(); g.fillPath();
      g.fillStyle(0xffffff, 0.9); g.fillCircle(22, 18, 4);
    });

    // Phase shifter: unstable ring.
    this.bake(`enemy-${EnemyType.TELEPORTER}`, 36, 36, (g) => {
      const c = 18;
      g.lineStyle(4, 0xaa44ff, 1); g.strokeCircle(c, c, 12);
      g.lineStyle(2, 0xddaaff, 0.8);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        g.lineBetween(c + Math.cos(a) * 13, c + Math.sin(a) * 13, c + Math.cos(a) * 17, c + Math.sin(a) * 17);
      }
      g.fillStyle(0xffffff, 1); g.fillCircle(c, c, 4);
    });

    // Hive carrier: broad hull with egg pods.
    this.bake(`enemy-${EnemyType.SPAWNER}`, 52, 52, (g) => {
      const c = 26;
      g.fillStyle(0x225522, 1); this.polygon(g, c, c, 24, 6, Math.PI / 6);
      g.fillStyle(0x44aa44, 1); this.polygon(g, c, c, 19, 6, Math.PI / 6);
      g.fillStyle(0x88ff88, 1);
      g.fillCircle(c - 7, c - 6, 4); g.fillCircle(c - 7, c + 6, 4); g.fillCircle(c + 5, c, 4);
      g.fillStyle(0xccffcc, 0.9); g.fillCircle(c + 14, c, 3);
    });

    // Overlord: spiked core with shield ring.
    this.bake(`enemy-${EnemyType.BOSS}`, 84, 84, (g) => {
      const c = 42;
      g.fillStyle(0xff2222, 1);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const b = a + Math.PI / 8;
        const d = a - Math.PI / 8;
        g.fillTriangle(c + Math.cos(a) * 40, c + Math.sin(a) * 40, c + Math.cos(b) * 24, c + Math.sin(b) * 24, c + Math.cos(d) * 24, c + Math.sin(d) * 24);
      }
      g.fillStyle(0x660000, 1); g.fillCircle(c, c, 26);
      g.fillStyle(0xaa0000, 1); g.fillCircle(c, c, 20);
      g.lineStyle(3, 0xffaa00, 0.9); g.strokeCircle(c, c, 14);
      g.fillStyle(0xffdd44, 1); g.fillCircle(c, c, 7);
      g.fillStyle(0xffffff, 1); g.fillCircle(c + 2, c - 2, 2);
    });
  }

  // ---------------------------------------------------------------- turrets

  private turretColor(type: TurretType): number {
    switch (type) {
      case TurretType.MACHINEGUN: return 0x999999;
      case TurretType.LASER: return 0xff6600;
      case TurretType.CRYO: return 0x00ccff;
      case TurretType.TESLA: return 0xffff00;
      case TurretType.MISSILE: return 0xff3300;
      case TurretType.RAILGUN: return 0x00ff00;
      case TurretType.PLASMA: return 0xff00ff;
    }
  }

  private generateTurrets(): void {
    const size = TILE_SIZE - 8;
    for (const type of Object.values(TurretType)) {
      const accent = this.turretColor(type);

      // Base plate: dark armoured square with corner bolts and a coloured mount.
      this.bake(`turret-${type}`, size, size, (g) => {
        const c = size / 2;
        g.fillStyle(0x2a2a36, 1); g.fillRoundedRect(0, 0, size, size, 8);
        g.fillStyle(0x45455a, 1); g.fillRoundedRect(4, 4, size - 8, size - 8, 6);
        g.lineStyle(1, 0x000000, 0.4); g.strokeRoundedRect(4, 4, size - 8, size - 8, 6);
        g.fillStyle(0x1a1a22, 1);
        for (const [bx, by] of [[9, 9], [size - 9, 9], [9, size - 9], [size - 9, size - 9]]) g.fillCircle(bx, by, 2.5);
        g.fillStyle(0x1c1c26, 1); g.fillCircle(c, c, 15);
        g.fillStyle(accent, 1); g.fillCircle(c, c, 12);
        g.fillStyle(0xffffff, 0.35); g.fillCircle(c - 3, c - 3, 4);
      });

      // Gun: drawn pointing +x in a 44x20 box; the entity pivots it at x≈9.
      this.bake(`turret-${type}-gun`, 44, 20, (g) => this.drawGun(g, type, accent));
    }
  }

  private drawGun(g: G, type: TurretType, accent: number): void {
    const mid = 10;
    g.fillStyle(0x333340, 1); g.fillCircle(9, mid, 7); // pivot hub
    switch (type) {
      case TurretType.MACHINEGUN:
        g.fillStyle(0xbbbbbb, 1); g.fillRect(8, mid - 6, 30, 4); g.fillRect(8, mid + 2, 30, 4);
        g.fillStyle(0x666666, 1); g.fillRect(34, mid - 7, 6, 14);
        break;
      case TurretType.LASER:
        g.fillStyle(0x884422, 1); g.fillRect(8, mid - 4, 26, 8);
        g.fillStyle(accent, 1); g.fillCircle(36, mid, 6);
        g.fillStyle(0xffffff, 0.8); g.fillCircle(36, mid, 2.5);
        break;
      case TurretType.CRYO:
        g.fillStyle(0x3388aa, 1); g.fillRect(8, mid - 4, 22, 8);
        g.fillStyle(accent, 1); g.fillTriangle(28, mid - 4, 28, mid + 4, 42, mid + 8); g.fillTriangle(28, mid - 4, 42, mid - 8, 42, mid + 8);
        break;
      case TurretType.TESLA:
        g.fillStyle(0x888833, 1); g.fillRect(8, mid - 3, 18, 6);
        g.fillStyle(accent, 1); g.fillCircle(32, mid, 8);
        g.fillStyle(0xffffff, 0.9); g.fillCircle(32, mid, 3);
        g.lineStyle(2, 0xffffaa, 0.9); g.lineBetween(38, mid - 5, 43, mid - 9); g.lineBetween(38, mid + 5, 43, mid + 9);
        break;
      case TurretType.MISSILE:
        g.fillStyle(0x663322, 1); g.fillRoundedRect(6, mid - 8, 28, 16, 3);
        g.fillStyle(0x221111, 1); g.fillCircle(34, mid - 4, 3.5); g.fillCircle(34, mid + 4, 3.5);
        g.fillStyle(accent, 1); g.fillCircle(34, mid - 4, 2); g.fillCircle(34, mid + 4, 2);
        break;
      case TurretType.RAILGUN:
        g.fillStyle(0x226622, 1); g.fillRect(8, mid - 2, 34, 4);
        g.fillStyle(accent, 1); g.fillRect(18, mid - 7, 24, 2); g.fillRect(18, mid + 5, 24, 2);
        g.fillStyle(0x114411, 1); g.fillRect(12, mid - 5, 6, 10);
        break;
      case TurretType.PLASMA:
        g.fillStyle(0x552255, 1); g.fillRect(8, mid - 4, 20, 8);
        g.fillStyle(accent, 0.6); g.fillCircle(34, mid, 9);
        g.fillStyle(accent, 1); g.fillCircle(34, mid, 6);
        g.fillStyle(0xffffff, 1); g.fillCircle(34, mid, 2.5);
        break;
    }
  }

  // ---------------------------------------------------------------- base

  private generateBase(): void {
    const size = TILE_SIZE * 2;
    this.bake('base', size, size, (g) => {
      const c = size / 2;
      g.fillStyle(0x1a2a22, 1); this.polygon(g, c, c, 60, 6);
      g.lineStyle(4, 0x00ff88, 1); g.beginPath();
      for (let i = 0; i <= 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const x = c + Math.cos(a) * 56, y = c + Math.sin(a) * 56;
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.strokePath();
      g.fillStyle(0x115533, 1); this.polygon(g, c, c, 40, 6, Math.PI / 6);
      g.lineStyle(2, 0x00ff88, 0.5); g.strokeCircle(c, c, 30);
      g.fillStyle(0x00ff88, 1); g.fillCircle(c, c, 18);
      g.fillStyle(0xccffee, 1); g.fillCircle(c, c, 8);
      g.fillStyle(0x00ff88, 1);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        g.fillCircle(c + Math.cos(a) * 56, c + Math.sin(a) * 56, 5);
      }
    });
  }

  // ---------------------------------------------------------------- traps

  private generateTraps(): void {
    this.bake(`trap-${TrapType.SPIKE}`, 36, 36, (g) => {
      g.fillStyle(0x444444, 1); g.fillRoundedRect(2, 2, 32, 32, 4);
      g.fillStyle(0xcccccc, 1);
      for (const [x, y] of [[9, 9], [27, 9], [18, 18], [9, 27], [27, 27]]) g.fillTriangle(x - 5, y + 4, x + 5, y + 4, x, y - 6);
    });
    this.bake(`trap-${TrapType.SLOWFIELD}`, 64, 64, (g) => {
      g.fillStyle(0x4444ff, 0.25); g.fillCircle(32, 32, 30);
      g.lineStyle(2, 0x6666ff, 0.8); g.strokeCircle(32, 32, 28); g.strokeCircle(32, 32, 18); g.strokeCircle(32, 32, 8);
    });
    this.bake(`trap-${TrapType.MINE}`, 40, 40, (g) => {
      g.fillStyle(0x222222, 1); g.fillCircle(20, 20, 18);
      g.fillStyle(0x3a3a3a, 1); g.fillCircle(20, 20, 13);
      g.fillStyle(0x555555, 1);
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; g.fillCircle(20 + Math.cos(a) * 15, 20 + Math.sin(a) * 15, 3); }
      g.fillStyle(0xff4444, 1); g.fillCircle(20, 20, 5);
    });
    this.bake(`trap-${TrapType.EMP}`, 56, 56, (g) => {
      g.fillStyle(0x333311, 1); g.fillCircle(28, 28, 26);
      g.lineStyle(3, 0xffff44, 0.9); g.strokeCircle(28, 28, 20);
      g.lineStyle(2, 0xffff44, 0.9); g.lineBetween(28, 8, 28, 48); g.lineBetween(8, 28, 48, 28);
      g.fillStyle(0xffffaa, 1); g.fillCircle(28, 28, 5);
    });
    this.bake(`trap-${TrapType.FIRE}`, 56, 56, (g) => {
      g.fillStyle(0x442200, 1); g.fillCircle(28, 28, 26);
      g.fillStyle(0xff6600, 1); g.fillTriangle(16, 40, 40, 40, 28, 8); g.fillTriangle(10, 42, 24, 42, 16, 22); g.fillTriangle(32, 42, 46, 42, 40, 22);
      g.fillStyle(0xffdd44, 1); g.fillTriangle(22, 40, 34, 40, 28, 22);
    });
  }

  // ---------------------------------------------------------------- projectiles

  private generateProjectiles(): void {
    const glowDot = (key: string, radius: number, color: number) => {
      const size = radius * 2 + 4;
      this.bake(key, size, size, (g) => {
        const c = size / 2;
        g.fillStyle(color, 0.35); g.fillCircle(c, c, radius + 2);
        g.fillStyle(color, 1); g.fillCircle(c, c, radius);
        g.fillStyle(0xffffff, 0.9); g.fillCircle(c, c, Math.max(1, radius * 0.4));
      });
    };
    glowDot('projectile-bullet', 4, 0xffffff);
    glowDot('projectile-laser', 6, 0xff6600);
    glowDot('projectile-cryo', 6, 0x00ccff);
    glowDot('projectile-electric', 8, 0xffff00);
    glowDot('projectile-missile', 8, 0xff3300);
    glowDot('projectile-railgun', 10, 0x00ff00);
    glowDot('projectile-plasma', 10, 0xff00ff);
  }

  // ---------------------------------------------------------------- tiles & UI

  private generateTiles(): void {
    const tile = (key: string, color: number, accent: number) => {
      this.bake(key, TILE_SIZE, TILE_SIZE, (g) => {
        g.fillStyle(color, 1); g.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
        g.lineStyle(1, 0x000000, 0.35); g.strokeRect(0.5, 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
        g.fillStyle(accent, 0.25); g.fillRect(TILE_SIZE / 2 - 1, TILE_SIZE / 2 - 1, 2, 2);
      });
    };
    tile('tile-ground', COLORS.TILE_GROUND, 0x000000);
    tile('tile-path', COLORS.TILE_PATH, 0xff3333);
    tile('tile-buildable', COLORS.TILE_BUILDABLE, 0x00ff88);
  }

  private generateUI(): void {
    this.bake('button', 200, 200, (g) => { g.fillStyle(COLORS.PRIMARY, 1); g.fillRect(0, 0, 200, 200); });
    this.bake('panel', 100, 100, (g) => { g.fillStyle(COLORS.PANEL_BG, 1); g.fillRect(0, 0, 100, 100); });
  }
}
