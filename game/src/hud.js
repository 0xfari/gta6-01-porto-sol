// The HUD: health and armour bars, cash, wanted stars, the clock, the active
// objective, messages, the speedometer while driving — and the minimap that
// shows the city, the waypoint, police, cars and enemies at a glance.

import { VIEW, WORLD, PALETTE, FONT } from './config.js';
import { formatCash, formatClock } from './utils.js';
import { missionTitle, currentObjective } from './missions.js';

const MAP = { x: VIEW.width - 216, y: 14, w: 202, h: 148 };

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawHud(ctx, G) {
  const p = G.player;
  ctx.textBaseline = 'alphabetic';
  // Top-left: health, armour, cash, clock.
  ctx.fillStyle = PALETTE.hudBg;
  roundRect(ctx, 12, 12, 250, 92, 10);
  ctx.fill();
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 20px ' + FONT;
  ctx.textAlign = 'left';
  ctx.fillText('RIKO', 24, 38);
  ctx.font = '16px ' + FONT;
  ctx.fillStyle = PALETTE.cash;
  ctx.fillText(formatCash(p.cash), 120, 38);
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText(formatClock(G.clock), 210, 38);
  // Health bar.
  ctx.fillStyle = '#222';
  ctx.fillRect(24, 48, 200, 12);
  ctx.fillStyle = p.hp > 30 ? '#58d654' : '#ff5a4d';
  ctx.fillRect(24, 48, 200 * Math.max(0, p.hp / 100), 12);
  // Armour bar.
  ctx.fillStyle = '#222';
  ctx.fillRect(24, 64, 200, 8);
  ctx.fillStyle = '#4a90e8';
  ctx.fillRect(24, 64, 200 * Math.max(0, p.armor / 50), 8);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '13px ' + FONT;
  ctx.fillText(p.hasGun ? 'Pistol  •  Ammo ' + p.ammo : 'Tangan kosong — tekan F untuk pukul', 24, 92);

  // Top-centre: wanted stars.
  const stars = p.wanted;
  ctx.font = 'bold 30px ' + FONT;
  ctx.textAlign = 'center';
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < stars ? '#ffd23e' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', VIEW.width / 2 - 60 + i * 30, 46);
  }
  if (stars > 0) {
    ctx.fillStyle = '#ff5a4d';
    ctx.font = 'bold 14px ' + FONT;
    ctx.fillText(stars >= 4 ? 'POLISI MENGEJARMU!' : 'WANTED', VIEW.width / 2, 66);
  }

  drawMinimap(ctx, G);

  // Bottom-left: mission title + objective.
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.hudBg;
  roundRect(ctx, 12, VIEW.height - 74, 430, 62, 10);
  ctx.fill();
  ctx.fillStyle = PALETTE.neonYellow;
  ctx.font = 'bold 15px ' + FONT;
  ctx.fillText('MISI ' + (G.mission.allDone ? '✓' : (G.mission.idx + 1) + '/5') + ' — ' + missionTitle(G), 24, VIEW.height - 50);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '15px ' + FONT;
  ctx.fillText(currentObjective(G), 24, VIEW.height - 28);

  // Bottom-right: speed while driving.
  if (p.inCar) {
    ctx.fillStyle = PALETTE.hudBg;
    roundRect(ctx, VIEW.width - 132, VIEW.height - 74, 120, 62, 10);
    ctx.fill();
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 26px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText(Math.round(Math.abs(p.inCar.speed) * 0.36) + '', VIEW.width - 72, VIEW.height - 40);
    ctx.font = '12px ' + FONT;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('km/h', VIEW.width - 72, VIEW.height - 22);
  }

  // Centre message banner.
  if (G.messageTimer > 0 && G.message) {
    ctx.font = 'bold 22px ' + FONT;
    ctx.textAlign = 'center';
    const w = ctx.measureText(G.message).width + 36;
    ctx.fillStyle = PALETTE.hudBg;
    roundRect(ctx, VIEW.width / 2 - w / 2, 84, w, 40, 10);
    ctx.fill();
    ctx.fillStyle = PALETTE.neonYellow;
    ctx.fillText(G.message, VIEW.width / 2, 112);
  }

  // Story dialog box.
  const m = G.mission;
  if (m.dialog && m.dialogTimer > 0) {
    ctx.fillStyle = 'rgba(12,10,24,0.85)';
    roundRect(ctx, VIEW.width / 2 - 300, VIEW.height - 150, 600, 64, 10);
    ctx.fill();
    ctx.fillStyle = PALETTE.neonCyan;
    ctx.font = 'bold 15px ' + FONT;
    ctx.textAlign = 'left';
    ctx.fillText(m.dialog.from + ':', VIEW.width / 2 - 284, VIEW.height - 124);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '15px ' + FONT;
    ctx.fillText(m.dialog.text, VIEW.width / 2 - 284, VIEW.height - 100);
  }
}

function drawMinimap(ctx, G) {
  const p = G.player;
  const sx = MAP.w / WORLD.width;
  const sy = MAP.h / WORLD.height;
  ctx.fillStyle = PALETTE.hudBg;
  roundRect(ctx, MAP.x - 4, MAP.y - 4, MAP.w + 8, MAP.h + 8, 8);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(MAP.x, MAP.y, MAP.w, MAP.h);
  ctx.clip();
  // Sea + sand on the west edge.
  ctx.fillStyle = '#1d5c86';
  ctx.fillRect(MAP.x, MAP.y, 130 * sx, MAP.h);
  ctx.fillStyle = '#e8c98a';
  ctx.fillRect(MAP.x + 130 * sx, MAP.y, 80 * sx, MAP.h);
  ctx.fillStyle = '#5d8a3c';
  ctx.fillRect(MAP.x + 210 * sx, MAP.y, MAP.w - 210 * sx, MAP.h);
  // Roads.
  ctx.strokeStyle = '#3a3a44';
  ctx.lineWidth = 5;
  for (const rx of G.roadsX) {
    ctx.beginPath();
    ctx.moveTo(MAP.x + rx * sx, MAP.y);
    ctx.lineTo(MAP.x + rx * sx, MAP.y + MAP.h);
    ctx.stroke();
  }
  for (const ry of G.roadsY) {
    ctx.beginPath();
    ctx.moveTo(MAP.x, MAP.y + ry * sy);
    ctx.lineTo(MAP.x + MAP.w, MAP.y + ry * sy);
    ctx.stroke();
  }
  // Park + harbour.
  ctx.fillStyle = '#3f7a2e';
  ctx.fillRect(MAP.x + G.city.park.x * sx, MAP.y + G.city.park.y * sy, G.city.park.w * sx, G.city.park.h * sy);
  ctx.fillStyle = '#2e7fa8';
  ctx.fillRect(MAP.x + G.city.harbour.x * sx, MAP.y + G.city.harbour.y * sy, G.city.harbour.w * sx, G.city.harbour.h * sy);
  // Waypoint: pulsing yellow diamond.
  const m = G.mission;
  if (m.target) {
    const pulse = 5 + Math.sin(G.time * 5) * 2;
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.moveTo(MAP.x + m.target.x * sx, MAP.y + m.target.y * sy - pulse - 4);
    ctx.lineTo(MAP.x + m.target.x * sx + pulse, MAP.y + m.target.y * sy);
    ctx.lineTo(MAP.x + m.target.x * sx, MAP.y + m.target.y * sy + pulse + 4);
    ctx.lineTo(MAP.x + m.target.x * sx - pulse, MAP.y + m.target.y * sy);
    ctx.closePath();
    ctx.fill();
  }
  // Parked / traffic cars as grey dots.
  ctx.fillStyle = '#c9c9c9';
  for (const car of G.cars) {
    ctx.fillRect(MAP.x + car.x * sx - 1.5, MAP.y + car.y * sy - 1.5, 3, 3);
  }
  // Enemies red, cops flashing blue/red.
  ctx.fillStyle = '#ff5a4d';
  for (const e of G.enemies) {
    if (e.hp > 0) ctx.fillRect(MAP.x + e.x * sx - 2, MAP.y + e.y * sy - 2, 4, 4);
  }
  for (const c of G.cops) {
    if (c.down) continue;
    ctx.fillStyle = Math.floor(G.time * 4) % 2 === 0 ? '#3d7bff' : '#ff5a4d';
    ctx.beginPath();
    ctx.arc(MAP.x + c.x * sx, MAP.y + c.y * sy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player: white dot with black ring.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(MAP.x + p.x * sx, MAP.y + p.y * sy, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '11px ' + FONT;
  ctx.textAlign = 'left';
  ctx.fillText('PORTO SOL', MAP.x, MAP.y + MAP.h + 14);
}
