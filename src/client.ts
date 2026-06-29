import type { PenlightCommand } from './types.ts';
import { TorchController } from './torch.ts';

const MAX_STROBE_BPM = 180;

interface ClientState {
  color: string;
  strobeTimer: number | null;
}

const state: ClientState = { color: '#ffffff', strobeTimer: null };
const torch = new TorchController();

function buildWsUrl(): string {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/ws`;
}

function applyColor(color: string): void {
  stopStrobe();
  state.color = color;
  document.body.style.backgroundColor = color;
}

function startStrobe(bpm: number): void {
  stopStrobe();
  const safeBpm = Math.min(bpm, MAX_STROBE_BPM);
  const halfPeriod = (60000 / safeBpm) / 2;
  let lit = true;
  state.strobeTimer = window.setInterval(() => {
    document.body.style.backgroundColor = lit ? state.color : '#000000';
    lit = !lit;
  }, halfPeriod);
}

function stopStrobe(): void {
  if (state.strobeTimer !== null) {
    clearInterval(state.strobeTimer);
    state.strobeTimer = null;
  }
}

function applyOff(): void {
  stopStrobe();
  state.color = '#000000';
  document.body.style.backgroundColor = '#000000';
  void torch.setTorch(false);
}

function handleCommand(cmd: PenlightCommand): void {
  switch (cmd.type) {
    case 'color':
      applyColor(cmd.color);
      break;
    case 'torch':
      void torch.setTorch(cmd.on);
      break;
    case 'strobe':
      if (cmd.bpm > 0) {
        startStrobe(cmd.bpm);
      } else {
        stopStrobe();
        document.body.style.backgroundColor = state.color;
      }
      break;
    case 'off':
      applyOff();
      break;
  }
}

class PenlightConnection {
  private ws: WebSocket | null = null;
  private retryDelay = 1000;
  private readonly maxDelay = 30000;
  private destroyed = false;

  connect(): void {
    if (this.destroyed) return;
    setStatus('connecting');
    const ws = new WebSocket(buildWsUrl());
    this.ws = ws;

    ws.onopen = () => {
      this.retryDelay = 1000;
      setStatus('connected');
    };

    ws.onmessage = (ev) => {
      try {
        const cmd = JSON.parse(ev.data as string) as PenlightCommand;
        handleCommand(cmd);
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      if (!this.destroyed) {
        setStatus('reconnecting');
        setTimeout(() => this.connect(), this.retryDelay);
        this.retryDelay = Math.min(this.retryDelay * 2, this.maxDelay);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }

  ensureConnected(): void {
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED || this.ws.readyState === WebSocket.CLOSING) {
      this.connect();
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.ws?.close();
  }
}

function setStatus(status: 'connecting' | 'connected' | 'reconnecting'): void {
  const el = document.getElementById('status');
  if (!el) return;
  const labels: Record<string, string> = {
    connecting: '接続中...',
    connected: '接続済み',
    reconnecting: '再接続中...',
  };
  el.textContent = labels[status] ?? status;
  el.dataset['status'] = status;
}

async function initTorch(): Promise<void> {
  const btn = document.getElementById('join-btn') as HTMLButtonElement | null;
  if (!btn) return;

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = '接続中...';

    const ok = await torch.init();

    document.getElementById('overlay')?.remove();
    document.getElementById('torch-indicator')?.classList.toggle('supported', ok);

    connection.connect();
  });
}

const connection = new PenlightConnection();

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    connection.ensureConnected();
  }
});

void initTorch();
