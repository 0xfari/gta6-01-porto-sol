// The story: five missions that take Riko from street courier to king of Porto
// Sol. Each mission is a list of steps (go to, interact, survive, defeat, hold,
// deliver); the HUD shows the current objective and the minimap its waypoint.

import { MISSIONS } from './config.js';
import { dist } from './utils.js';
import { makeCar } from './vehicles.js';
import { spawnEnemies } from './combat.js';
import { raiseWanted } from './player.js';

export const SPOTS = {
  home: { x: 700, y: 700 },
  packagePickup: { x: 1000, y: 320 },
  packageDrop: { x: 2020, y: 1520 },
  targetCar: { x: 1340, y: 920 },
  garage: { x: 320, y: 1520 },
  safehouse: { x: 2360, y: 320 },
  turf: { x: 1170, y: 770 },
  bank: { x: 1680, y: 620 },
  harbourBoat: { x: 2250, y: 1400 },
};

const DIALOG = [
  { from: 'Mara', text: 'Riko, paket ini harus sampai sebelum matahari tenggelam. Jangan tanya isinya.' },
  { from: 'Mara', text: 'Bos mau mobil emas itu. Ambil, bawa ke bengkelku. Jangan sampai ketahuan.' },
  { from: 'Mara', text: 'Polisi mengepungmu! Kabur dan sembunyi di rumah aman utara. Jangan berhenti!' },
  { from: 'Dante', text: 'Geng Viper kuasai taman ini. Usir mereka semua — Porto Sol milik kita.' },
  { from: 'Mara', text: 'Satu pekerjaan terakhir: bank pusat. Bobol brankasnya, lalu kabur ke kapal di pelabuhan.' },
];

export function createMissionState() {
  return { idx: 0, step: 0, timer: 0, progress: 0, target: null, label: '', dialog: null, dialogTimer: 0, done: false, allDone: false, hasPackage: false };
}

export function missionTitle(G) {
  if (G.mission.allDone) return 'Raja Porto Sol';
  return MISSIONS[G.mission.idx].title;
}

export function currentObjective(G) {
  const m = G.mission;
  if (m.allDone) return 'Kota ini milikmu. Nikmati Porto Sol!';
  return m.label;
}

function setStep(G, step, target, label) {
  const m = G.mission;
  m.step = step;
  m.target = target;
  m.label = label;
  m.timer = 0;
  m.progress = 0;
}

export function startMission(G, idx) {
  const m = G.mission;
  m.idx = idx;
  m.dialog = DIALOG[idx];
  m.dialogTimer = 5;
  G.message = 'MISI ' + (idx + 1) + ': ' + MISSIONS[idx].title;
  G.messageTimer = 4;
  G.audio.play('mission');
  if (idx === 0) setStep(G, 0, SPOTS.packagePickup, 'Ambil paket di utara (titik kuning)');
  else if (idx === 1) {
    const car = makeCar(SPOTS.targetCar.x, SPOTS.targetCar.y, 0, '#f2c94c', 'parked');
    car.target = true;
    G.cars.push(car);
    setStep(G, 0, SPOTS.targetCar, 'Curi mobil emas target');
  } else if (idx === 2) {
    G.player.wanted = 3;
    G.wantedTimer = 0;
    G.audio.play('siren');
    setStep(G, 0, null, 'Kabur dari polisi — bertahan 60 detik!');
    m.timer = 60;
  } else if (idx === 3) {
    setStep(G, 0, SPOTS.turf, 'Ke taman — usir geng Viper');
  } else if (idx === 4) {
    setStep(G, 0, SPOTS.bank, 'Masuk ke bank pusat');
  }
}

function completeMission(G) {
  const m = G.mission;
  const reward = MISSIONS[m.idx].reward;
  G.player.cash += reward;
  G.player.missionsDone += 1;
  G.message = 'MISI SELESAI! +$' + reward;
  G.messageTimer = 4;
  G.audio.play('complete');
  try {
    const { saveGame } = G.saveApi;
    saveGame(G);
  } catch { /* save is best-effort */ }
  if (m.idx === 1) {
    G.player.hasGun = true;
    G.player.ammo += 48;
    G.message = 'MISI SELESAI! +$' + reward + ' — Mara memberimu pistol!';
  }
  if (m.idx >= MISSIONS.length - 1) {
    m.allDone = true;
    m.label = 'Semua misi selesai!';
    m.target = null;
    G.screen = 'win';
    G.audio.play('win');
    return;
  }
  startMission(G, m.idx + 1);
}

function near(G, spot, r) {
  return dist(G.player.x, G.player.y, spot.x, spot.y) < r;
}

/** Called when the player presses E: returns true if a mission interaction happened. */
export function missionInteract(G) {
  const m = G.mission;
  if (m.allDone || G.screen !== 'play') return false;
  if (m.idx === 0 && m.step === 0 && near(G, SPOTS.packagePickup, 70)) {
    m.hasPackage = true;
    setStep(G, 1, SPOTS.packageDrop, 'Antar paket ke selatan — cepat, 120 detik!');
    m.timer = 120;
    G.audio.play('pickup');
    return true;
  }
  if (m.idx === 4 && m.step === 0 && near(G, SPOTS.bank, 90)) {
    setStep(G, 1, SPOTS.bank, 'Bobol brankas — tahan di sini!');
    m.progress = 0;
    return true;
  }
  return false;
}

export function updateMissions(G, dt) {
  const m = G.mission;
  if (m.allDone) return;
  if (m.dialogTimer > 0) m.dialogTimer -= dt;
  const p = G.player;

  if (m.idx === 0) {
    if (m.step === 1) {
      m.timer -= dt;
      m.label = 'Antar paket ke selatan — ' + Math.max(0, Math.ceil(m.timer)) + ' detik!';
      if (near(G, SPOTS.packageDrop, 80)) { m.hasPackage = false; completeMission(G); return; }
      if (m.timer <= 0) {
        G.message = 'Paket terlambat! Coba lagi dari awal misi.';
        G.messageTimer = 3;
        startMission(G, 0);
      }
    }
  } else if (m.idx === 1) {
    if (m.step === 0) {
      const target = G.cars.find((c) => c.target);
      if (target && p.inCar === target) {
        setStep(G, 1, SPOTS.garage, 'Bawa mobil emas ke bengkel barat');
      }
    } else if (m.step === 1 && p.inCar && p.inCar.target && near(G, SPOTS.garage, 110)) {
      const target = p.inCar;
      const i = G.cars.indexOf(target);
      if (i >= 0) G.cars.splice(i, 1);
      p.inCar = null;
      completeMission(G);
    }
  } else if (m.idx === 2) {
    if (m.step === 0) {
      m.timer -= dt;
      p.wanted = Math.max(p.wanted, 2);
      m.label = 'Kabur dari polisi — ' + Math.max(0, Math.ceil(m.timer)) + ' detik lagi!';
      if (m.timer <= 0) setStep(G, 1, SPOTS.safehouse, 'Sampai di rumah aman utara!');
      if (p.wanted === 0) m.timer = Math.min(m.timer + dt * 2, 60);
    } else if (m.step === 1 && near(G, SPOTS.safehouse, 90)) {
      p.wanted = 0;
      G.cops.length = 0;
      completeMission(G);
    }
  } else if (m.idx === 3) {
    if (m.step === 0 && near(G, SPOTS.turf, 130)) {
      spawnEnemies(G, SPOTS.turf, 5);
      setStep(G, 1, SPOTS.turf, 'Kalahkan 5 anggota geng Viper!');
    } else if (m.step === 1) {
      const left = G.enemies.filter((e) => e.hp > 0).length;
      m.label = 'Kalahkan geng Viper — sisa ' + left;
      if (left === 0) completeMission(G);
    }
  } else if (m.idx === 4) {
    if (m.step === 1) {
      if (near(G, SPOTS.bank, 110) && !p.inCar) {
        m.progress += dt / 5;
        m.label = 'Membobol brankas… ' + Math.floor(m.progress * 100) + '%';
        if (Math.random() < dt * 0.5) raiseWanted(G, 1);
        if (m.progress >= 1) {
          p.cash += 500;
          p.wanted = 5;
          G.audio.play('siren');
          setStep(G, 2, SPOTS.harbourBoat, 'Kabur ke kapal di pelabuhan! Wanted 5!');
        }
      } else {
        m.label = 'Kembali ke bank — tahan di dekat pintu!';
      }
    } else if (m.step === 2 && near(G, SPOTS.harbourBoat, 110)) {
      completeMission(G);
    }
  }
}
