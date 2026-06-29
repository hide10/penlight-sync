export interface ShowEvent {
  t: number;
  type: 'color' | 'torch' | 'strobe' | 'off';
  color?: string;
  on?: boolean;
  bpm?: number;
}

export interface Timeline {
  startAt?: string;
  duration?: number; // loop cycle length in ms (enables absolute-time sync)
  events: ShowEvent[];
}
