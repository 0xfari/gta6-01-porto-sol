// Cars: parked cars to steal, the player's driving physics, and entering /
// leaving a car. Traffic and police cars reuse the same car object shape.

import { CAR, WORLD } from './config.js';
import { clamp, dist, pick, turnToward } from './utils.js';
import { collideBuildings, clampToWorld, nearestRoadPoint } from './world.js';
import { raiseWanted, addSkid } from './player.js';

export const CAR_COLORS = ['#e84a4a', '#4a90e8', '#f2c94c', '#7de07d', '#c96fd8', '#e8e8e8', '#2b2b33', '#ff8c42', '#29e6d8'];

let nextCarId = 1;

export function makeCar(x, y, angle, color, kind) {
  return {
    id: nextCarId, x, y, angle, speed: 0, color: color || '#e84a4a',
    kind: kind || 'civil', parked: kind === 'parked', stolen: false,
    target: false, hp: 100, siren: false, lightPhase: 0,
  };
}

export function spawnParkedCars(G, rng, count) {
  for (let i = 0; i < count; i += 1) {
    const spot = nearestRoadPoint(300 + rng() * (WORLD.width - 600), 300 + rng() * (WORLD.height - 600));
    const along = rng() < 0.5;
    const off = (rng() < 0.5 ? -1 : 1) * (34 + 14);
    const x = spot.axis === 'v' ? spot.x + off : spot.x + (rng() - 0.5) * 200;
    const y = spot.axis === 'h' ? spot.y + off : spot.y + (rng() - 0.5) * 200;
    const angle = spot.axis === 'v' ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI);
    G.cars.push(makeCar(x, y, angle, pick(rng, CAR_COLORS), 'parked'));
  }
}

export function nearestCar(G, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of G.cars) {
    const d = dist(x, y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

/** Steal (or just enter) the nearest car. Stealing a parked car raises wanted. */
export function enterCar(G, car) {
  const p = G.player;
  if (!car || p.inCar) return false;
  if (car.parked && !car.stolen) {
    car.stolen = true;
    car.parked = false;
    p.carsStolen += 1;
    raiseWanted(G, 1);
    G.message = car.target ? 'Mobil target dicuri! Bawa ke bengkel.' : 'Mobil dicuri! Polisi waspada.';
    G.messageTimer = 3;
    G.audio.play('steal');
  } else {
    G.message = 'Naik mobil.';
    G.messageTimer = 1.5;
  }
  p.inCar = car;
  p.x = car.x;
  p.y = car.y;
  return true;
}

export function exitCar(G) {
  const p = G.player;
  if (!p.inCar) return;
  const car = p.inCar;
  p.inCar = null;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
  p.angle = car.angle;
  clampToWorld(p, 24);
  G.message = 'Keluar mobil.';
  G.messageTimer = 1.2;
}

/** Arcade driving: accelerate, brake, steer harder at speed, skid when turning hard. */
export function updateDriving(G, dt, input) {
  const p = G.player;
  const car = p.inCar;
  if (!car) return;
  const fwd = input.up() ? 1 : 0;
  const back = input.down() ? 1 : 0;
  const steer = (input.right() ? 1 : 0) - (input.left() ? 1 : 0);
  if (fwd) car.speed += CAR.accel * dt;
  if (back) car.speed -= car.speed > 20 ? CAR.brake * dt : CAR.accel * 0.6 * dt;
  car.speed = clamp(car.speed, -CAR.reverseMax, CAR.maxSpeed);
  // Rolling resistance + braking when no input.
  if (!fwd && !back) car.speed -= car.speed * 1.4 * dt;
  if (Math.abs(car.speed) < 4 && !fwd && !back) car.speed = 0;
  const steerAmount = steer * CAR.grip * dt * clamp(Math.abs(car.speed) / 120, 0.25, 1) * (car.speed < 0 ? -1 : 1);
  car.angle += steerAmount;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  car.x = nx;
  car.y = ny;
  const hitWall = collideBuildings(G.city, car, CAR.length / 2 - 4);
  if (hitWall) {
    if (Math.abs(car.speed) > 240) {
      G.shake = Math.max(G.shake, 7);
      G.audio.play('crash');
      addSkid(G, car.x, car.y, car.angle);
      raiseWanted(G, 0);
    }
    car.speed *= 0.4;
  }
  clampToWorld(car, 30);
  if (Math.abs(steer) > 0 && Math.abs(car.speed) > 260) {
    addSkid(G, car.x - Math.cos(car.angle) * 18, car.y - Math.sin(car.angle) * 18, car.angle);
  }
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  G.audio.engine(Math.abs(car.speed) / CAR.maxSpeed);
}
