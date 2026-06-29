import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { networkInterfaces } from 'os';

const PORT = parseInt(process.env['PORT'] ?? '3001', 10);
const DIST_DIR = join(dirname(fileURLToPath(import.meta.url)), '../dist');

const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

const participants = new Set<WebSocket>();
let masterWs: WebSocket | null = null;

function notifyMasterOfCount(): void {
  if (masterWs?.readyState === WebSocket.OPEN) {
    masterWs.send(JSON.stringify({ type: 'status', participantCount: participants.size }));
  }
}

function broadcastToParticipants(data: string): void {
  for (const ws of participants) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}

wss.on('connection', (ws, req) => {
  const url = new URL(req.url ?? '/', `http://${req.headers['host']}`);
  const isMaster = url.searchParams.get('role') === 'master';

  if (isMaster) {
    if (masterWs) {
      masterWs.close(1000, 'replaced by new master');
    }
    masterWs = ws;
    notifyMasterOfCount();
    console.log('Master connected');
  } else {
    participants.add(ws);
    notifyMasterOfCount();
    console.log(`Participant connected (total: ${participants.size})`);
  }

  ws.on('message', (raw) => {
    if (ws !== masterWs) return;
    broadcastToParticipants(raw.toString());
  });

  ws.on('close', () => {
    if (ws === masterWs) {
      masterWs = null;
      console.log('Master disconnected');
    } else {
      participants.delete(ws);
      notifyMasterOfCount();
      console.log(`Participant disconnected (total: ${participants.size})`);
    }
  });

  ws.on('error', (err) => {
    console.error('WS error:', err.message);
  });
});

// Ping participants to detect stale connections
setInterval(() => {
  for (const ws of participants) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    } else {
      participants.delete(ws);
    }
  }
}, 15000);

// LAN IPリストを返すAPI（QRコード生成用）
app.get('/api/network-ips', (_req, res) => {
  const ips: string[] = [];
  for (const ifaces of Object.values(networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  res.json({ ips, port: PORT });
});

app.use(express.static(DIST_DIR));
// SPA fallback for master.html
app.get('/master', (_req, res) => {
  res.sendFile(join(DIST_DIR, 'master.html'));
});

httpServer.listen(PORT, () => {
  console.log(`penlight-sync server listening on :${PORT}`);
});

httpServer.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Run: kill $(lsof -ti:${PORT})`);
  } else {
    console.error('Server error:', err.message);
  }
  process.exit(1);
});
