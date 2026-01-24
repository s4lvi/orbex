import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, TARGET_FPS } from '../utils/Constants';
import { BootScene } from '../scenes/BootScene';
import { MainMenuScene } from '../scenes/MainMenuScene';
import { HangarScene } from '../scenes/HangarScene';
import { PlanetSelectScene } from '../scenes/PlanetSelectScene';
import { LandingZoneSelectScene } from '../scenes/LandingZoneSelectScene';
import { GameScene } from '../scenes/GameScene';
import { ResultsScene } from '../scenes/ResultsScene';

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#0a0a1a',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  physics: {
    default: 'arcade',
    arcade: {
      debug: false
    }
  },
  fps: {
    target: TARGET_FPS,
    forceSetTimeOut: false
  },
  render: {
    pixelArt: false,
    antialias: true
  },
  scene: [
    BootScene,
    MainMenuScene,
    HangarScene,
    PlanetSelectScene,
    LandingZoneSelectScene,
    GameScene,
    ResultsScene
  ]
};
