export type PowerupType = 'speed' | 'shield' | 'zap' | 'magnet';

export interface PowerupItem {
  id: number;
  type: PowerupType;
  x: number;
  y: number;
  collected: boolean;
}

export interface HeldPowerup {
  type: PowerupType;
  pickedUpTick: number;
}

export interface Projectile {
  id: number;
  fromSlot: number;
  targetSlot: number;
  x: number;
  y: number;
}

export const POWERUP_DURATION = 180; // 3 seconds at 60fps
export const STUN_DURATION = 120; // 2 seconds
export const AUTO_FIRE_DELAY = 300; // 5 seconds after pickup
export const PROJECTILE_SPEED = 10;
export const POWERUP_RADIUS = 14;
export const MAGNET_STRENGTH = 0.15;
export const SPEED_MULTIPLIER = 2.0;

export const POWERUP_COLORS: Record<PowerupType, string> = {
  speed: '#00FF88',
  shield: '#4488FF',
  zap: '#FF4444',
  magnet: '#FFD700',
};

export const POWERUP_LABELS: Record<PowerupType, string> = {
  speed: 'SPD',
  shield: 'SHD',
  zap: 'ZAP',
  magnet: 'MAG',
};

export function spawnPowerups(
  courseWidth: number,
  courseHeight: number,
  startX: number,
  goalX: number,
  goalY: number,
  count: number = 4
): PowerupItem[] {
  const types: PowerupType[] = ['speed', 'shield', 'zap', 'magnet'];
  const items: PowerupItem[] = [];

  for (let i = 0; i < count; i++) {
    let x: number, y: number;
    let attempts = 0;
    do {
      x = 120 + Math.random() * (courseWidth - 240);
      y = 50 + Math.random() * (courseHeight - 100);
      attempts++;
    } while (
      (x < startX + 80 || Math.sqrt((x - goalX) ** 2 + (y - goalY) ** 2) < 60) &&
      attempts < 50
    );

    items.push({
      id: i,
      type: types[i % types.length],
      x,
      y,
      collected: false,
    });
  }

  return items;
}
