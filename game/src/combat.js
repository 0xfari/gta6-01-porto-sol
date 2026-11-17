// Combat: the player's pistol, rival gang enemies who chase and shoot, bullets,
// and health / armour / ammo pickups scattered around the city.

import { dist, angleTo, pick } from './utils.js';
import { collideBuildings, clampToWorld } from './world.js';
import { hurtPlayer, addParticles, raiseWanted } from './player.js';
import { scarePeds } from './pedestrians.js';

const ENEMY_SHIRTS = ['#8e2f2f', '#5b2a86', '#2f4d8e'];

export function spawnEnemies(G, spot, count) {
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2;
    G.enemies.push({
      x: spot.x + Math.cos(a) * 90, y: spot.y + Math.sin(a) * 90,
      angle: 0, hp: 60, maxHp: 60, speed: 150 + Math.random() * 30,
      shirt: pick(Math.random, ENEMY_SHIRTS), shootTimer: 1 + Math.random(), flash: 0, state: 'chase',
    });
  }
}

export function spawnPickups(G, rng) {
  const kinds = ['health', 'armor', 'ammo', 'cash'];
  const spots = [
    { x: 660, y: 320 }, { x: 1680, y: 920 }, { x: 320, y: 1220 }, { x: 2020, y: 620 },
    { x: 1000, y: 1520 }, { x: 2360, y: 920 }, { x: 660, y: 1220 }, { x: 1340, y: 1520 },
  ];
  for (let i = 0; i < spots.length; i += 1) {
    G.pickups.push({ x: spots[i].x, y: spots[i].y, kind: kinds[i % kinds.length], bob: rng() * 6 });
  }
  // A pistol pickup near the start, on the open road corner by the park —
  // always reachable, never behind a building.
  G.pickups.push({ x: 700, y: 660, kind: 'gun', bob: 0 });
}

export function playerShoot(G, worldX, worldY) {
  const p = G.player;
  if (!p.hasGun || p.ammo <= 0 || p.inCar) return;
  p.ammo -= 1;
  const angle = angleTo(p.x, p.y, worldX, worldY);
  p.angle = angle;
  G.bullets.push({ x: p.x + Math.cos(angle) * 20, y: p.y + Math.sin(angle) * 20, vx: Math.cos(angle) * 900, vy: Math.sin(angle) * 900, life: 0.7, friendly: true });
  G.audio.play('shoot');
  G.shake = Math.max(G.shake, 2);
  scarePeds(G, p.x, p.y, 320);
  if (p.wanted < 1) raiseWanted(G, 1);
}

export function updateCombat(G, dt) {
  const p = G.player;
  // Bullets fly, hit buildings, enemies, cops or the player.
  for (let i = G.bullets.length - 1; i >= 0; i -= 1) {
    const b = G.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead) {
      const probe = { x: b.x, y: b.y };
      if (collideBuildings(G.city, probe, 2)) { dead = true; addParticles(G, b.x, b.y, '#ffd23e', 4); }
    }
    if (!dead && b.friendly) {
      for (const e of G.enemies) {
        if (e.hp > 0 && dist(b.x, b.y, e.x, e.y) < 18) {
          e.hp -= 34;
          e.flash = 0.2;
          addParticles(G, e.x, e.y, '#ff5a4d', 10);
          dead = true;
          if (e.hp <= 0) p.cash += 25;
          break;
        }
      }
      if (!dead) {
        for (const c of G.cops) {
          if (!c.down && dist(b.x, b.y, c.x, c.y) < 18) {
            c.hp -= 34;
            addParticles(G, c.x, c.y, '#ff5a4d', 10);
            dead = true;
            if (c.hp <= 0) { c.down = true; raiseWanted(G, 2); }
            break;
          }
        }
      }
    } else if (!dead && !b.friendly) {
      if (dist(b.x, b.y, p.x, p.y) < 16) {
        hurtPlayer(G, 9, 'enemy');
        dead = true;
      }
    }
    if (dead) G.bullets.splice(i, 1);
  }

  // Enemies chase the player and shoot when close.
  for (const e of G.enemies) {
    if (e.hp <= 0) continue;
    if (e.flash > 0) e.flash -= dt;
    const d = dist(e.x, e.y, p.x, p.y);
    const target = angleTo(e.x, e.y, p.x, p.y);
    e.angle = target;
    if (d > 320) { e.state = 'chase'; }
    if (d > 46) {
      e.x += Math.cos(target) * e.speed * dt;
      e.y += Math.sin(target) * e.speed * dt;
    } else {
      // Point blank: swing at the player.
      e.shootTimer -= dt * 2;
      if (e.shootTimer <= 0) {
        e.shootTimer = 0.9;
        hurtPlayer(G, 8, 'enemy');
        addParticles(G, p.x, p.y, '#ff5a4d', 6);
      }
    }
    if (d < 420 && d > 60) {
      e.shootTimer -= dt;
      if (e.shootTimer <= 0) {
        e.shootTimer = 1.4 + Math.random();
        const a = angleTo(e.x, e.y, p.x, p.y) + (Math.random() - 0.5) * 0.25;
        G.bullets.push({ x: e.x + Math.cos(a) * 20, y: e.y + Math.sin(a) * 20, vx: Math.cos(a) * 620, vy: Math.sin(a) * 620, life: 0.9, friendly: false });
        G.audio.play('enemyShoot');
      }
    }
    collideBuildings(G.city, e, 12);
    clampToWorld(e, 20);
  }
  G.enemies = G.enemies.filter((e) => e.hp > 0 || e.flash > 0);

  // Pickups: walk over one to collect it.
  for (let i = G.pickups.length - 1; i >= 0; i -= 1) {
    const pk = G.pickups[i];
    pk.bob += dt;
    if (dist(p.x, p.y, pk.x, pk.y) < 34) {
      if (pk.kind === 'health') { p.hp = Math.min(100, p.hp + 40); G.message = '+40 Health'; }
      else if (pk.kind === 'armor') { p.armor = Math.min(50, p.armor + 50); G.message = '+50 Armor'; }
      else if (pk.kind === 'ammo') { p.ammo += 36; G.message = '+36 Ammo'; }
      else if (pk.kind === 'cash') { p.cash += 50; G.message = '+$50 ditemukan!'; }
      else if (pk.kind === 'gun') { p.hasGun = true; p.ammo += 48; G.message = 'Pistol didapat! Klik mouse untuk menembak.'; }
      G.messageTimer = 2;
      G.audio.play('pickup');
      G.pickups.splice(i, 1);
    }
  }
}
