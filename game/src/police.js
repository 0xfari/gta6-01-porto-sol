// The wanted system and the police: patrol cars spawn at the city edge and
// chase the player, foot cops join at higher heat, roadblocks appear at 4+
// stars, and stars slowly cool off when the player lays low.

import { WORLD } from './config.js';
import { clamp, dist, angleTo, turnToward } from './utils.js';
import { collideBuildings, clampToWorld } from './world.js';
import { makeCar } from './vehicles.js';
import { hurtPlayer } from './player.js';

export function updateWanted(G, dt) {
  const p = G.player;
  if (p.wanted <= 0) return;
  G.wantedTimer += dt;
  // Laying low cools the heat: one star every 26 seconds without new crimes.
  if (G.wantedTimer > 26) {
    G.wantedTimer = 0;
    p.wanted = Math.max(0, p.wanted - 1);
    if (p.wanted === 0) {
      G.message = 'Polisi kehilangan jejakmu.';
      G.messageTimer = 3;
      G.cops.length = 0;
      G.roadblocks.length = 0;
    }
  }
}

function spawnCopCar(G) {
  const p = G.player;
  const angle = Math.random() * Math.PI * 2;
  const x = clamp(p.x + Math.cos(angle) * 700, 120, WORLD.width - 120);
  const y = clamp(p.y + Math.sin(angle) * 500, 120, WORLD.height - 120);
  const car = makeCar(x, y, angleTo(x, y, p.x, p.y), '#2b3a55', 'police');
  car.siren = true;
  car.speed = 200;
  G.cops.push({ car, onFoot: false, hp: 60, x, y, angle: car.angle, down: false, bustTimer: 0 });
}

export function updatePolice(G, dt) {
  const p = G.player;
  const wanted = p.wanted;
  // Keep the right number of units on the street for the current heat.
  const wantCars = wanted === 0 ? 0 : Math.min(wanted, 4);
  const carCops = G.cops.filter((c) => !c.onFoot && !c.down).length;
  if (carCops < wantCars && Math.random() < dt * 1.2) spawnCopCar(G);
  // Foot cops join the chase at 2+ stars.
  const footCops = G.cops.filter((c) => c.onFoot && !c.down).length;
  if (wanted >= 2 && footCops < wanted - 1 && Math.random() < dt * 0.8) {
    const a = Math.random() * Math.PI * 2;
    G.cops.push({
      car: null, onFoot: true, hp: 50,
      x: clamp(p.x + Math.cos(a) * 320, 60, WORLD.width - 60),
      y: clamp(p.y + Math.sin(a) * 320, 60, WORLD.height - 60),
      angle: 0, down: false, bustTimer: 0,
    });
  }
  // Roadblocks at 4+ stars: two police cars parked across the road ahead.
  if (wanted >= 4 && G.roadblocks.length === 0 && Math.random() < dt * 0.5) {
    const ahead = p.inCar ? p.inCar.angle : p.angle;
    const bx = p.x + Math.cos(ahead) * 420;
    const by = p.y + Math.sin(ahead) * 420;
    for (let i = 0; i < 2; i += 1) {
      const car = makeCar(bx + Math.cos(ahead + Math.PI / 2) * (i * 60 - 30), by + Math.sin(ahead + Math.PI / 2) * (i * 60 - 30), ahead + Math.PI / 2, '#2b3a55', 'police');
      car.siren = true;
      G.roadblocks.push(car);
      G.cars.push(car);
    }
    G.message = 'ROADBLOCK di depan! Cari jalan lain!';
    G.messageTimer = 3;
  }
  if (wanted < 4) {
    for (const rb of G.roadblocks) {
      const i = G.cars.indexOf(rb);
      if (i >= 0) G.cars.splice(i, 1);
    }
    G.roadblocks.length = 0;
  }

  for (const cop of G.cops) {
    if (cop.down) continue;
    cop.lightPhase += dt * 10;
    if (cop.onFoot) {
      const d = dist(cop.x, cop.y, p.x, p.y);
      const target = angleTo(cop.x, cop.y, p.x, p.y);
      cop.angle = turnToward(cop.angle, target, 4 * dt);
      const speed = d > 60 ? 200 : 60;
      cop.x += Math.cos(cop.angle) * speed * dt;
      cop.y += Math.sin(cop.angle) * speed * dt;
      collideBuildings(G.city, cop, 12);
      clampToWorld(cop, 20);
      // Caught on foot: a cop standing next to you for 2 seconds busts you.
      if (d < 46 && !p.inCar) {
        cop.bustTimer += dt;
        if (cop.bustTimer > 2) {
          G.screen = 'over';
          G.overReason = 'busted';
          G.audio.play('gameover');
        }
      } else cop.bustTimer = 0;
    } else if (cop.car) {
      const car = cop.car;
      const target = angleTo(car.x, car.y, p.x, p.y);
      car.angle = turnToward(car.angle, target, 2.4 * dt);
      const d = dist(car.x, car.y, p.x, p.y);
      car.speed = clamp(d * 1.1, 180, 480);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      collideBuildings(G.city, car, 24);
      clampToWorld(car, 30);
      cop.x = car.x;
      cop.y = car.y;
      cop.angle = car.angle;
      // A police car ramming the player at speed hurts them (or their car).
      // Slow nudges do not hurt, and a ram cannot land more than once
      // every 2.5 s, so one patrol car cannot drain the player's health.
      if (d < 52 && car.speed > 220) {
        if (p.inCar) {
          p.inCar.speed *= 0.6;
          G.shake = Math.max(G.shake, 5);
          G.audio.play('crash');
        } else if (!cop.ramTimer || cop.ramTimer <= 0) {
          hurtPlayer(G, 12, 'police');
          cop.ramTimer = 2.5;
        }
        car.x -= Math.cos(car.angle) * 30;
        car.y -= Math.sin(car.angle) * 30;
      }
      if (cop.ramTimer > 0) cop.ramTimer -= dt;
    }
  }
  // Drop dead / far-away units so the street never clogs.
  G.cops = G.cops.filter((c) => !c.down && dist(c.x, c.y, p.x, p.y) < 1600);
}
