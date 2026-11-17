// Porto Sol, the city itself: a seeded tropical coastal grid — roads, blocks of
// buildings, a park, a beach on the west edge, a harbour in the south-east —
// plus the collision helpers the rest of the game asks about it.

import { WORLD, ROADS_X, ROADS_Y, ROAD_W } from './config.js';
import { pick } from './utils.js';

const BUILDING_COLORS = ['#c96f4a', '#d8a24a', '#7a9e7e', '#b06a8e', '#8e7cc3', '#4a7d96', '#c25b5b', '#e0b25f'];
const NEON = ['#ff4d8d', '#29e6d8', '#ffd23e', '#9d6bff'];

export function buildCity(rng) {
  const buildings = [];
  const palms = [];
  const lamps = [];
  const signs = [];

  // One or two buildings per block between the roads.
  for (let ix = 0; ix < ROADS_X.length - 1; ix += 1) {
    for (let iy = 0; iy < ROADS_Y.length - 1; iy += 1) {
      const x0 = ROADS_X[ix] + ROAD_W / 2 + 14;
      const y0 = ROADS_Y[iy] + ROAD_W / 2 + 14;
      const x1 = ROADS_X[ix + 1] - ROAD_W / 2 - 14;
      const y1 = ROADS_Y[iy + 1] - ROAD_W / 2 - 14;
      // The block at (1000..1340, 620..920) is the central park, not buildings.
      if (ROADS_X[ix] === 1000 && ROADS_Y[iy] === 620) continue;
      // The south-east corner block is the harbour yard.
      if (ROADS_X[ix] === 2020 && ROADS_Y[iy] === 1220) continue;
      const count = rng() < 0.45 ? 1 : 2;
      for (let b = 0; b < count; b += 1) {
        const w = 90 + rng() * 110;
        const h = 70 + rng() * 90;
        const bx = x0 + rng() * Math.max(1, (x1 - x0) - w);
        const by = y0 + rng() * Math.max(1, (y1 - y0) - h);
        buildings.push({
          x: bx, y: by, w, h,
          color: pick(rng, BUILDING_COLORS),
          roof: rng() < 0.5,
          neon: rng() < 0.55 ? pick(rng, NEON) : null,
        });
        if (rng() < 0.5) signs.push({ x: bx + w / 2, y: by + h + 6, color: pick(rng, NEON) });
      }
    }
  }

  // Palm trees along the beach and around the park.
  for (let i = 0; i < 46; i += 1) {
    palms.push({ x: 40 + rng() * 150, y: 60 + rng() * (WORLD.height - 120) });
  }
  for (let i = 0; i < 18; i += 1) {
    palms.push({ x: 1030 + rng() * 280, y: 650 + rng() * 240 });
  }
  // Street lamps at road intersections.
  for (const rx of ROADS_X) {
    for (const ry of ROADS_Y) {
      lamps.push({ x: rx + ROAD_W / 2 + 8, y: ry - ROAD_W / 2 - 8 });
    }
  }

  const park = { x: 1000 + ROAD_W / 2, y: 620 + ROAD_W / 2, w: 340 - ROAD_W, h: 300 - ROAD_W };
  const beach = { x: 0, y: 0, w: 210, h: WORLD.height };
  const sea = { x: 0, y: 0, w: 130, h: WORLD.height };
  const harbour = { x: 2020 + ROAD_W / 2, y: 1220 + ROAD_W / 2, w: 340 - ROAD_W, h: 300 - ROAD_W };

  return { buildings, palms, lamps, signs, park, beach, sea, harbour };
}

export function isOnRoad(city, x, y) {
  for (const rx of ROADS_X) if (Math.abs(x - rx) < ROAD_W / 2) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) < ROAD_W / 2) return true;
  return false;
}

export function nearestRoadPoint(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of ROADS_X) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { x: rx, y, axis: 'v' }; }
  }
  for (const ry of ROADS_Y) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = { x, y: ry, axis: 'h' }; }
  }
  return best;
}

/** Push a circle (x, y, r) out of every building it overlaps; returns true if it hit one. */
export function collideBuildings(city, body, r) {
  let hit = false;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(body.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(body.y, b.y + b.h));
    const dx = body.x - cx;
    const dy = body.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      const d = Math.sqrt(d2) || 0.001;
      body.x = cx + (dx / d) * r;
      body.y = cy + (dy / d) * r;
    }
  }
  return hit;
}

export function clampToWorld(body, margin) {
  body.x = Math.max(margin, Math.min(WORLD.width - margin, body.x));
  body.y = Math.max(margin, Math.min(WORLD.height - margin, body.y));
}
