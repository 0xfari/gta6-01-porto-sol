// Porto Sol — boot and the one loop. Input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there.
// Screens: title, play, paused, game over, win.
//
// ?seed=N fixes the city. ?shot=chase|drive|mission|start (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { STEP, ROADS_X, ROADS_Y } from './config.js';
import { createRandom } from './utils.js';
import { buildCity } from './world.js';
import { createPlayer, updatePlayerOnFoot, playerPunch } from './player.js';
import { spawnParkedCars, nearestCar, enterCar, exitCar, updateDriving } from './vehicles.js';
import { spawnTraffic, updateTraffic, bumpTraffic } from './traffic.js';
import { spawnPedestrians, updatePedestrians } from './pedestrians.js';
import { updateWanted, updatePolice } from './police.js';
import { startMission, updateMissions, missionInteract, SPOTS, createMissionState } from './missions.js';
import { spawnPickups, updateCombat, playerShoot } from './combat.js';
import { createAudio } from './audio.js';
import { createSaveApi } from './save.js';
import { createRenderer } from './render.js';
import { createInput, ACT_INTERACT, ACT_PUNCH, ACT_PAUSE, ACT_CONFIRM, ACT_MUTE } from './input.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 7;

const canvas = document.getElementById('game');
const rng = createRandom(seed);
const audio = createAudio();
const saveApi = createSaveApi();

// The one shared game state every module reads and writes.
const G = {
  time: 0,
  clock: 17.5 * 3600,
  screen: 'title',
  overReason: 'wasted',
  city: buildCity(rng),
  roadsX: ROADS_X,
  roadsY: ROADS_Y,
  player: createPlayer(SPOTS.home.x, SPOTS.home.y),
  cars: [],
  traffic: [],
  peds: [],
  cops: [],
  roadblocks: [],
  enemies: [],
  bullets: [],
  particles: [],
  skids: [],
  pickups: [],
  wantedTimer: 0,
  message: '',
  messageTimer: 0,
  shake: 0,
  camera: { x: SPOTS.home.x, y: SPOTS.home.y, zoom: 1 },
  audio,
  saveApi,
  rng,
  driveApi: updateDriving,
  pedApi: { spawnPedestrians },
  bestCash: saveApi.readBest(),
  hasSave: saveApi.hasSave(),
  saveMission: 0,
  mission: null,
};

G.mission = createMissionState();

const saved = saveApi.loadGame();
if (saved && Number.isInteger(saved.missionIdx)) G.saveMission = saved.missionIdx;

spawnParkedCars(G, rng, 14);
spawnTraffic(G, rng, 16);
spawnPedestrians(G, rng, 26);
spawnPickups(G, rng);
startMission(G, 0);

const renderer = createRenderer(canvas);

// Debug / play-test hook: lets an automated test read live state (position,
// mission, wanted). Read-only from outside; the game never reads it back.
window.__portoSol = G;

function applySave(data) {
  const p = G.player;
  p.cash = data.cash || 0;
  p.hp = data.hp || 100;
  p.armor = data.armor || 0;
  p.hasGun = !!data.hasGun;
  p.ammo = data.ammo || 0;
  p.missionsDone = data.missionsDone || 0;
  p.carsStolen = data.carsStolen || 0;
  p.x = data.x || SPOTS.home.x;
  p.y = data.y || SPOTS.home.y;
  p.wanted = 0;
  G.camera.x = p.x;
  G.camera.y = p.y;
  G.mission = createMissionState();
  startMission(G, Math.min(data.missionIdx || 0, 4));
  G.message = 'Save dimuat — lanjutkan misi ' + (G.mission.idx + 1);
  G.messageTimer = 3;
}

function newGame() {
  const p = G.player;
  Object.assign(p, createPlayer(SPOTS.home.x, SPOTS.home.y));
  G.cars = G.cars.filter((c) => !c.target);
  G.enemies.length = 0;
  G.bullets.length = 0;
  G.cops.length = 0;
  G.roadblocks.length = 0;
  G.pickups.length = 0;
  spawnPickups(G, rng);
  G.mission = createMissionState();
  G.camera.x = p.x;
  G.camera.y = p.y;
  G.camera.zoom = 1;
  startMission(G, 0);
  G.screen = 'play';
  audio.unlock();
}

function runShot(name) {
  const scene = stageShot(name, G);
  let painted = 0;
  function paint() {
    renderer.draw(G, scene.screen);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let accumulator = 0;
  let last = performance.now();

  function pressInteract() {
    const p = G.player;
    if (missionInteract(G)) return;
    if (p.inCar) { exitCar(G); return; }
    const car = nearestCar(G, p.x, p.y, 70);
    if (car) enterCar(G, car);
  }

  function step(dt) {
    G.time += dt;
    G.clock += dt * 60;
    if (G.messageTimer > 0) G.messageTimer -= dt;
    const p = G.player;
    const move = input.move();

    if (G.screen !== 'play') return;
    if (p.inCar) {
      updateDriving(G, dt, input);
      // Ram traffic cars.
      for (const t of G.traffic) {
        const d = Math.hypot(t.x - p.inCar.x, t.y - p.inCar.y);
        if (d < 52 && Math.abs(p.inCar.speed) > 120) {
          bumpTraffic(G, t, Math.abs(p.inCar.speed));
          p.inCar.speed *= 0.55;
        }
      }
    } else {
      updatePlayerOnFoot(G, dt, move);
    }
    if (p.punchTimer > 0) p.punchTimer -= dt;
    updateTraffic(G, dt);
    updatePedestrians(G, dt);
    updateWanted(G, dt);
    updatePolice(G, dt);
    updateMissions(G, dt);
    updateCombat(G, dt);
    // Particles and skid marks age.
    for (let i = G.particles.length - 1; i >= 0; i -= 1) {
      const pt = G.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) G.particles.splice(i, 1);
    }
    for (let i = G.skids.length - 1; i >= 0; i -= 1) {
      G.skids[i].life -= dt;
      if (G.skids[i].life <= 0) G.skids.splice(i, 1);
    }
    if (!p.inCar) audio.engineOff();
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACT_MUTE) {
      const muted = audio.toggleMute();
      G.message = muted ? 'Suara mati (M untuk nyalakan)' : 'Suara nyala';
      G.messageTimer = 1.5;
    }
    if (input.takeClick() && G.player.hasGun && !G.player.inCar && G.screen === 'play') {
      const m = input.mouse();
      const z = G.camera.zoom;
      const wx = (m.x - 640) / z + G.camera.x;
      const wy = (m.y - 360) / z + G.camera.y;
      playerShoot(G, wx, wy);
    }
    if (G.screen === 'title') {
      if (actions & ACT_CONFIRM) {
        if (G.hasSave) applySave(saveApi.loadGame());
        else newGame();
        G.screen = 'play';
      }
      return;
    }
    if (G.screen === 'over') {
      if (actions & ACT_CONFIRM) {
        if (G.hasSave) applySave(saveApi.loadGame());
        else newGame();
        G.screen = 'play';
      }
      return;
    }
    if (G.screen === 'win') {
      if (actions & ACT_CONFIRM) {
        G.screen = 'play';
        G.mission.allDone = true;
      }
      return;
    }
    if (actions & ACT_PAUSE) {
      G.screen = G.screen === 'paused' ? 'play' : 'paused';
      return;
    }
    if (G.screen === 'paused') {
      if (actions & ACT_CONFIRM) G.screen = 'play';
      return;
    }
    if (actions & ACT_INTERACT) pressInteract();
    if (actions & ACT_PUNCH) playerPunch(G);
  }

  // 'N' starts a fresh game from the title screen.
  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyN' && G.screen === 'title') {
      saveApi.clearSave();
      G.hasSave = false;
      newGame();
    }
  });

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (G.screen === 'play') {
      while (accumulator >= STEP) {
        step(STEP);
        accumulator -= STEP;
        if (G.screen !== 'play') break;
      }
    } else {
      accumulator = 0;
      // The title screen still lets traffic drift behind the menu.
      if (G.screen === 'title') {
        G.time += 1 / 60;
        updateTraffic(G, 1 / 60);
        updatePedestrians(G, 1 / 60);
      }
    }
    renderer.draw(G, G.screen);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && G.screen === 'play') G.screen = 'paused';
  });

  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
