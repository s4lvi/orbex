import Phaser from 'phaser';
import { gameConfig } from './config/gameConfig';

// Initialize the game
const game = new Phaser.Game(gameConfig);

// Handle window resize
window.addEventListener('resize', () => {
  game.scale.refresh();
});

// iOS audio unlock
document.addEventListener('touchstart', () => {
  const soundManager = game.sound as Phaser.Sound.WebAudioSoundManager;
  if (soundManager && soundManager.context && soundManager.context.state === 'suspended') {
    soundManager.context.resume();
  }
}, { once: true });

export default game;
