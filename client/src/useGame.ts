import { useCallback, useEffect, useRef, useState } from "react";
import type { GameState, Phase, Segment } from "./types";

const WS_URL = (import.meta.env.VITE_WS_URL as string) || "ws://localhost:8080";

const initialState: GameState = {
  connected: false,
  phase: "betting",
  roundId: 0,
  phaseEndsAt: 0,
  clockOffset: 0,
  segments: [],
  winningIndex: null,
  spinSeed: null,
  players: 0,
  balance: 0,
  history: [],
  myBets: [],
  lastResult: null,
};

export function useGame() {
  const [state, setState] = useState<GameState>(initialState);
  const wsRef = useRef<WebSocket | null>(null);
  const segmentsLocked = useRef(false);

  useEffect(() => {
    let closedByUs = false;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => setState((s) => ({ ...s, connected: true }));

      ws.onmessage = (ev) => {
        let msg: any;
        try {
          msg = JSON.parse(ev.data as string);
        } catch {
          return;
        }

        switch (msg.type) {
          case "welcome":
            segmentsLocked.current = true;
            setState((s) => ({ ...s, balance: msg.balance, segments: msg.segments as Segment[] }));
            break;

          case "state":
            setState((s) => {
              const newRound = msg.phase === "betting" && s.phase !== "betting";
              return {
                ...s,
                phase: msg.phase as Phase,
                roundId: msg.roundId,
                phaseEndsAt: msg.phaseEndsAt,
                clockOffset: msg.serverNow - Date.now(),
                segments: segmentsLocked.current ? s.segments : (msg.segments as Segment[]),
                winningIndex: msg.winningIndex,
                spinSeed: msg.spinSeed,
                players: msg.players,
                myBets: newRound ? [] : s.myBets,
                lastResult: newRound ? null : s.lastResult,
              };
            });
            break;

          case "balance":
            setState((s) => ({
              ...s,
              balance: msg.balance,
              lastResult: msg.lastWin === null ? s.lastResult : { payout: msg.lastWin },
            }));
            break;

          case "history":
            setState((s) => ({ ...s, history: msg.results as number[] }));
            break;
        }
      };

      ws.onerror = () => ws.close();

      ws.onclose = () => {
        setState((s) => ({ ...s, connected: false }));
        if (!closedByUs) reconnectTimer = setTimeout(connect, 1000);
      };
    };

    connect();

    return () => {
      closedByUs = true;
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);

  const placeBet = useCallback((segment: number, amount: number) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "bet", segment, amount }));
    setState((s) => ({ ...s, myBets: [...s.myBets, { segment, amount }] }));
  }, []);

  return { state, placeBet };
}
