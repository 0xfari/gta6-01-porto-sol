// Drawing only: the city, every entity, the sunset light, the HUD and the
// menu screens. The camera follows the player and zooms out while driving.

import { VIEW, WORLD, ROADS_X, ROADS_Y, ROAD_W, PALETTE, FONT, CAR } from './config.js';
import { clamp, lerp } from './utils.js';
import { drawHud } from './hud.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const fonts = new Map();
  function font(size, bold) {
    const key = (bold ? 'b' : '') + size;
    if (!fonts.has(key)) fonts.set(key, (bold ? 'bold ' : '') + size + 'px ' + FONT);
    return fonts.get(key);
  }
  function text(value, x, y, size, color, align, bold) {
    ctx.font = font(size, bold);
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }
  function circle(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  function carShape(car, isPlayer) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-CAR.length / 2 + 3, -CAR.width / 2 + 4, CAR.length, CAR.width);
    // Body.
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.roundRect(-CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 8);
    ctx.fill();
    // Windshield + rear window.
    ctx.fillStyle = 'rgba(20,30,50,0.85)';
    ctx.fillRect(6, -CAR.width / 2 + 4, 12, CAR.width - 8);
    ctx.fillRect(-20, -CAR.width / 2 + 4, 8, CAR.width - 8);
    // Wheels.
    ctx.fillStyle = '#14141a';
    ctx.fillRect(-20, -CAR.width / 2 - 3, 12, 5);
    ctx.fillRect(8, -CAR.width / 2 - 3, 12, 5);
    ctx.fillRect(-20, CAR.width / 2 - 2, 12, 5);
    ctx.fillRect(8, CAR.width / 2 - 2, 12, 5);
    // Police light bar, flashing red / blue.
    if (car.kind === 'police') {
      const phase = Math.floor(car.lightPhase || 0) % 2 === 0;
      ctx.fillStyle = phase ? '#ff2a2a' : '#2a6bff';
      ctx.fillRect(-4, -CAR.width / 2 + 2, 8, 8);
      ctx.fillStyle = phase ? '#2a6bff' : '#ff2a2a';
      ctx.fillRect(-4, CAR.width / 2 - 10, 8, 8);
    }
    // Headlights while the player drives.
    if (isPlayer) {
      ctx.fillStyle = 'rgba(255,240,170,0.85)';
      ctx.fillRect(CAR.length / 2 - 2, -CAR.width / 2 + 3, 4, 6);
      ctx.fillRect(CAR.length / 2 - 2, CAR.width / 2 - 9, 4, 6);
    }
    ctx.restore();
    // Gold target marker.
    if (car.target) {
      ctx.fillStyle = '#ffd23e';
      ctx.font = font(20, true);
      ctx.textAlign = 'center';
      ctx.fillText('▼', car.x, car.y - 36 + Math.sin(Date.now() / 300) * 4);
    }
  }

  function drawWorld(G) {
    const city = G.city;
    // Ground.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    // Sea and beach on the west edge.
    ctx.fillStyle = PALETTE.seaDeep;
    ctx.fillRect(city.sea.x, city.sea.y, city.sea.w, city.sea.h);
    ctx.fillStyle = PALETTE.sea;
    ctx.fillRect(city.sea.x + 30, city.sea.y, city.sea.w - 30, city.sea.h);
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(city.beach.x + city.sea.w, city.beach.y, city.beach.w - city.sea.w, city.beach.h);
    // Wave lines.
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (let y = 80; y < WORLD.height; y += 160) {
      ctx.beginPath();
      ctx.moveTo(18, y + Math.sin(G.time + y) * 6);
      ctx.quadraticCurveTo(70, y + 14, 120, y + Math.sin(G.time + y) * 6);
      ctx.stroke();
    }
    // Park.
    ctx.fillStyle = PALETTE.park;
    ctx.fillRect(city.park.x, city.park.y, city.park.w, city.park.h);
    // Harbour water + docks.
    ctx.fillStyle = PALETTE.sea;
    ctx.fillRect(city.harbour.x, city.harbour.y, city.harbour.w, city.harbour.h);
    ctx.fillStyle = '#8a6b48';
    ctx.fillRect(city.harbour.x, city.harbour.y + city.harbour.h - 24, city.harbour.w, 24);
    ctx.fillRect(city.harbour.x + city.harbour.w - 24, city.harbour.y, 24, city.harbour.h);
    // The getaway boat.
    ctx.save();
    ctx.translate(2250, 1400);
    ctx.rotate(-0.4);
    ctx.fillStyle = '#f5efe2';
    ctx.beginPath();
    ctx.roundRect(-34, -12, 68, 24, 10);
    ctx.fill();
    ctx.fillStyle = '#ff4d8d';
    ctx.fillRect(-10, -20, 20, 10);
    ctx.restore();
    // Sidewalks, then roads, then dashes.
    for (const rx of ROADS_X) {
      ctx.fillStyle = PALETTE.sidewalk;
      ctx.fillRect(rx - ROAD_W / 2 - 12, 0, ROAD_W + 24, WORLD.height);
    }
    for (const ry of ROADS_Y) {
      ctx.fillStyle = PALETTE.sidewalk;
      ctx.fillRect(0, ry - ROAD_W / 2 - 12, WORLD.width, ROAD_W + 24);
    }
    ctx.fillStyle = PALETTE.road;
    for (const rx of ROADS_X) ctx.fillRect(rx - ROAD_W / 2, 0, ROAD_W, WORLD.height);
    for (const ry of ROADS_Y) ctx.fillRect(0, ry - ROAD_W / 2, WORLD.width, ROAD_W);
    ctx.fillStyle = PALETTE.roadLine;
    for (const rx of ROADS_X) {
      for (let y = 40; y < WORLD.height; y += 90) ctx.fillRect(rx - 3, y, 6, 44);
    }
    for (const ry of ROADS_Y) {
      for (let x = 40; x < WORLD.width; x += 90) ctx.fillRect(x, ry - 3, 44, 6);
    }
    // Buildings with shadows, roofs and neon signs.
    for (const b of city.buildings) {
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
      if (b.roof) {
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(b.x + b.w * 0.25, b.y + b.h * 0.25, b.w * 0.5, b.h * 0.5);
      }
      if (b.neon) {
        ctx.fillStyle = b.neon;
        ctx.fillRect(b.x + 6, b.y - 4, b.w - 12, 5);
      }
    }
    // Street lamps with a warm glow.
    for (const lamp of city.lamps) {
      ctx.fillStyle = 'rgba(255,220,130,0.18)';
      ctx.beginPath();
      ctx.arc(lamp.x, lamp.y, 26, 0, Math.PI * 2);
      ctx.fill();
      circle(lamp.x, lamp.y, 4, '#ffd23e');
    }
    // Palm trees.
    for (const palm of city.palms) {
      ctx.strokeStyle = '#6b4a2a';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(palm.x, palm.y);
      ctx.lineTo(palm.x + 4, palm.y - 18);
      ctx.stroke();
      ctx.fillStyle = '#3f7a2e';
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2 + 0.4;
        ctx.beginPath();
        ctx.ellipse(palm.x + 4 + Math.cos(a) * 12, palm.y - 18 + Math.sin(a) * 8, 13, 4, a, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawEntities(G) {
    // Skid marks.
    ctx.strokeStyle = 'rgba(20,20,20,0.5)';
    ctx.lineWidth = 4;
    for (const s of G.skids) {
      ctx.beginPath();
      ctx.moveTo(s.x - Math.cos(s.angle) * 8, s.y - Math.sin(s.angle) * 8);
      ctx.lineTo(s.x + Math.cos(s.angle) * 8, s.y + Math.sin(s.angle) * 8);
      ctx.stroke();
    }
    // Pickups, bobbing.
    for (const pk of G.pickups) {
      const bob = Math.sin(pk.bob * 3) * 3;
      const y = pk.y + bob;
      if (pk.kind === 'health') { circle(pk.x, y, 13, '#58d654'); text('+', pk.x, y + 6, 18, '#fff', 'center', true); }
      else if (pk.kind === 'armor') { circle(pk.x, y, 13, '#4a90e8'); text('A', pk.x, y + 6, 16, '#fff', 'center', true); }
      else if (pk.kind === 'ammo') { circle(pk.x, y, 13, '#ffd23e'); text('•', pk.x, y + 5, 18, '#222', 'center', true); }
      else if (pk.kind === 'cash') { circle(pk.x, y, 13, '#7de07d'); text('$', pk.x, y + 6, 16, '#123', 'center', true); }
      else if (pk.kind === 'gun') { circle(pk.x, y, 14, '#2b2b33'); text('▬', pk.x, y + 5, 16, '#ffd23e', 'center', true); }
    }
    // Waypoint beacon on the ground.
    const m = G.mission;
    if (m.target) {
      const pulse = 26 + Math.sin(G.time * 4) * 6;
      ctx.strokeStyle = 'rgba(255,210,62,0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(m.target.x, m.target.y, pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,210,62,0.25)';
      ctx.beginPath();
      ctx.arc(m.target.x, m.target.y, pulse, 0, Math.PI * 2);
      ctx.fill();
    }
    // Parked cars, traffic, roadblocks.
    for (const car of G.cars) carShape(car, G.player.inCar === car);
    for (const car of G.traffic) carShape(car, false);
    // Pedestrians.
    for (const ped of G.peds) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(ped.x, ped.y + 10, 9, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      circle(ped.x, ped.y, 10, ped.shirt);
      circle(ped.x, ped.y - 4, 5, '#e8b98a');
      if (ped.state === 'flee') text('!', ped.x, ped.y - 16, 16, '#ff5a4d', 'center', true);
    }
    // Enemies (rival gang) with health bars.
    for (const e of G.enemies) {
      if (e.hp <= 0) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(e.x, e.y + 11, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      circle(e.x, e.y, 12, e.flash > 0 ? '#ffffff' : e.shirt);
      circle(e.x, e.y - 4, 5, '#d8a06a');
      ctx.fillStyle = '#222';
      ctx.fillRect(e.x - 14, e.y - 24, 28, 5);
      ctx.fillStyle = '#ff5a4d';
      ctx.fillRect(e.x - 14, e.y - 24, 28 * Math.max(0, e.hp / e.maxHp), 5);
      text('VIPER', e.x, e.y - 28, 10, '#ff8a80', 'center', true);
    }
    // Cops: cars or on foot.
    for (const cop of G.cops) {
      if (cop.down) continue;
      if (cop.car) carShape(cop.car, false);
      else {
        circle(cop.x, cop.y, 12, '#2b4a8e');
        circle(cop.x, cop.y - 4, 5, '#e8b98a');
        text('POLISI', cop.x, cop.y - 20, 10, '#7db3ff', 'center', true);
        if (cop.bustTimer > 0) {
          ctx.fillStyle = '#ff5a4d';
          ctx.font = font(14, true);
          ctx.textAlign = 'center';
          ctx.fillText('DITANGKAP…', cop.x, cop.y - 32);
        }
      }
    }
    // Bullets as tracers.
    ctx.strokeStyle = '#ffe27a';
    ctx.lineWidth = 3;
    for (const b of G.bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    // Particles.
    for (const pt of G.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.max);
      circle(pt.x, pt.y, pt.size, pt.color);
    }
    ctx.globalAlpha = 1;
    // The player (on foot: a walker with a cap; in a car the car is drawn already).
    const p = G.player;
    if (!p.inCar) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 11, 11, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      if (p.hurtTimer > 0 && Math.floor(p.hurtTimer * 12) % 2 === 0) {
        // Blink while hurt.
      } else {
        circle(p.x, p.y, 13, '#ff8c42');
        circle(p.x, p.y - 4, 6, '#e8b98a');
        ctx.fillStyle = '#222';
        ctx.fillRect(p.x - 7, p.y - 12, 14, 5);
        // Facing tick / gun barrel.
        ctx.strokeStyle = p.hasGun ? '#ffd23e' : '#ff8c42';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(p.x + Math.cos(p.angle) * 12, p.y + Math.sin(p.angle) * 12);
        ctx.lineTo(p.x + Math.cos(p.angle) * (p.hasGun ? 26 : 20), p.y + Math.sin(p.angle) * (p.hasGun ? 26 : 20));
        ctx.stroke();
        if (p.punchTimer > 0.25) {
          ctx.strokeStyle = '#ffd23e';
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 26, p.angle - 0.6, p.angle + 0.6);
          ctx.stroke();
        }
      }
    }
  }

  function drawSunset() {
    const grad = ctx.createLinearGradient(0, 0, 0, VIEW.height);
    grad.addColorStop(0, 'rgba(255,120,60,0.10)');
    grad.addColorStop(0.55, 'rgba(255,120,60,0.03)');
    grad.addColorStop(1, 'rgba(90,40,120,0.10)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    // Vignette.
    const vg = ctx.createRadialGradient(VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.45, VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.85);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(10,5,25,0.35)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = 'rgba(12,10,24,0.88)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,210,62,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawTitle(G) {
    ctx.fillStyle = 'rgba(10,5,25,0.55)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    text('PORTO SOL', VIEW.width / 2, 150, 84, '#ffd23e', 'center', true);
    text('OPEN-WORLD CRIME • KOTA PESISIR DI UJUNG SENJA', VIEW.width / 2, 190, 20, PALETTE.neonCyan, 'center', true);
    panel(VIEW.width / 2 - 330, 220, 660, 250);
    text('Riko baru sampai di Porto Sol dengan satu tas dan satu nama:', VIEW.width / 2, 258, 17, PALETTE.text, 'center');
    text('kurir jalanan yang tak kenal takut. Lima pekerjaan memisahkan', VIEW.width / 2, 284, 17, PALETTE.text, 'center');
    text('dirinya dari tahta jalanan — dan geng Viper tidak akan diam saja.', VIEW.width / 2, 310, 17, PALETTE.text, 'center');
    text('WASD jalan / nyetir  •  E curi mobil & interaksi  •  F pukul', VIEW.width / 2, 356, 16, PALETTE.muted, 'center');
    text('Klik mouse tembak  •  Esc jeda  •  M bisu  •  Misi auto-save', VIEW.width / 2, 382, 16, PALETTE.muted, 'center');
    if (G.bestCash > 0) text('Uang terbanyak: $' + G.bestCash.toLocaleString('en-US'), VIEW.width / 2, 414, 16, PALETTE.cash, 'center');
    text(G.hasSave ? 'ENTER / KLIK — Lanjutkan (misi ' + (G.saveMission + 1) + '/5)     N — Game baru' : 'ENTER / KLIK — New Game', VIEW.width / 2, 446, 19, '#ffd23e', 'center', true);
  }

  function drawPaused(G) {
    ctx.fillStyle = 'rgba(10,5,25,0.6)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    panel(VIEW.width / 2 - 260, VIEW.height / 2 - 130, 520, 260);
    text('JEDA', VIEW.width / 2, VIEW.height / 2 - 70, 44, PALETTE.text, 'center', true);
    text('Misi: ' + (G.mission.idx + 1) + '/5  •  Uang: $' + G.player.cash.toLocaleString('en-US'), VIEW.width / 2, VIEW.height / 2 - 20, 17, PALETTE.muted, 'center');
    text('WASD gerak  •  E interaksi  •  F pukul  •  Klik tembak', VIEW.width / 2, VIEW.height / 2 + 10, 16, PALETTE.muted, 'center');
    text('Esc / Enter — lanjutkan', VIEW.width / 2, VIEW.height / 2 + 52, 18, '#ffd23e', 'center', true);
    text('M — bisu: ' + (G.audio.isMuted() ? 'mati' : 'nyala'), VIEW.width / 2, VIEW.height / 2 + 82, 15, PALETTE.muted, 'center');
  }

  function drawOver(G) {
    ctx.fillStyle = 'rgba(20,2,8,0.62)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    const busted = G.overReason === 'busted';
    text(busted ? 'BUSTED!' : 'WASTED', VIEW.width / 2, 260, 72, '#ff5a4d', 'center', true);
    text(busted ? 'Polisi menangkapmu di jalanan Porto Sol.' : 'Riko tumbang di jalanan Porto Sol.', VIEW.width / 2, 310, 20, PALETTE.text, 'center');
    text('Uang: $' + G.player.cash.toLocaleString('en-US') + '  •  Misi selesai: ' + G.player.missionsDone + '/5', VIEW.width / 2, 350, 18, PALETTE.muted, 'center');
    text('ENTER / KLIK — coba lagi dari misi terakhir', VIEW.width / 2, 410, 19, '#ffd23e', 'center', true);
  }

  function drawWin(G) {
    ctx.fillStyle = 'rgba(10,5,25,0.6)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    text('★ RAJA PORTO SOL ★', VIEW.width / 2, 240, 56, '#ffd23e', 'center', true);
    text('Lima misi selesai. Bank dibobol, Viper tumbang, kapal menunggu.', VIEW.width / 2, 300, 20, PALETTE.text, 'center');
    text('Uang akhir: $' + G.player.cash.toLocaleString('en-US') + '  •  Mobil dicuri: ' + G.player.carsStolen, VIEW.width / 2, 340, 18, PALETTE.muted, 'center');
    text('ENTER / KLIK — main bebas di kota', VIEW.width / 2, 400, 19, '#ffd23e', 'center', true);
  }

  function draw(G) {
    const p = G.player;
    const targetZoom = p.inCar ? 0.78 : 1.0;
    G.camera.zoom = lerp(G.camera.zoom, targetZoom, 0.03);
    G.camera.x = lerp(G.camera.x, p.x, 0.08);
    G.camera.y = lerp(G.camera.y, p.y, 0.08);
    const z = G.camera.zoom;
    const shx = (Math.random() - 0.5) * G.shake;
    const shy = (Math.random() - 0.5) * G.shake;
    G.shake = Math.max(0, G.shake - 0.6);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#1a0f2e';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.setTransform(z, 0, 0, z, VIEW.width / 2 - G.camera.x * z + shx, VIEW.height / 2 - G.camera.y * z + shy);
    drawWorld(G);
    drawEntities(G);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawSunset();
    if (G.screen === 'play' || G.screen === 'paused') drawHud(ctx, G);
    if (G.screen === 'title') drawTitle(G);
    else if (G.screen === 'paused') drawPaused(G);
    else if (G.screen === 'over') drawOver(G);
    else if (G.screen === 'win') drawWin(G);
  }

  return { draw };
}
