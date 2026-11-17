// The player on foot: WASD movement, facing, punching, health and armour,
// and getting in and out of cars. Driving itself lives in vehicles.js.

import { PLAYER, WORLD } from './config.js';
import { clamp, dist } from './utils.js';
import { collideBuildings, clampToWorld } from './world.js';

export function createPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, hp: PLAYER.hp, armor: 0,
    cash: 0, wanted: 0, hasGun: false, ammo: 0,
    inCar: null, punchTimer: 0, hurtTimer: 0, moving: false,
    carsStolen: 0, missionsDone: 0,
  };
}

export function hurtPlayer(G, amount, source) {
  const p = G.player;
  if (p.hurtTimer > 0 || G.screen !== 'play') return;
  let left = amount;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, left * 0.6);
    p.armor -= absorbed;
    left -= absorbed;
  }
  p.hp -= left;
  p.hurtTimer = 0.5;
  G.shake = Math.max(G.shake, 6);
  if (source) addParticles(G, p.x, p.y, '#ff5a4d', 10);
  if (p.hp <= 0) {
    p.hp = 0;
    G.screen = 'over';
    G.overReason = 'wasted';
    G.audio.play('gameover');
  }
}

export function addParticles(G, x, y, color, n) {
  for (let i = 0; i < n; i += 1) {
    if (G.particles.length > 220) return;
    const a = Math.random() * Math.PI * 2;
    const s = 40 + Math.random() * 160;
    G.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.4 + Math.random() * 0.5, max: 0.9, color, size: 2 + Math.random() * 3 });
  }
}

export function addSkid(G, x, y, angle) {
  if (G.skids.length > 300) G.skids.shift();
  G.skids.push({ x, y, angle, life: 6 });
}

/** On-foot step: move with the input vector, collide with buildings, face movement. */
export function updatePlayerOnFoot(G, dt, move) {
  const p = G.player;
  const speed = move.any ? PLAYER.walkSpeed : 0;
  p.moving = move.any;
  if (move.any) {
    p.x += move.x * speed * dt;
    p.y += move.y * speed * dt;
    p.angle = Math.atan2(move.y, move.x);
  }
  collideBuildings(G.city, p, PLAYER.radius);
  clampToWorld(p, 24);
  if (p.punchTimer > 0) p.punchTimer -= dt;
  if (p.hurtTimer > 0) p.hurtTimer -= dt;
}

/** Punch the nearest enemy / cop / pedestrian in front of the player. */
export function playerPunch(G) {
  const p = G.player;
  if (p.punchTimer > 0 || p.inCar) return;
  p.punchTimer = PLAYER.punchCooldown;
  G.audio.play('punch');
  const hx = p.x + Math.cos(p.angle) * 30;
  const hy = p.y + Math.sin(p.angle) * 30;
  let hitSomething = false;
  for (const e of G.enemies) {
    if (e.hp > 0 && dist(hx, hy, e.x, e.y) < PLAYER.punchRange) {
      e.hp -= PLAYER.punchDamage;
      e.flash = 0.2;
      addParticles(G, e.x, e.y, '#ffd23e', 8);
      hitSomething = true;
      if (e.hp <= 0) G.player.cash += 25;
    }
  }
  for (const c of G.cops) {
    if (c.onFoot && dist(hx, hy, c.x, c.y) < PLAYER.punchRange) {
      c.hp -= PLAYER.punchDamage;
      addParticles(G, c.x, c.y, '#ffd23e', 8);
      hitSomething = true;
      if (c.hp <= 0) { c.down = true; raiseWanted(G, 2); }
    }
  }
  if (hitSomething) G.shake = Math.max(G.shake, 3);
}

export function raiseWanted(G, stars) {
  const p = G.player;
  p.wanted = clamp(p.wanted + stars, 0, 5);
  G.wantedTimer = 0;
  if (p.wanted >= 3) G.audio.play('siren');
}
