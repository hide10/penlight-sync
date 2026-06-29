import type { Timeline, ShowEvent } from './types.ts';
import { TimelinePlayer } from './player.ts';
import { TorchController } from './torch.ts';

const player = new TimelinePlayer();
const torch = new TorchController();

function getShowUrl(): string {
  const params = new URLSearchParams(location.search);
  return params.get('show') ?? './show.json';
}

async function loadTimeline(url: string): Promise<Timeline> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return res.json() as Promise<Timeline>;
}

player.setOnTick((event: ShowEvent) => {
  if (event.type === 'torch' && event.on !== undefined) {
    void torch.setTorch(event.on);
  }
});

let countdownTimer: number | null = null;

function startCountdown(startAt: Date): void {
  const statusEl = document.getElementById('status')!;

  function tick(): void {
    const msLeft = startAt.getTime() - Date.now();
    if (msLeft <= 0) {
      if (countdownTimer !== null) clearInterval(countdownTimer);
      statusEl.textContent = '再生中';
      statusEl.dataset['state'] = 'playing';
      player.start(Math.abs(msLeft));
      return;
    }
    const totalSec = Math.ceil(msLeft / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    statusEl.textContent = `開始まで ${min}:${String(sec).padStart(2, '0')}`;
  }

  tick();
  countdownTimer = window.setInterval(tick, 500);
}

async function init(): Promise<void> {
  const statusEl = document.getElementById('status')!;
  const startBtn = document.getElementById('start-btn') as HTMLButtonElement;
  const loadingEl = document.getElementById('loading')!;
  const errorEl = document.getElementById('error')!;

  statusEl.textContent = 'ロード中...';
  statusEl.dataset['state'] = 'loading';

  let timeline: Timeline;
  try {
    timeline = await loadTimeline(getShowUrl());
    player.load(timeline.events);
    player.setLoop(timeline.loop ?? false, timeline.loopGap ?? 0);
  } catch (err) {
    loadingEl.style.display = 'none';
    errorEl.textContent = `エラー: ${err instanceof Error ? err.message : String(err)}`;
    errorEl.style.display = 'block';
    return;
  }

  if (timeline.startAt) {
    const startAt = new Date(timeline.startAt);
    const msLeft = startAt.getTime() - Date.now();
    if (msLeft > 0) {
      loadingEl.style.display = 'none';
      statusEl.dataset['state'] = 'countdown';
      startCountdown(startAt);
      return;
    }
    // Already past startAt: start immediately with offset
    loadingEl.style.display = 'none';
    statusEl.textContent = '再生中';
    statusEl.dataset['state'] = 'playing';
    player.start(Date.now() - startAt.getTime());
    return;
  }

  // Manual start: show button
  loadingEl.style.display = 'none';
  startBtn.style.display = 'block';
  statusEl.textContent = 'スタートを押してください';
  statusEl.dataset['state'] = 'waiting';

  startBtn.addEventListener('click', async () => {
    startBtn.disabled = true;
    startBtn.textContent = '準備中...';
    await torch.init();
    startBtn.style.display = 'none';
    statusEl.textContent = '再生中';
    statusEl.dataset['state'] = 'playing';
    player.start();
  });
}

void init();
