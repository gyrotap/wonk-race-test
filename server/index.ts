import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer, WebSocket } from 'ws';
import { Simulation, SimState } from './simulation';
import { BettingSystem } from './betting';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'wonk-reset-123';

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);

    if (parsedUrl.pathname === '/api/reset' && req.method === 'POST') {
      if (parsedUrl.query.secret === ADMIN_SECRET) {
        simulation.reset();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, message: 'Simulation reset to gen 0' }));
      } else {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, message: 'Invalid secret' }));
      }
      return;
    }

    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ noServer: true });
  const clients = new Set<WebSocket>();
  const betting = new BettingSystem();

  function broadcast(state: SimState) {
    const data = JSON.stringify({ type: 'state', ...state });
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  function broadcastViewerCount() {
    const data = JSON.stringify({ type: 'viewers', count: clients.size });
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  function sendWallet(ws: WebSocket) {
    const wallet = betting.getWallet(ws);
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'wallet',
        balance: wallet.balance,
        currentBet: wallet.currentBet,
      }));
    }
  }

  const simulation = new Simulation(broadcast);
  const resetVotes = new Set<WebSocket>();

  // Handle race end for betting
  simulation.onRaceEnd = (winnerSlot: number | null) => {
    betting.givePassiveIncome();
    const results = betting.resolveBets(winnerSlot);

    for (const [ws, result] of results) {
      if ((ws as WebSocket).readyState === WebSocket.OPEN) {
        (ws as WebSocket).send(JSON.stringify({
          type: 'bet_result',
          won: result.won,
          payout: result.payout,
        }));
      }
    }

    for (const client of clients) {
      sendWallet(client);
    }
  };

  function broadcastResetVotes() {
    const data = JSON.stringify({
      type: 'reset_votes',
      votes: resetVotes.size,
      needed: clients.size,
    });
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  wss.on('connection', (ws) => {
    clients.add(ws);
    broadcastViewerCount();
    broadcastResetVotes();

    ws.send(JSON.stringify({ type: 'state', ...simulation.getState() }));
    sendWallet(ws);

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === 'next_generation') {
          simulation.startNextGeneration();
        }

        if (msg.type === 'vote_reset') {
          resetVotes.add(ws);
          broadcastResetVotes();
          if (resetVotes.size >= clients.size && clients.size > 0) {
            resetVotes.clear();
            simulation.reset();
            broadcastResetVotes();
          }
        }

        if (msg.type === 'unvote_reset') {
          resetVotes.delete(ws);
          broadcastResetVotes();
        }

        // Powerup activation — any viewer can fire any wonk's powerup
        if (msg.type === 'activate_powerup' && typeof msg.slot === 'number') {
          simulation.activatePowerup(msg.slot);
        }

        // Betting
        if (msg.type === 'place_bet' && typeof msg.slot === 'number' && typeof msg.amount === 'number') {
          const result = betting.placeBet(ws, msg.slot, msg.amount);
          ws.send(JSON.stringify({ type: 'bet_response', ...result }));
          sendWallet(ws);
        }

        if (msg.type === 'cashout') {
          const code = betting.cashout(ws);
          if (code) {
            ws.send(JSON.stringify({ type: 'cashout_code', code, balance: betting.getWallet(ws).balance }));
          } else {
            ws.send(JSON.stringify({ type: 'cashout_code', code: null, message: 'No tokens to cash out' }));
          }
        }

        if (msg.type === 'redeem_code' && typeof msg.code === 'string') {
          const result = betting.redeemCode(ws, msg.code);
          ws.send(JSON.stringify({ type: 'redeem_result', ...result }));
          sendWallet(ws);
        }
      } catch {
        // ignore malformed messages
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      resetVotes.delete(ws);
      betting.removeWallet(ws);
      broadcastViewerCount();
      broadcastResetVotes();
      if (resetVotes.size >= clients.size && clients.size > 0) {
        resetVotes.clear();
        simulation.reset();
        broadcastResetVotes();
      }
    });
  });

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url!, true);
    if (pathname !== '/ws') return;

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
