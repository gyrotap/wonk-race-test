'use client';

import { GameState, ResetVoteState } from '../hooks/useWebSocket';

const WONK_COLORS = [
  '#FF4444', '#4488FF', '#44CC44', '#FFAA00',
  '#CC44CC', '#00CCCC', '#FFFF44', '#FF88CC',
];

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

interface Props {
  state: GameState;
  viewers: number;
  connected: boolean;
  onNextGeneration: () => void;
  resetVotes: ResetVoteState;
  hasVotedReset: boolean;
  onToggleResetVote: () => void;
  onActivatePowerup: (slot: number) => void;
}

export default function Controls({
  state, viewers, connected, onNextGeneration,
  resetVotes, hasVotedReset, onToggleResetVote, onActivatePowerup,
}: Props) {
  const canStart = state.status === 'waiting' || state.status === 'finished';

  return (
    <div className="flex flex-col gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-900 rounded-lg border border-gray-700 w-full max-w-[800px]">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={onNextGeneration}
            disabled={!canStart || !connected}
            className={`px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-bold text-base sm:text-lg transition-all flex-1 sm:flex-none ${
              canStart && connected
                ? 'bg-green-600 hover:bg-green-500 text-white cursor-pointer'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            {state.generation === 0
              ? 'Start First Race'
              : state.status === 'racing'
              ? 'Racing...'
              : `Start Gen ${state.generation + 1}`}
          </button>
          <div className="text-gray-400 text-xs sm:text-sm whitespace-nowrap">
            <span className={connected ? 'text-green-400' : 'text-red-400'}>
              {connected ? '\u25CF' : '\u25CB'}
            </span>{' '}
            {viewers} viewer{viewers !== 1 ? 's' : ''}
          </div>
        </div>
        <div className="flex items-center gap-3 sm:gap-4 justify-between sm:justify-end">
          <div className="text-gray-400 text-xs sm:text-sm">
            Generation: <span className="text-white font-bold">{state.generation}</span>
          </div>
          {state.generation > 0 && (
            <button
              onClick={onToggleResetVote}
              disabled={!connected}
              className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${
                hasVotedReset
                  ? 'bg-red-700 hover:bg-red-600 text-white'
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
            >
              {hasVotedReset ? 'Voted Reset' : 'Vote Reset'}
              {resetVotes.needed > 0 && (
                <span className="ml-1.5 text-gray-400">
                  {resetVotes.votes}/{resetVotes.needed}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Leaderboard with powerup activation */}
      {state.horses.length > 0 && (
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2">
          {[...state.horses]
            .sort((a, b) => {
              if (a.finished && !b.finished) return -1;
              if (!a.finished && b.finished) return 1;
              if (a.finished && b.finished) return (a.finishTime ?? 0) - (b.finishTime ?? 0);
              if (a.dead && !b.dead) return 1;
              if (!a.dead && b.dead) return -1;
              return a.distToGoal - b.distToGoal;
            })
            .map((horse, i) => (
              <div
                key={horse.id}
                className={`flex items-center gap-1.5 p-2 rounded text-sm ${
                  horse.finished
                    ? 'bg-green-900/30 border border-green-800'
                    : horse.dead
                    ? 'bg-red-900/30 border border-red-900'
                    : horse.stunned
                    ? 'bg-gray-700/50 border border-gray-600'
                    : 'bg-gray-800'
                }`}
              >
                <span className="text-gray-500 text-xs">#{i + 1}</span>
                <span
                  className="w-3 h-3 rounded-full inline-block flex-shrink-0"
                  style={{ backgroundColor: horse.color, opacity: horse.dead ? 0.4 : 1 }}
                />
                <span className={`truncate text-xs ${
                  horse.dead ? 'text-red-400 line-through' :
                  horse.stunned ? 'text-gray-400' : 'text-white'
                }`}>{horse.name}</span>

                {/* Powerup activation button */}
                {horse.heldPowerup && !horse.dead && !horse.finished && state.status === 'racing' && (
                  <button
                    onClick={() => onActivatePowerup(horse.id)}
                    className="ml-auto px-1.5 py-0.5 rounded text-xs font-bold animate-pulse"
                    style={{
                      backgroundColor: POWERUP_COLORS[horse.heldPowerup] + '44',
                      color: POWERUP_COLORS[horse.heldPowerup],
                      border: `1px solid ${POWERUP_COLORS[horse.heldPowerup]}88`,
                    }}
                    title={`Activate ${horse.heldPowerup}!`}
                  >
                    {POWERUP_LABELS[horse.heldPowerup]}
                  </button>
                )}

                {/* Status indicators */}
                {horse.speedBoosted && <span className="text-green-400 text-xs ml-auto">FAST</span>}
                {horse.magnetized && <span className="text-yellow-400 text-xs ml-auto">MAG</span>}
                {horse.shielded && <span className="text-blue-400 text-xs ml-auto">SHD</span>}
                {horse.stunned && <span className="text-gray-400 text-xs ml-auto">STUN</span>}
                {horse.finished && !horse.heldPowerup && <span className="text-green-400 text-xs ml-auto">Done</span>}
                {horse.dead && <span className="text-red-500 text-xs ml-auto">Dead</span>}
              </div>
            ))}
        </div>
      )}

      {/* All-time wins leaderboard */}
      {state.winCounts && state.winCounts.some(w => w.wins > 0) && (
        <div className="border-t border-gray-700 pt-3">
          <div className="text-gray-400 text-xs font-bold mb-2 uppercase tracking-wider">All-Time Wins</div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2">
            {[...state.winCounts]
              .sort((a, b) => b.wins - a.wins)
              .map((wc) => (
                <div
                  key={wc.slot}
                  className={`flex items-center gap-2 p-2 rounded text-sm ${
                    wc.wins > 0 ? 'bg-yellow-900/20 border border-yellow-900/50' : 'bg-gray-800/50'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full inline-block flex-shrink-0"
                    style={{ backgroundColor: WONK_COLORS[wc.slot] }}
                  />
                  <span className="truncate text-xs text-white">{wc.name}</span>
                  <span className={`text-xs ml-auto font-bold ${wc.wins > 0 ? 'text-yellow-400' : 'text-gray-600'}`}>
                    {wc.wins}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Fitness history */}
      {state.bestFitnessHistory.length > 1 && (
        <div className="text-gray-400 text-xs">
          Best fitness:{' '}
          {state.bestFitnessHistory.slice(-10).map((f, i) => (
            <span key={i} className="text-gray-300">
              {f}
              {i < Math.min(state.bestFitnessHistory.length, 10) - 1 ? ' \u2192 ' : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
