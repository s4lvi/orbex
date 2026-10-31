import Phaser from 'phaser';
import { gameConfig } from './config/gameConfig';
import { PersistenceManager } from './systems/PersistenceManager';
import { FONTS } from './utils/Constants';

/**
 * Phaser rasterises text with whatever font is available at draw time, so the
 * web fonts must be loaded before the first scene renders or every label
 * falls back to a serif until the next scene change.
 */
async function waitForFonts(): Promise<void> {
  if (!('fonts' in document)) return;
  const loads = [
    `400 16px ${FONTS.HEADER}`, `700 16px ${FONTS.HEADER}`,
    `400 16px ${FONTS.BODY}`, `600 16px ${FONTS.BODY}`
  ].map(spec => document.fonts.load(spec).catch(() => []));
  const timeout = new Promise<void>(resolve => setTimeout(resolve, 2500));
  await Promise.race([Promise.all(loads).then(() => undefined), timeout]);
}

function startGame(): Phaser.Game {
  // Guard against a second instance if this module is re-evaluated (dev HMR):
  // two games on one page render twice and halve the frame rate.
  const host = window as unknown as { __orbex?: Phaser.Game };
  if (host.__orbex) {
    host.__orbex.destroy(true);
  }
  const game = new Phaser.Game(gameConfig);
  host.__orbex = game;

  const persistence = PersistenceManager.init(game);
  persistence.hydrate();
  persistence.attach();

  // Flush save on tab hide / page unload so we don't lose recent state.
  const flush = () => persistence.flush();
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });

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

  return game;
}

waitForFonts().then(startGame);

// Vite HMR: changes to game code need a clean boot, not a module patch.
if (import.meta.hot) {
  import.meta.hot.accept(() => window.location.reload());
}
