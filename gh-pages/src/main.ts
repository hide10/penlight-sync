import type { Timeline, ShowEvent } from './types.ts';
import { TimelinePlayer } from './player.ts';
import { TorchController } from './torch.ts';

const player = new TimelinePlayer();
const torch = new TorchController();

function getShowUrl(): string {
  const params = new URLSearchParams(location.search);
  return params.get('show') ?? './show.json';
}

// HTTPレスポンスのDateヘッダーを基準にローカル時計のズレを測定する
// 精度: ±500ms程度（Dateヘッダーは秒単位 + RTT/2の誤差）
async function measureClockOffset(url: string): Promise<number> {
  try {
    const t1 = Date.now();
    const res = await fetch(url + '?_t=' + t1, { cache: 'no-store' });
    const t2 = Date.now();
    const serverDateStr = res.headers.get('Date');
    if (!serverDateStr) return 0;
    const serverMs = new Date(serverDateStr).getTime();
    // Dateヘッダーは秒単位なので、秒の中間点+RTT/2で補正
    const corrected = serverMs + 500 + (t2 - t1) / 2;
    return corrected - t2;
  } catch {
    return 0;
  }
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

  const showUrl = getShowUrl();
  let timeline: Timeline;
  let clockOffset = 0;

  try {
    // タイムライン取得とクロックオフセット計測を並行実行
    [timeline, clockOffset] = await Promise.all([
      loadTimeline(showUrl),
      measureClockOffset(showUrl),
    ]);
    player.load(timeline.events, timeline.duration, clockOffset);
  } catch (err) {
    loadingEl.style.display = 'none';
    errorEl.textContent = `エラー: ${err instanceof Error ? err.message : String(err)}`;
    errorEl.style.display = 'block';
    return;
  }

  loadingEl.style.display = 'none';
  player.start();

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
