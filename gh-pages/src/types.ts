export interface ShowEvent {
  t: number;
  type: 'color' | 'torch' | 'strobe' | 'off';
  color?: string;
  on?: boolean;
  bpm?: number;
}

export interface Timeline {
  startAt?: string;
  events: ShowEvent[];
}
