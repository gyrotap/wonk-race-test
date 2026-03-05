'use client';

import { useRef, useEffect } from 'react';
import { GameState } from '../hooks/useWebSocket';

interface Props {
  state: GameState;
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

export default function RaceCanvas({ state }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spritesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const spritesLoadedRef = useRef(false);

  // Load wonk sprites
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
    ctx.fillText('🥕', state.goalX, state.goalY);

    // Draw pitfalls
    for (const pit of (state.pitfalls || [])) {
      ctx.beginPath();
      ctx.arc(pit.x, pit.y, pit.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#8B0000';
      ctx.fill();
      ctx.strokeStyle = '#FF4444';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Draw X pattern
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

    // Draw start line
    ctx.strokeStyle = '#ffffff44';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(state.horses[0]?.x ?? 60, 0);
    ctx.lineTo(state.horses[0]?.x ?? 60, CANVAS_HEIGHT);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw horses
    for (const horse of state.horses) {
      const sprite = spritesRef.current.get(horse.spriteId);
      const spriteSize = 28;

      const isDimmed = horse.finished || horse.dead;

      if (sprite && sprite.complete && sprite.naturalWidth > 0) {
        ctx.save();
        if (isDimmed) ctx.globalAlpha = horse.dead ? 0.3 : 0.5;
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
        ctx.fillStyle = isDimmed ? horse.color + '60' : horse.color;
        ctx.fill();
        ctx.strokeStyle = horse.dead ? '#FF4444' : '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Draw dead X over horse
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

      // Draw name label
      ctx.fillStyle = horse.dead ? '#ff6666' : '#fff';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(horse.name, horse.x, horse.y - 18);
    }

    // Draw generation + timer overlay
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
      ctx.fillText('No winner this gen!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 6);
    }
  }, [state]);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      className="border-2 border-gray-700 rounded-lg"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}
