export type Phase = "betting" | "drawing" | "result";

export interface Segment {
  index: number;
  label: string;
  color: string;
  multiplier: number;
}

export interface Bet {
  segment: number;
  amount: number;
}

export interface PublicBet {
  betId: number;
  id: number;
  name: string;
  segment: number;
  amount: number;
}

export interface GameState {
  connected: boolean;
  phase: Phase;
  roundId: number;
  phaseEndsAt: number;
  clockOffset: number;
  segments: Segment[];
  winningIndex: number | null;
  spinSeed: number | null;
  players: number;
  balance: number;
  history: number[];
  myBets: Bet[];
  allBets: PublicBet[];
  myId: number | null;
  lastResult: { payout: number } | null;
}
