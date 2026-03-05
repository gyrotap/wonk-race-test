import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer, WebSocket } from 'ws';
import { Simulation, SimState } from './simulation';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'wonk-reset-123';

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);

    // Admin reset endpoint: POST /api/reset?secret=your-secret
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

  // Don't attach to server directly — handle upgrade manually to avoid conflicting with Next.js HMR
  const wss = new WebSocketServer({ noServer: true });
  const clients = new Set<WebSocket>();

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

  const simulation = new Simulation(broadcast);

  wss.on('connection', (ws) => {
    clients.add(ws);
    broadcastViewerCount();

    // Send current state to the new client
    ws.send(JSON.stringify({ type: 'state', ...simulation.getState() }));

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'next_generation') {
          simulation.startNextGeneration();
        }
      } catch {
        // ignore malformed messages
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      broadcastViewerCount();
    });
  });

  // Handle WebSocket upgrades manually — let Next.js HMR through, handle our own WS
  server.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url!, true);

    // Only handle our /ws path — everything else (including HMR) passes through
    if (pathname !== '/ws') {
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
