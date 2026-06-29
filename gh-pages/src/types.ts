export interface ShowEvent {
  t: number;
  type: 'color' | 'torch' | 'strobe' | 'off';
  color?: string;
  on?: boolean;
  bpm?: number;
}

export interface Timeline {
  startAt?: string;
  loop?: boolean;
  loopGap?: number; // ms between loops (default 0)
  events: ShowEvent[];
}
