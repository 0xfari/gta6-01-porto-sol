// Pedestrians: walkers on the sidewalks who stroll, pause, chat in pairs, and
// run away screaming when there is chaos nearby (gunfire, a speeding car, cops).

import { WORLD, ROADS_X, ROADS_Y, ROAD_W } from './config.js';
import { pick, dist } from './utils.js';
import { collideBuildings, clampToWorld } from './world.js';

const SHIRTS = ['#e8e8e8', '#f2c94c', '#7de07d', '#e84a4a', '#4a90e8', '#ff8c42', '#c96fd8', '#29e6d8'];

export function spawnPedestrians(G, rng, count) {
  for (let i = 0; i < count; i += 1) {
    const onVertical = rng() < 0.5;
    let x, y;
    if (onVertical) {
      x = pick(rng, ROADS_X) + (rng() < 0.5 ? -1 : 1) * (ROAD_W / 2 + 12);
      y = 120 + rng() * (WORLD.height - 240);
    } else {
      x = 160 + rng() * (WORLD.width - 320);
      y = pick(rng, ROADS_Y) + (rng() < 0.5 ? -1 : 1) * (ROAD_W / 2 + 12);
    }
    G.peds.push({
      x, y, angle: rng() * Math.PI * 2, speed: 34 + rng() * 30,
      shirt: pick(rng, SHIRTS), state: 'walk', timer: 2 + rng() * 6,
      fleeX: 0, fleeY: 0, panic: 0,
    });
  }
}

export function scarePeds(G, x, y, radius) {
  for (const ped of G.peds) {
    if (dist(ped.x, ped.y, x, y) < radius) {
      ped.state = 'flee';
      ped.panic = 1;
      ped.fleeX = ped.x - x;
      ped.fleeY = ped.y - y;
      const len = Math.hypot(ped.fleeX, ped.fleeY) || 1;
      ped.fleeX /= len;
      ped.fleeY /= len;
    }
  }
}

export function updatePedestrians(G, dt) {
  const p = G.player;
  for (const ped of G.peds) {
    ped.timer -= dt;
    if (ped.state === 'flee') {
      ped.x += ped.fleeX * 190 * dt;
      ped.y += ped.fleeY * 190 * dt;
      ped.angle = Math.atan2(ped.fleeY, ped.fleeX);
      ped.panic -= dt * 0.4;
      if (ped.panic <= 0) { ped.state = 'walk'; ped.timer = 1 + Math.random() * 3; }
    } else {
      // A speeding car or a wanted player nearby startles walkers.
      const chaos = (p.inCar && Math.abs(p.inCar.speed) > 300) || p.wanted >= 3;
      if (chaos && dist(ped.x, ped.y, p.x, p.y) < 170) {
        ped.state = 'flee';
        ped.panic = 1.2;
        ped.fleeX = ped.x - p.x;
        ped.fleeY = ped.y - p.y;
        const len = Math.hypot(ped.fleeX, ped.fleeY) || 1;
        ped.fleeX /= len;
        ped.fleeY /= len;
        continue;
      }
      if (ped.timer <= 0) {
        ped.timer = 2 + Math.random() * 5;
        ped.angle += (Math.random() - 0.5) * 2.2;
        if (Math.random() < 0.25) ped.state = 'idle';
        else ped.state = 'walk';
      }
      if (ped.state === 'walk') {
        ped.x += Math.cos(ped.angle) * ped.speed * dt;
        ped.y += Math.sin(ped.angle) * ped.speed * dt;
      }
    }
    collideBuildings(G.city, ped, 10);
    clampToWorld(ped, 20);
  }
}
