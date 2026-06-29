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

async function init(): Promise<void> {
  const loadingEl = document.getElementById('loading')!;
  const errorEl = document.getElementById('error')!;
  const torchBtn = document.getElementById('torch-btn') as HTMLButtonElement;

  let timeline: Timeline;
  try {
    timeline = await loadTimeline(getShowUrl());
    player.load(timeline.events, timeline.duration);
  } catch (err) {
    loadingEl.style.display = 'none';
    errorEl.textContent = `エラー: ${err instanceof Error ? err.message : String(err)}`;
    errorEl.style.display = 'block';
    return;
  }

  // 絶対時刻同期で即再生（ユーザー操作不要）
  loadingEl.style.display = 'none';
  player.start();

  // torch はオプション：ボタンをタップして有効化
  torchBtn.style.display = 'block';
  torchBtn.addEventListener('click', async () => {
    torchBtn.disabled = true;
    torchBtn.textContent = '許可中...';
    const ok = await torch.init();
    torchBtn.textContent = ok ? 'フラッシュ ON' : '非対応';
    torchBtn.disabled = !ok;
    if (ok) {
      torchBtn.addEventListener('click', async () => {
        const active = torchBtn.dataset['active'] === 'true';
        await torch.setTorch(!active);
        torchBtn.dataset['active'] = String(!active);
        torchBtn.textContent = !active ? 'フラッシュ ON' : 'フラッシュ OFF';
      }, { once: false });
    }
  }, { once: true });
}

void init();
