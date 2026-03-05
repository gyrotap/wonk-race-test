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
}

export interface ResetVoteState {
  votes: number;
  needed: number;
}

export function useWebSocket() {
  const [state, setState] = useState<GameState | null>(null);
  const [viewers, setViewers] = useState(0);
  const [connected, setConnected] = useState(false);
  const [resetVotes, setResetVotes] = useState<ResetVoteState>({ votes: 0, needed: 0 });
  const [hasVotedReset, setHasVotedReset] = useState(false);
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
        // Reset was triggered if gen went back to 0
        if (msg.generation === 0) {
          setHasVotedReset(false);
        }
      } else if (msg.type === 'viewers') {
        setViewers(msg.count);
      } else if (msg.type === 'reset_votes') {
        setResetVotes({ votes: msg.votes, needed: msg.needed });
        // If reset happened (votes went to 0), clear local vote
        if (msg.votes === 0) {
          setHasVotedReset(false);
        }
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

  return { state, viewers, connected, sendNextGeneration, resetVotes, hasVotedReset, toggleResetVote };
}
