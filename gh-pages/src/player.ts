import type { ShowEvent } from './types.ts';

const MAX_STROBE_BPM = 180;

interface PlayerState {
  color: string;
  strobeTimer: number | null;
}

export class TimelinePlayer {
  private events: ShowEvent[] = [];
  private timers: number[] = [];
  private state: PlayerState = { color: '#000000', strobeTimer: null };
  private onTick?: (event: ShowEvent) => void;
  private duration: number | null = null;
  private _running = false;

  setOnTick(fn: (event: ShowEvent) => void): void {
    this.onTick = fn;
  }

  load(events: ShowEvent[], duration?: number): void {
    this.stop();
    this.events = [...events].sort((a, b) => a.t - b.t);
    this.duration = duration ?? null;
  }

  // 絶対時刻同期モード: Date.now() % duration でオフセット算出
  start(): void {
    this.stop();
    this._running = true;
    this.playFromCurrentOffset();
  }

  stop(): void {
    this._running = false;
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
    this.stopStrobe();
  }

  get isRunning(): boolean {
    return this._running;
  }

  private playFromCurrentOffset(): void {
    if (!this._running) return;

    const duration = this.duration;
    const offset = duration ? Date.now() % duration : 0;
    const timeUntilCycleEnd = duration ? duration - offset : Infinity;

    // まず現在オフセット時点での「最新状態」を即時適用（画面をいきなり正しい色に）
    const currentEvent = this.findCurrentState(offset);
    if (currentEvent) this.applyEvent(currentEvent);

    // 残りのイベントをスケジュール
    for (const event of this.events) {
      const delay = event.t - offset;
      if (delay <= 0) continue; // 既に過去のイベントはスキップ

      const timer = window.setTimeout(() => {
        if (this._running) this.dispatch(event);
      }, delay);
      this.timers.push(timer);
    }

    // サイクル終端で再計算（ドリフト補正）
    if (duration) {
      const cycleTimer = window.setTimeout(
        () => this.playFromCurrentOffset(),
        timeUntilCycleEnd,
      );
      this.timers.push(cycleTimer);
    }
  }

  // 現在時刻より前の最後の color/off イベントを探して画面色を即時設定
  private findCurrentState(offset: number): ShowEvent | null {
    let last: ShowEvent | null = null;
    for (const event of this.events) {
      if (event.t > offset) break;
      if (event.type === 'color' || event.type === 'off') last = event;
    }
    return last;
  }

  private dispatch(event: ShowEvent): void {
    this.onTick?.(event);
    this.applyEvent(event);
  }

  applyEvent(event: ShowEvent): void {
    switch (event.type) {
      case 'color':
        this.stopStrobe();
        if (event.color) {
          this.state.color = event.color;
          document.body.style.backgroundColor = event.color;
        }
        break;
      case 'torch':
        break; // torch は onTick で外部処理
      case 'strobe':
        if (event.bpm && event.bpm > 0) {
          this.startStrobe(event.bpm);
        } else {
          this.stopStrobe();
          document.body.style.backgroundColor = this.state.color;
        }
        break;
      case 'off':
        this.stopStrobe();
        this.state.color = '#000000';
        document.body.style.backgroundColor = '#000000';
        break;
    }
  }

  private startStrobe(bpm: number): void {
    this.stopStrobe();
    const safeBpm = Math.min(bpm, MAX_STROBE_BPM);
    const halfPeriod = (60000 / safeBpm) / 2;
    let lit = true;
    this.state.strobeTimer = window.setInterval(() => {
      document.body.style.backgroundColor = lit ? this.state.color : '#000000';
      lit = !lit;
    }, halfPeriod);
  }

  private stopStrobe(): void {
    if (this.state.strobeTimer !== null) {
      clearInterval(this.state.strobeTimer);
      this.state.strobeTimer = null;
    }
  }
}
