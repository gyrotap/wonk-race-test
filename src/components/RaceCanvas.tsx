'use client';

import { useRef, useEffect } from 'react';
import { GameState } from '../hooks/useWebSocket';

interface Props {
  state: GameState;
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

const POWERUP_COLORS: Record<string, string> = {
  speed: '#00FF88',
  shield: '#4488FF',
  zap: '#FF4444',
  magnet: '#FFD700',
};

const POWERUP_LABELS: Record<string, string> = {
  speed: 'SPD',
  shield: 'SHD',
  zap: 'ZAP',
  magnet: 'MAG',
};

export default function RaceCanvas({ state }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spritesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const spritesLoadedRef = useRef(false);

  useEffect(() => {
    const sprites = new Map<string, HTMLImageElement>();
    let loaded = 0;
    const total = 8;

    for (let i = 1; i <= total; i++) {
      const img = new Image();
      img.src = `/sprites/wonk${i}.png`;
      img.onload = () => {
        loaded++;
        if (loaded === total) spritesLoadedRef.current = true;
      };
      img.onerror = () => {
        loaded++;
        if (loaded === total) spritesLoadedRef.current = true;
      };
      sprites.set(`wonk${i}`, img);
    }
    spritesRef.current = sprites;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw obstacles
    ctx.fillStyle = '#3d3d5c';
    ctx.strokeStyle = '#5a5a8a';
    ctx.lineWidth = 2;
    for (const obs of state.obstacles) {
      ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
      ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
    }

    // Draw goal
    ctx.beginPath();
    ctx.arc(state.goalX, state.goalY, 20, 0, Math.PI * 2);
    ctx.fillStyle = '#FFD700';
    ctx.fill();
    ctx.strokeStyle = '#FFA500';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = '16px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\uD83E\uDD55', state.goalX, state.goalY);

    // Draw pitfalls
    for (const pit of (state.pitfalls || [])) {
      ctx.beginPath();
      ctx.arc(pit.x, pit.y, pit.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#8B0000';
      ctx.fill();
      ctx.strokeStyle = '#FF4444';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = '#FF666688';
      ctx.lineWidth = 2;
      const r = pit.radius * 0.6;
      ctx.beginPath();
      ctx.moveTo(pit.x - r, pit.y - r);
      ctx.lineTo(pit.x + r, pit.y + r);
      ctx.moveTo(pit.x + r, pit.y - r);
      ctx.lineTo(pit.x - r, pit.y + r);
      ctx.stroke();
    }

    // Draw powerup items on the course
    for (const item of (state.powerupItems || [])) {
      const color = POWERUP_COLORS[item.type] || '#fff';
      const label = POWERUP_LABELS[item.type] || '?';

      // Pulsing glow
      ctx.save();
      ctx.beginPath();
      ctx.arc(item.x, item.y, 18, 0, Math.PI * 2);
      ctx.fillStyle = color + '33';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(item.x, item.y, 12, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#ffffff88';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#000';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, item.x, item.y);
      ctx.restore();
    }

    // Draw start line
    ctx.strokeStyle = '#ffffff22';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(60, 0);
    ctx.lineTo(60, CANVAS_HEIGHT);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw projectiles (zap bolts)
    for (const proj of (state.projectiles || [])) {
      const target = state.horses.find(h => h.id === proj.targetSlot);
      if (!target) continue;

      ctx.save();
      ctx.strokeStyle = '#FF4444';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#FF4444';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(proj.x, proj.y);
      // Lightning zigzag toward target
      const dx = target.x - proj.x;
      const dy = target.y - proj.y;
      const steps = 4;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const jitterX = i < steps ? (Math.random() - 0.5) * 20 : 0;
        const jitterY = i < steps ? (Math.random() - 0.5) * 20 : 0;
        ctx.lineTo(proj.x + dx * t + jitterX, proj.y + dy * t + jitterY);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Draw horses
    for (const horse of state.horses) {
      const sprite = spritesRef.current.get(horse.spriteId);
      const spriteSize = 28;
      const isDimmed = horse.finished || horse.dead;

      // Draw effect auras
      ctx.save();
      if (horse.shielded) {
        ctx.beginPath();
        ctx.arc(horse.x, horse.y, 18, 0, Math.PI * 2);
        ctx.strokeStyle = '#4488FF88';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      if (horse.speedBoosted) {
        ctx.beginPath();
        ctx.arc(horse.x, horse.y, 20, 0, Math.PI * 2);
        ctx.strokeStyle = '#00FF8866';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (horse.magnetized) {
        ctx.beginPath();
        ctx.arc(horse.x, horse.y, 20, 0, Math.PI * 2);
        ctx.strokeStyle = '#FFD70066';
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (horse.stunned) {
        ctx.globalAlpha = 0.5 + Math.sin(Date.now() / 100) * 0.3;
      }
      ctx.restore();

      // Draw the wonk
      if (sprite && sprite.complete && sprite.naturalWidth > 0) {
        ctx.save();
        if (isDimmed) ctx.globalAlpha = horse.dead ? 0.3 : 0.5;
        if (horse.stunned) ctx.globalAlpha = 0.4;
        ctx.drawImage(
          sprite,
          horse.x - spriteSize / 2,
          horse.y - spriteSize / 2,
          spriteSize,
          spriteSize
        );
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(horse.x, horse.y, 12, 0, Math.PI * 2);
        ctx.fillStyle = isDimmed ? horse.color + '60' : horse.stunned ? horse.color + '66' : horse.color;
        ctx.fill();
        ctx.strokeStyle = horse.dead ? '#FF4444' : horse.stunned ? '#888888' : '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Dead X
      if (horse.dead) {
        ctx.strokeStyle = '#FF4444';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(horse.x - 8, horse.y - 8);
        ctx.lineTo(horse.x + 8, horse.y + 8);
        ctx.moveTo(horse.x + 8, horse.y - 8);
        ctx.lineTo(horse.x - 8, horse.y + 8);
        ctx.stroke();
      }

      // Stun stars
      if (horse.stunned) {
        ctx.fillStyle = '#FFD700';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('*  *  *', horse.x, horse.y - 22);
      }

      // Held powerup indicator
      if (horse.heldPowerup && !horse.dead) {
        const pColor = POWERUP_COLORS[horse.heldPowerup] || '#fff';
        ctx.beginPath();
        ctx.arc(horse.x + 14, horse.y - 14, 6, 0, Math.PI * 2);
        ctx.fillStyle = pColor;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Name label
      ctx.fillStyle = horse.dead ? '#ff6666' : horse.stunned ? '#888888' : '#fff';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(horse.name, horse.x, horse.y - (horse.stunned ? 30 : 18));
    }

    // Gen + timer overlay
    ctx.fillStyle = '#ffffffcc';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Gen ${state.generation}`, 10, 24);

    if (state.status === 'racing') {
      ctx.textAlign = 'right';
      ctx.fillText(`${state.timeLeft}s`, CANVAS_WIDTH - 10, 24);
    }

    // Winner banner
    if (state.status === 'finished' && state.winner) {
      ctx.fillStyle = '#00000088';
      ctx.fillRect(CANVAS_WIDTH / 2 - 180, CANVAS_HEIGHT / 2 - 30, 360, 60);
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`Winner: ${state.winner}!`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 6);
    }

    if (state.status === 'finished' && !state.winner) {
      ctx.fillStyle = '#00000088';
      ctx.fillRect(CANVAS_WIDTH / 2 - 150, CANVAS_HEIGHT / 2 - 30, 300, 60);
      ctx.fillStyle = '#ff6666';
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('No winner this race!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 6);
    }
  }, [state]);

  return (
    <div className="w-full max-w-[800px]">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="border-2 border-gray-700 rounded-lg w-full h-auto"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  );
}
