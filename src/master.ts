import type { PenlightCommand, ServerToMasterMessage } from './types.ts';
import QRCode from 'qrcode';

const PRESET_COLORS = [
  '#ff0000', '#ff6600', '#ffcc00', '#00ff00',
  '#0066ff', '#cc00ff', '#ff00cc', '#ffffff',
];

let ws: WebSocket | null = null;
let strobeActive = false;

function buildMasterWsUrl(): string {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/ws?role=master`;
}

function sendCommand(cmd: PenlightCommand): void {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(cmd));
  }
}

function connectMaster(): void {
  setConnectionStatus('connecting');
  ws = new WebSocket(buildMasterWsUrl());

  ws.onopen = () => {
    setConnectionStatus('connected');
  };

  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data as string) as ServerToMasterMessage;
      if (msg.type === 'status') {
        updateParticipantCount(msg.participantCount);
      }
    } catch {
      // Ignore
    }
  };

  ws.onclose = () => {
    setConnectionStatus('disconnected');
    setTimeout(connectMaster, 3000);
  };

  ws.onerror = () => {
    ws?.close();
  };
}

function setConnectionStatus(status: 'connecting' | 'connected' | 'disconnected'): void {
  const el = document.getElementById('conn-status');
  if (!el) return;
  const labels: Record<string, string> = {
    connecting: '接続中...',
    connected: '接続済み ●',
    disconnected: '切断 ○',
  };
  el.textContent = labels[status] ?? status;
  el.dataset['status'] = status;
}

function updateParticipantCount(n: number): void {
  const el = document.getElementById('participant-count');
  if (el) el.textContent = String(n);
}

async function renderQRCode(): Promise<void> {
  const canvas = document.getElementById('qr-canvas') as HTMLCanvasElement | null;
  const urlEl = document.getElementById('qr-url');
  if (!canvas || !urlEl) return;

  // localhostでアクセスされている場合はサーバーからLAN IPを取得
  let host = location.host;
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    try {
      const res = await fetch('/api/network-ips');
      const data = await res.json() as { ips: string[]; port: number };
      if (data.ips.length > 0) {
        host = `${data.ips[0]}:${location.port}`;
      }
    } catch {
      // フォールバック: そのままのホストを使う
    }
  }

  const url = `${location.protocol}//${host}/`;
  urlEl.textContent = url;
  await QRCode.toCanvas(canvas, url, { width: 200, margin: 1 });
}

function setupColorButtons(): void {
  const container = document.getElementById('preset-colors');
  if (!container) return;

  for (const color of PRESET_COLORS) {
    const btn = document.createElement('button');
    btn.className = 'color-btn';
    btn.style.backgroundColor = color;
    btn.title = color;
    btn.addEventListener('click', () => {
      sendCommand({ type: 'color', color });
      updatePreview(color);
    });
    container.appendChild(btn);
  }

  const picker = document.getElementById('color-picker') as HTMLInputElement | null;
  picker?.addEventListener('input', () => {
    sendCommand({ type: 'color', color: picker.value });
    updatePreview(picker.value);
  });
}

function updatePreview(color: string): void {
  const el = document.getElementById('color-preview');
  if (el) el.style.backgroundColor = color;
}

function setupControls(): void {
  document.getElementById('torch-on')?.addEventListener('click', () => {
    sendCommand({ type: 'torch', on: true });
  });

  document.getElementById('torch-off')?.addEventListener('click', () => {
    sendCommand({ type: 'torch', on: false });
  });

  const strobe = document.getElementById('strobe-toggle');
  const bpmSlider = document.getElementById('bpm-slider') as HTMLInputElement | null;
  const bpmLabel = document.getElementById('bpm-label');

  bpmSlider?.addEventListener('input', () => {
    if (bpmLabel) bpmLabel.textContent = bpmSlider.value;
    if (strobeActive) {
      sendCommand({ type: 'strobe', bpm: parseInt(bpmSlider.value, 10) });
    }
  });

  strobe?.addEventListener('click', () => {
    strobeActive = !strobeActive;
    strobe.textContent = strobeActive ? 'ストロボ停止' : 'ストロボ開始';
    strobe.dataset['active'] = String(strobeActive);
    const bpm = bpmSlider ? parseInt(bpmSlider.value, 10) : 120;
    sendCommand({ type: 'strobe', bpm: strobeActive ? bpm : 0 });
  });

  document.getElementById('all-off')?.addEventListener('click', () => {
    strobeActive = false;
    const strBtn = document.getElementById('strobe-toggle');
    if (strBtn) {
      strBtn.textContent = 'ストロボ開始';
      strBtn.dataset['active'] = 'false';
    }
    sendCommand({ type: 'off' });
    updatePreview('#000000');
  });
}

connectMaster();
setupColorButtons();
setupControls();
void renderQRCode();
