// AI traffic: cars that follow the road grid in lanes, slow for the car ahead,
// and wrap around the city edge. They are the city feeling alive.

import { WORLD, ROADS_X, ROADS_Y, ROAD_W, CAR } from './config.js';
import { pick } from './utils.js';
import { makeCar, CAR_COLORS } from './vehicles.js';

export function spawnTraffic(G, rng, count) {
  for (let i = 0; i < count; i += 1) {
    const vertical = rng() < 0.5;
    const dir = rng() < 0.5 ? 1 : -1;
    let car;
    if (vertical) {
      const rx = pick(rng, ROADS_X);
      car = makeCar(rx + dir * 16, 120 + rng() * (WORLD.height - 240), dir > 0 ? Math.PI / 2 : -Math.PI / 2, pick(rng, CAR_COLORS), 'traffic');
      car.axis = 'v';
      car.road = rx;
      car.dir = dir;
    } else {
      const ry = pick(rng, ROADS_Y);
      car = makeCar(160 + rng() * (WORLD.width - 320), ry + dir * 16, dir > 0 ? 0 : Math.PI, pick(rng, CAR_COLORS), 'traffic');
      car.axis = 'h';
      car.road = ry;
      car.dir = dir;
    }
    car.speed = 130 + rng() * 90;
    car.cruise = car.speed;
    G.traffic.push(car);
  }
}

export function updateTraffic(G, dt) {
  const p = G.player;
  for (const car of G.traffic) {
    // Slow down for the car directly ahead on the same lane.
    let target = car.cruise;
    for (const other of G.traffic) {
      if (other === car || other.axis !== car.axis || other.road !== car.road || other.dir !== car.dir) continue;
      const ahead = car.axis === 'v'
        ? (other.y - car.y) * car.dir
        : (other.x - car.x) * car.dir;
      if (ahead > 0 && ahead < 90) { target = Math.min(target, other.speed * 0.7); break; }
    }
    // The player's car counts as traffic ahead too.
    if (p.inCar) {
      const pc = p.inCar;
      const onSame = car.axis === 'v'
        ? Math.abs(pc.x - car.road) < 40 && (pc.y - car.y) * car.dir > 0 && (pc.y - car.y) * car.dir < 100
        : Math.abs(pc.y - car.road) < 40 && (pc.x - car.x) * car.dir > 0 && (pc.x - car.x) * car.dir < 100;
      if (onSame) target = Math.min(target, 40);
    }
    car.speed += (target - car.speed) * Math.min(1, dt * 1.5);
    if (car.axis === 'v') {
      car.y += car.dir * car.speed * dt;
      if (car.y > WORLD.height - 60) car.y = 80;
      if (car.y < 60) car.y = WORLD.height - 80;
    } else {
      car.x += car.dir * car.speed * dt;
      if (car.x > WORLD.width - 60) car.x = 80;
      if (car.x < 60) car.x = WORLD.width - 80;
    }
  }
}

/** A traffic car the player rams hard: it spins, honks, and the player gains heat. */
export function bumpTraffic(G, car, speed) {
  if (speed < 160) return;
  car.speed = Math.max(40, car.speed * 0.4);
  G.shake = Math.max(G.shake, 5);
  G.audio.play('crash');
  if (G.player.wanted < 2) {
    G.player.wanted = Math.min(5, G.player.wanted + 1);
    G.wantedTimer = 0;
  }
}
