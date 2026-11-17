// Porto Sol — every tuning number, colour and city constant in one place.
// The world is a fixed 2600x1900 top-down city; the renderer scales the 1280x720
// view to the window, so no rule below depends on the screen size.

export const WORLD = { width: 2600, height: 1900 };
export const VIEW = { width: 1280, height: 720 };
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  walkSpeed: 235,
  runSpeed: 310,
  hp: 100,
  armor: 50,
  punchDamage: 25,
  punchRange: 46,
  punchCooldown: 0.45,
};

export const CAR = {
  length: 54,
  width: 26,
  accel: 420,
  brake: 700,
  reverseMax: 150,
  maxSpeed: 520,
  grip: 2.6,
  stealRadius: 70,
};

export const WANTED = {
  max: 5,
  decaySeconds: 26,
  steal: 1,
  hitPed: 1,
  shoot: 1,
  killCop: 2,
};

export const MISSIONS = [
  { title: 'Paket Kilat', reward: 150 },
  { title: 'Mobil Pesanan', reward: 300 },
  { title: 'Kabur!', reward: 400 },
  { title: 'Rebut Wilayah', reward: 600 },
  { title: 'Heist Terakhir', reward: 1500 },
];

export const SAVE_KEY = 'porto-sol.save.v1';
export const BEST_KEY = 'porto-sol.best.v1';

export const PALETTE = {
  grass: '#7d9b4a',
  park: '#5d8a3c',
  sand: '#e8c98a',
  sea: '#2e7fa8',
  seaDeep: '#1d5c86',
  road: '#3a3a44',
  roadLine: '#e8d44d',
  sidewalk: '#b8a88e',
  buildingRoof: '#c96f4a',
  neonPink: '#ff4d8d',
  neonCyan: '#29e6d8',
  neonYellow: '#ffd23e',
  hudBg: 'rgba(12,10,24,0.72)',
  text: '#f5efe2',
  muted: '#c9bfa8',
  cash: '#7de07d',
  danger: '#ff5a4d',
  police: '#3d7bff',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

// The city grid: vertical roads at these x, horizontal roads at these y (road width 64).
export const ROADS_X = [320, 660, 1000, 1340, 1680, 2020, 2360];
export const ROADS_Y = [320, 620, 920, 1220, 1520];
export const ROAD_W = 64;
