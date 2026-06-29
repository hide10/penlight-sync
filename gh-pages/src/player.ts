import type { ShowEvent } from './types.ts';

const MAX_STROBE_BPM = 180;

interface PlayerState {
  color: string;
  strobeTimer: number | null;
}

export class TimelinePlayer {
  private events: ShowEvent[] = [];
  private startTime: number | null = null;
  private timers: number[] = [];
  private state: PlayerState = { color: '#ffffff', strobeTimer: null };
  private onTick?: (event: ShowEvent) => void;

  setOnTick(fn: (event: ShowEvent) => void): void {
    this.onTick = fn;
  }

  load(events: ShowEvent[]): void {
    this.stop();
    this.events = [...events].sort((a, b) => a.t - b.t);
  }

  // Start relative to "now". If offsetMs is given, start mid-sequence (for startAt sync).
  start(offsetMs = 0): void {
    this.stop();
    this.startTime = Date.now() - offsetMs;

    for (const event of this.events) {
      const delay = event.t - offsetMs;
      if (delay < -500) continue; // already passed by more than 0.5s, skip

      const timer = window.setTimeout(
        () => this.dispatch(event),
        Math.max(0, delay),
      );
      this.timers.push(timer);
    }
  }

  stop(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
    this.stopStrobe();
    this.startTime = null;
  }

  get isRunning(): boolean {
    return this.startTime !== null;
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
        // torch is handled externally via onTick
        break;
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
