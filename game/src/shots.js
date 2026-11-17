// The screenshot scenes behind ?shot=start|chase|drive|mission. Each one sets
// the real game state deterministically (same seed, same frame) and then lets
// the real rules run a few seconds, so the frame is what playing looks like.

import { SPOTS, startMission } from './missions.js';
import { makeCar, enterCar } from './vehicles.js';
import { spawnTraffic, updateTraffic } from './traffic.js';
import { updatePedestrians } from './pedestrians.js';
import { updatePolice } from './police.js';
import { spawnEnemies } from './combat.js';
import { SCREEN_TITLE, SCREEN_PLAY } from './render.js';

function fakeDriveInput() {
  return { up: () => true, down: () => false, left: () => false, right: () => false };
}

function runWorld(G, seconds, drive) {
  const steps = Math.floor(seconds * 60);
  for (let i = 0; i < steps; i += 1) {
    G.time += 1 / 60;
    if (drive && G.player.inCar) {
      const { updateDriving } = drive;
      updateDriving(G, 1 / 60, fakeDriveInput());
    }
    updateTraffic(G, 1 / 60);
    updatePedestrians(G, 1 / 60);
    if (G.player.wanted > 0) updatePolice(G, 1 / 60);
  }
}

export function stageShot(name, G) {
  // Fresh deterministic traffic for every scene.
  G.traffic.length = 0;
  G.peds.length = 0;
  spawnTraffic(G, G.rng, 16);
  const { spawnPedestrians } = G.pedApi;
  spawnPedestrians(G, G.rng, 26);
  G.camera.x = G.player.x;
  G.camera.y = G.player.y;
  G.camera.zoom = 1;

  if (name === 'chase') {
    startMission(G, 2);
    G.mission.timer = 42;
    const car = makeCar(1000, 920, 0, '#e84a4a', 'civil');
    G.cars.push(car);
    enterCar(G, car);
    car.speed = 380;
    G.player.wanted = 3;
    // Three patrol cars closing in behind the player.
    for (let i = 0; i < 3; i += 1) {
      const cop = makeCar(1000 - 180 - i * 70, 920 + (i % 2 === 0 ? 18 : -18), 0, '#2b3a55', 'police');
      cop.siren = true;
      cop.speed = 420;
      cop.lightPhase = i;
      G.cops.push({ car: cop, onFoot: false, hp: 60, x: cop.x, y: cop.y, angle: 0, down: false, bustTimer: 0 });
    }
    runWorld(G, 1.2, { updateDriving: G.driveApi });
    G.screen = 'play';
    G.camera.x = G.player.x;
    G.camera.y = G.player.y;
    G.camera.zoom = 0.78;
    G.mission.label = 'Kabur dari polisi — 42 detik lagi!';
    G.message = 'Kabur dari polisi — 42 detik lagi!';
    G.messageTimer = 99;
    return { screen: SCREEN_PLAY };
  }

  if (name === 'drive') {
    startMission(G, 1);
    const car = makeCar(320, 920, 0, '#4a90e8', 'civil');
    G.cars.push(car);
    enterCar(G, car);
    car.speed = 300;
    runWorld(G, 2.0, { updateDriving: G.driveApi });
    G.screen = 'play';
    G.camera.x = G.player.x;
    G.camera.y = G.player.y;
    G.camera.zoom = 0.8;
    G.message = 'Curi mobil emas target';
    G.messageTimer = 99;
    return { screen: SCREEN_PLAY };
  }

  if (name === 'mission') {
    startMission(G, 3);
    G.player.x = SPOTS.turf.x - 60;
    G.player.y = SPOTS.turf.y + 40;
    G.player.hasGun = true;
    G.player.ammo = 48;
    G.player.hp = 85;
    G.player.wanted = 1;
    G.mission.step = 1;
    G.mission.label = 'Kalahkan geng Viper — sisa 5';
    G.mission.target = SPOTS.turf;
    spawnEnemies(G, SPOTS.turf, 5);
    G.camera.x = G.player.x;
    G.camera.y = G.player.y;
    G.screen = 'play';
    G.message = 'Geng Viper menyerang!';
    G.messageTimer = 99;
    return { screen: SCREEN_PLAY };
  }

  // Default: the start screen over the sunset city.
  runWorld(G, 4, null);
  G.screen = 'title';
  G.camera.x = 1150;
  G.camera.y = 900;
  G.camera.zoom = 0.85;
  return { screen: SCREEN_TITLE };
}
