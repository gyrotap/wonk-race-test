'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export interface HorseState {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  name: string;
  spriteId: string;
  fitness: number;
  finished: boolean;
  dead: boolean;
  finishTime: number | null;
  distToGoal: number;
  stunned: boolean;
  shielded: boolean;
  speedBoosted: boolean;
  magnetized: boolean;
  heldPowerup: string | null;
}

export interface WinCount {
  slot: number;
  name: string;
  wins: number;
}

export interface PowerupItemState {
  id: number;
  type: string;
  x: number;
  y: number;
}

export interface ProjectileState {
  x: number;
  y: number;
  targetSlot: number;
}

export interface GameState {
  horses: HorseState[];
  obstacles: { x: number; y: number; w: number; h: number }[];
  pitfalls: { x: number; y: number; radius: number }[];
  goalX: number;
  goalY: number;
  generation: number;
  status: 'waiting' | 'racing' | 'finished';
  timeLeft: number;
  winner: string | null;
  bestFitnessHistory: number[];
  winCounts: WinCount[];
  powerupItems: PowerupItemState[];
  projectiles: ProjectileState[];
}

export interface ResetVoteState {
  votes: number;
  needed: number;
}

export interface WalletState {
  balance: number;
  currentBet: { slot: number; amount: number } | null;
}

export interface BetResult {
  won: boolean;
  payout: number;
}

export function useWebSocket() {
  const [state, setState] = useState<GameState | null>(null);
  const [viewers, setViewers] = useState(0);
  const [connected, setConnected] = useState(false);
  const [resetVotes, setResetVotes] = useState<ResetVoteState>({ votes: 0, needed: 0 });
  const [hasVotedReset, setHasVotedReset] = useState(false);
  const [wallet, setWallet] = useState<WalletState>({ balance: 100, currentBet: null });
  const [betResult, setBetResult] = useState<BetResult | null>(null);
  const [cashoutCode, setCashoutCode] = useState<string | null>(null);
  const [redeemMessage, setRedeemMessage] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      setHasVotedReset(false);
      reconnectTimeoutRef.current = setTimeout(connect, 2000);
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      if (msg.type === 'state') {
        setState(msg as GameState);
        if (msg.generation === 0) {
          setHasVotedReset(false);
        }
        // Clear bet result when new race starts
        if (msg.status === 'racing') {
          setBetResult(null);
        }
      } else if (msg.type === 'viewers') {
        setViewers(msg.count);
      } else if (msg.type === 'reset_votes') {
        setResetVotes({ votes: msg.votes, needed: msg.needed });
        if (msg.votes === 0) {
          setHasVotedReset(false);
        }
      } else if (msg.type === 'wallet') {
        setWallet({ balance: msg.balance, currentBet: msg.currentBet });
      } else if (msg.type === 'bet_result') {
        setBetResult({ won: msg.won, payout: msg.payout });
      } else if (msg.type === 'cashout_code') {
        setCashoutCode(msg.code);
      } else if (msg.type === 'redeem_result') {
        setRedeemMessage(msg.message);
      }
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const sendNextGeneration = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'next_generation' }));
    }
  }, []);

  const toggleResetVote = useCallback(() => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    if (hasVotedReset) {
      wsRef.current.send(JSON.stringify({ type: 'unvote_reset' }));
      setHasVotedReset(false);
    } else {
      wsRef.current.send(JSON.stringify({ type: 'vote_reset' }));
      setHasVotedReset(true);
    }
  }, [hasVotedReset]);

  const activatePowerup = useCallback((slot: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'activate_powerup', slot }));
    }
  }, []);

  const placeBet = useCallback((slot: number, amount: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'place_bet', slot, amount }));
    }
  }, []);

  const cashout = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'cashout' }));
    }
  }, []);

  const redeemCode = useCallback((code: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'redeem_code', code }));
      setCashoutCode(null);
    }
  }, []);

  return {
    state, viewers, connected, sendNextGeneration,
    resetVotes, hasVotedReset, toggleResetVote,
    activatePowerup,
    wallet, placeBet, betResult, cashout, cashoutCode, redeemCode, redeemMessage,
  };
}
