'use client';

import { useWebSocket } from '../hooks/useWebSocket';
import RaceCanvas from '../components/RaceCanvas';
import Controls from '../components/Controls';

export default function Home() {
  const { state, viewers, connected, sendNextGeneration } = useWebSocket();

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-4 gap-4">
      <h1 className="text-4xl font-bold font-mono tracking-tight">Wonk Race Test</h1>
      <p className="text-gray-400 text-base font-mono">
        Genetic algorithm Wonk racing — Wonks evolve neural networks to navigate obstacles
      </p>

      {state ? (
        <>
          <RaceCanvas state={state} />
          <Controls
            state={state}
            viewers={viewers}
            connected={connected}
            onNextGeneration={sendNextGeneration}
          />
        </>
      ) : (
        <div className="text-gray-500 font-mono">
          {connected ? 'Loading...' : 'Connecting to server...'}
        </div>
      )}
    </div>
  );
}
