'use client';

import { useState } from 'react';
import { GameState, WalletState, BetResult } from '../hooks/useWebSocket';

const WONK_COLORS = [
  '#FF4444', '#4488FF', '#44CC44', '#FFAA00',
  '#CC44CC', '#00CCCC', '#FFFF44', '#FF88CC',
];

const BET_AMOUNTS = [10, 25, 50];

interface Props {
  state: GameState;
  wallet: WalletState;
  betResult: BetResult | null;
  cashoutCode: string | null;
  redeemMessage: string | null;
  connected: boolean;
  onPlaceBet: (slot: number, amount: number) => void;
  onCashout: () => void;
  onRedeemCode: (code: string) => void;
}

export default function BettingPanel({
  state, wallet, betResult, cashoutCode, redeemMessage,
  connected, onPlaceBet, onCashout, onRedeemCode,
}: Props) {
  const [selectedWonk, setSelectedWonk] = useState<number | null>(null);
  const [redeemInput, setRedeemInput] = useState('');
  const [showRedeem, setShowRedeem] = useState(false);

  const canBet = state.status !== 'racing' && !wallet.currentBet && connected;

  function handleBet(amount: number) {
    if (selectedWonk === null || !canBet) return;
    onPlaceBet(selectedWonk, amount);
    setSelectedWonk(null);
  }

  function handleRedeem() {
    if (redeemInput.trim()) {
      onRedeemCode(redeemInput.trim());
      setRedeemInput('');
      setShowRedeem(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 p-3 sm:p-4 bg-gray-900 rounded-lg border border-gray-700 w-full max-w-[800px]">
      {/* Header with balance */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-yellow-400 font-bold text-sm">Tokens:</span>
          <span className="text-white font-bold text-lg">{wallet.balance}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCashout}
            disabled={wallet.balance <= 0 || !connected}
            className="px-2 py-1 rounded text-xs font-bold bg-gray-700 hover:bg-gray-600 text-gray-300 disabled:opacity-40"
          >
            Cash Out
          </button>
          <button
            onClick={() => setShowRedeem(!showRedeem)}
            className="px-2 py-1 rounded text-xs font-bold bg-gray-700 hover:bg-gray-600 text-gray-300"
          >
            Redeem
          </button>
        </div>
      </div>

      {/* Cashout code display */}
      {cashoutCode && (
        <div className="bg-green-900/30 border border-green-800 rounded p-2 text-center">
          <div className="text-green-400 text-xs mb-1">Your cashout code (save this!):</div>
          <div className="text-white font-mono font-bold text-lg select-all">{cashoutCode}</div>
          <div className="text-gray-400 text-xs mt-1">Enter this code next time to restore your tokens</div>
        </div>
      )}

      {/* Redeem code input */}
      {showRedeem && (
        <div className="flex gap-2">
          <input
            type="text"
            value={redeemInput}
            onChange={(e) => setRedeemInput(e.target.value.toUpperCase())}
            placeholder="WONK-XXXX-XXXX"
            className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-white text-sm font-mono"
          />
          <button
            onClick={handleRedeem}
            className="px-3 py-1.5 rounded text-xs font-bold bg-yellow-700 hover:bg-yellow-600 text-white"
          >
            Redeem
          </button>
        </div>
      )}

      {redeemMessage && (
        <div className="text-yellow-400 text-xs text-center">{redeemMessage}</div>
      )}

      {/* Bet result */}
      {betResult && (
        <div className={`text-center text-sm font-bold ${betResult.won ? 'text-green-400' : 'text-red-400'}`}>
          {betResult.won ? `Won ${betResult.payout} tokens!` : 'Lost bet!'}
        </div>
      )}

      {/* Current bet display */}
      {wallet.currentBet && (
        <div className="text-center text-yellow-400 text-xs">
          Bet {wallet.currentBet.amount} on {state.horses.find(h => h.id === wallet.currentBet?.slot)?.name || `Wonk #${wallet.currentBet.slot}`}
        </div>
      )}

      {/* Betting grid - only when race not in progress and no current bet */}
      {!wallet.currentBet && (
        <div>
          <div className="text-gray-400 text-xs font-bold mb-1.5 uppercase tracking-wider">
            {state.status === 'racing' ? 'Betting closed during race' : 'Place your bet'}
          </div>
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8 sm:gap-2">
            {(state.horses.length > 0 ? state.horses : state.winCounts).map((h) => {
              const slot = ('id' in h) ? h.id : h.slot;
              const name = h.name;
              return (
                <button
                  key={slot}
                  onClick={() => canBet && setSelectedWonk(selectedWonk === slot ? null : slot)}
                  disabled={!canBet}
                  className={`flex flex-col items-center gap-1 p-1.5 rounded text-xs transition-all ${
                    selectedWonk === slot
                      ? 'bg-yellow-800/50 border-2 border-yellow-500'
                      : canBet
                      ? 'bg-gray-800 border border-gray-700 hover:border-gray-500'
                      : 'bg-gray-800/50 border border-gray-800 opacity-50'
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: WONK_COLORS[slot] }}
                  />
                  <span className="truncate w-full text-center text-gray-300" style={{ fontSize: '9px' }}>{name}</span>
                </button>
              );
            })}
          </div>

          {/* Bet amounts */}
          {selectedWonk !== null && canBet && (
            <div className="flex items-center gap-2 mt-2 justify-center">
              {BET_AMOUNTS.map(amt => (
                <button
                  key={amt}
                  onClick={() => handleBet(amt)}
                  disabled={amt > wallet.balance}
                  className="px-3 py-1.5 rounded text-xs font-bold bg-yellow-700 hover:bg-yellow-600 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {amt}
                </button>
              ))}
              <button
                onClick={() => handleBet(wallet.balance)}
                disabled={wallet.balance <= 0}
                className="px-3 py-1.5 rounded text-xs font-bold bg-red-700 hover:bg-red-600 text-white disabled:opacity-40"
              >
                ALL IN
              </button>
            </div>
          )}
        </div>
      )}

      <div className="text-gray-500 text-xs text-center">
        +5 tokens per race watched | 8x payout on correct bet
      </div>
    </div>
  );
}
