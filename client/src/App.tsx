import { useEffect, useMemo, useState } from "react";
import { useGame } from "./useGame";
import Wheel from "./Wheel";

const CHIPS = [10, 25, 50, 100];
const DRAWING_MS = 6000;

const PHASE_LABEL: Record<string, string> = {
  betting: "Place your bets",
  drawing: "Drawing...",
  result: "Result",
};

export default function App() {
  const { state, placeBet } = useGame();
  const [segment, setSegment] = useState<number | null>(null);
  const [chip, setChip] = useState(25);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 150);
    return () => clearInterval(id);
  }, []);

  const secondsLeft = Math.max(0, Math.ceil((state.phaseEndsAt - (now + state.clockOffset)) / 1000));
  const isBetting = state.phase === "betting";
  const canBet = state.connected && isBetting && segment !== null && chip <= state.balance;

  const staked = useMemo(() => state.myBets.reduce((sum, b) => sum + b.amount, 0), [state.myBets]);
  const stakeBySegment = useMemo(() => {
    const map: Record<number, number> = {};
    for (const b of state.myBets) map[b.segment] = (map[b.segment] ?? 0) + b.amount;
    return map;
  }, [state.myBets]);

  const winSeg = state.winningIndex != null ? state.segments[state.winningIndex] : null;
  const prevIndex = state.history.length > 0 ? state.history[0] : null;

  const handleBet = () => {
    if (!canBet || segment === null) return;
    placeBet(segment, chip);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Draw<span className="text-violet-600">Spin</span>
            </h1>
            <p className="text-sm text-slate-500">Server-authoritative real-time draw game</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2 text-sm text-slate-500">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${
                  state.connected ? "bg-emerald-500" : "bg-rose-500"
                }`}
              />
              {state.connected ? `${state.players} online` : "connecting..."}
            </span>
            <div className="rounded-xl bg-white px-4 py-2 shadow-sm ring-1 ring-slate-200">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Balance</div>
              <div className="text-lg font-bold text-emerald-600">{state.balance.toLocaleString()}</div>
            </div>
          </div>
        </header>

        <div className="grid gap-6 md:grid-cols-[1fr,320px]">
          <section className="relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="mb-2 flex items-center justify-between">
              <span
                className={`rounded-full px-3 py-1 text-sm font-semibold ${
                  isBetting
                    ? "bg-emerald-100 text-emerald-700"
                    : state.phase === "drawing"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-violet-100 text-violet-700"
                }`}
              >
                {PHASE_LABEL[state.phase]}
              </span>
              {(isBetting || state.phase === "drawing") && (
                <span className="font-mono text-2xl font-semibold tabular-nums text-slate-700">{secondsLeft}s</span>
              )}
            </div>

            <Wheel
              segments={state.segments}
              phase={state.phase}
              winningIndex={state.winningIndex}
              spinSeed={state.spinSeed}
              prevIndex={prevIndex}
              phaseEndsAt={state.phaseEndsAt}
              clockOffset={state.clockOffset}
              drawingMs={DRAWING_MS}
            />

            {state.phase === "result" && winSeg && (
              <div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center">
                <div className="rounded-xl bg-white/90 px-5 py-3 text-center shadow-md ring-1 ring-slate-200 backdrop-blur">
                  <div className="text-sm text-slate-500">
                    Landed on <span className="font-semibold" style={{ color: winSeg.color }}>{winSeg.label}</span>
                  </div>
                  {state.lastResult ? (
                    state.lastResult.payout > 0 ? (
                      <div className="text-lg font-bold text-emerald-600">+{state.lastResult.payout.toLocaleString()}</div>
                    ) : (
                      <div className="text-lg font-bold text-rose-500">No win</div>
                    )
                  ) : (
                    <div className="text-sm text-slate-400">No bet this round</div>
                  )}
                </div>
              </div>
            )}
          </section>

          <section className="flex flex-col gap-5 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div>
              <h2 className="mb-2 text-sm font-semibold text-slate-700">Pick a segment</h2>
              <div className="grid grid-cols-2 gap-2">
                {state.segments.map((s) => {
                  const selected = segment === s.index;
                  const myStake = stakeBySegment[s.index];
                  return (
                    <button
                      key={s.index}
                      type="button"
                      disabled={!isBetting}
                      onClick={() => setSegment(s.index)}
                      className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        selected
                          ? "ring-2 ring-violet-500 ring-offset-1"
                          : "ring-1 ring-slate-200 hover:ring-slate-300"
                      }`}
                      style={{ backgroundColor: `${s.color}1a` }}
                    >
                      <span className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} />
                        {s.label}
                      </span>
                      {myStake ? <span className="text-xs font-semibold text-slate-500">·{myStake}</span> : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <h2 className="mb-2 text-sm font-semibold text-slate-700">Stake</h2>
              <div className="grid grid-cols-4 gap-2">
                {CHIPS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setChip(c)}
                    className={`rounded-xl py-2 text-sm font-semibold transition ${
                      chip === c
                        ? "bg-violet-600 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              disabled={!canBet}
              onClick={handleBet}
              className="rounded-xl bg-emerald-600 py-3 font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
            >
              {isBetting ? `Bet ${chip} on ${segment != null ? state.segments[segment]?.label : "..."}` : "Betting closed"}
            </button>

            <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-sm text-slate-500">
              <span>Staked this round</span>
              <span className="font-semibold text-slate-800">{staked.toLocaleString()}</span>
            </div>
          </section>
        </div>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Recent draws</h2>
          <div className="flex flex-wrap gap-2">
            {state.history.length === 0 && <span className="text-sm text-slate-400">No rounds yet</span>}
            {state.history.map((idx, i) => {
              const s = state.segments[idx];
              if (!s) return null;
              return (
                <span
                  key={i}
                  className="flex h-8 w-10 items-center justify-center rounded-lg text-xs font-bold"
                  style={{ backgroundColor: `${s.color}26`, color: s.color }}
                  title={`Round result: ${s.label}`}
                >
                  {s.label}
                </span>
              );
            })}
          </div>
        </section>

        <footer className="text-center text-xs text-slate-400">
          The winning segment is generated by the server with a crypto RNG. The client only renders it. Open a second
          tab to see both stay in sync.
        </footer>
      </div>
    </div>
  );
}
