// Save / load through localStorage: one slot plus an auto-save after every
// completed mission, and the best cash total for the title screen.

import { SAVE_KEY, BEST_KEY } from './config.js';

export function createSaveApi() {
  function read(key) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
  function write(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage can be off (private windows): the game still plays, it just forgets.
    }
  }
  return {
    saveGame(G) {
      const p = G.player;
      write(SAVE_KEY, {
        cash: p.cash, hp: p.hp, armor: p.armor, hasGun: p.hasGun, ammo: p.ammo,
        missionIdx: G.mission.idx, missionsDone: p.missionsDone, carsStolen: p.carsStolen,
        x: p.x, y: p.y, savedAt: Date.now(),
      });
      const best = read(BEST_KEY);
      if (!best || p.cash > best.cash) write(BEST_KEY, { cash: p.cash, at: Date.now() });
    },
    loadGame() {
      return read(SAVE_KEY);
    },
    hasSave() {
      return read(SAVE_KEY) !== null;
    },
    readBest() {
      const best = read(BEST_KEY);
      return best ? best.cash : 0;
    },
    clearSave() {
      try { window.localStorage.removeItem(SAVE_KEY); } catch { /* best-effort */ }
    },
  };
}
