import { useMemo } from "react";
import type { GameState } from "./types";

export interface LiveBet {
  key: string;
  name: string;
  id: number;
  color: string;
  segIdx: number;
  mult: number;
  amount: number;
  you: boolean;
  result: "win" | "lose" | null;
  payout: number;
}

export function useLiveBets(state: GameState): LiveBet[] {
  return useMemo(() => {
    const settled = state.phase === "result" && state.winningIndex != null;
    return state.allBets
      .map((b) => {
        const s = state.segments[b.segment];
        const won = settled && b.segment === state.winningIndex;
        return {
          key: String(b.betId),
          name: b.name,
          id: b.id,
          color: s?.color ?? "#44f08c",
          segIdx: b.segment,
          mult: s?.multiplier ?? 1,
          amount: b.amount,
          you: b.id === state.myId,
          result: settled ? (won ? "win" : "lose") : null,
          payout: won ? b.amount * (s?.multiplier ?? 1) : 0,
        } as LiveBet;
      })
      .reverse();
  }, [state.allBets, state.segments, state.phase, state.winningIndex, state.myId]);
}
