export type PenlightCommand =
  | { type: 'color'; color: string }
  | { type: 'torch'; on: boolean }
  | { type: 'strobe'; bpm: number }
  | { type: 'off' };

export type StatusMessage = {
  type: 'status';
  participantCount: number;
};

export type ServerToMasterMessage = StatusMessage;
