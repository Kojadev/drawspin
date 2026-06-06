import { useEffect, useRef, useState } from "react";
import { useGame } from "./useGame";
import { useLiveBets } from "./useLiveBets";
import * as sfx from "./sfx";
import Wheel from "./Wheel";

const DRAWING_MS = 6000;
const MIN_STAKE = 10;

const PHASE = {
  betting: { eyebrow: "Place your bets", head: "RAIN", timerLabel: "Closes in" },
  drawing: { eyebrow: "No more bets", head: "SPINNING", timerLabel: "Resolving" },
  result: { eyebrow: "Round settled", head: "RESULT", timerLabel: "Next round" },
} as const;

function CoinIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
      <defs>
        <radialGradient id="coinFace" cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#fff1c4" />
          <stop offset="55%" stopColor="#ffce5c" />
          <stop offset="100%" stopColor="#e89a1c" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="11" fill="#b56f0d" />
      <circle cx="12" cy="12" r="9.6" fill="url(#coinFace)" />
      <circle cx="12" cy="12" r="6.6" fill="none" stroke="#b56f0d" strokeWidth="1.3" strokeOpacity="0.55" />
      <path d="M12 6.4l1.7 3.7 3.9.4-2.9 2.6.85 3.9L12 17.5l-3.55 1.9.85-3.9-2.9-2.6 3.9-.4z" fill="#fff7e0" fillOpacity="0.9" />
    </svg>
  );
}

function Coin({ value, className = "" }: { value: string | number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono font-bold tabular-nums ${className}`}>
      <CoinIcon />
      {value}
    </span>
  );
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" stroke="none" />
      {muted ? (
        <>
          <line x1="16" y1="9" x2="22" y2="15" />
          <line x1="22" y1="9" x2="16" y2="15" />
        </>
      ) : (
        <>
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M18.8 6a8 8 0 0 1 0 12" />
        </>
      )}
    </svg>
  );
}

export default function App() {
  const { state, placeBet } = useGame();
  const [segment, setSegment] = useState<number | null>(null);
  const [stake, setStake] = useState(50);
  const [now, setNow] = useState(Date.now());
  const [muted, setMuted] = useState(false);
  const liveBets = useLiveBets(state);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 150);
    return () => clearInterval(id);
  }, []);

  const settledRound = useRef(-1);
  useEffect(() => {
    if (state.phase === "result" && state.lastResult && settledRound.current !== state.roundId) {
      settledRound.current = state.roundId;
      if (state.lastResult.payout > 0) sfx.win();
      else sfx.lose();
    }
  }, [state.phase, state.roundId, state.lastResult]);

  const secondsLeft = Math.max(0, Math.ceil((state.phaseEndsAt - (now + state.clockOffset)) / 1000));
  const isBetting = state.phase === "betting";
  const maxStake = Math.max(MIN_STAKE, state.balance);
  const clampedStake = Math.min(stake, maxStake);
  const canBet = state.connected && isBetting && segment !== null && clampedStake <= state.balance && clampedStake > 0;
  const fillPct = ((clampedStake - MIN_STAKE) / Math.max(1, maxStake - MIN_STAKE)) * 100;

  const winSeg = state.winningIndex != null ? state.segments[state.winningIndex] : null;
  const prevIndex = state.history.length > 0 ? state.history[0] : null;
  const phase = PHASE[state.phase as keyof typeof PHASE] ?? PHASE.betting;
  const showTimer = isBetting || state.phase === "drawing";

  const selectSegment = (idx: number) => {
    setSegment(idx);
    sfx.select();
  };

  const handleBet = () => {
    if (!canBet || segment === null) return;
    placeBet(segment, clampedStake);
    sfx.bet();
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    sfx.setMuted(next);
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-[940px] flex-col gap-6 px-5 py-7">
      <header className="rise flex items-center justify-between" style={{ animationDelay: "0ms" }}>
        <span className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-white/[0.03] px-3 py-1.5">
          <span
            className={`relative inline-flex h-2 w-2 rounded-full ${state.connected ? "bg-[var(--green)]" : "bg-rose-500"}`}
            style={state.connected ? { animation: "pulse-ring 2s ease-out infinite" } : undefined}
          />
          <span className="eyebrow !tracking-[0.22em] text-[var(--text)]">
            {state.connected ? `${state.players} online` : "connecting"}
          </span>
        </span>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? "Unmute" : "Mute"}
            className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--line)] bg-white/[0.03] text-[var(--muted)] transition hover:text-white"
          >
            <SpeakerIcon muted={muted} />
          </button>
          <span className="eyebrow hidden sm:block">Balance</span>
          <Coin
            value={state.balance.toLocaleString()}
            className="rounded-xl border border-[var(--line-strong)] bg-white/[0.04] px-3.5 py-2 text-[15px] text-white"
          />
        </div>
      </header>

      <div className="rise flex items-end justify-between" style={{ animationDelay: "60ms" }}>
        <div>
          <div className="eyebrow mb-1 text-[var(--green)]">{phase.eyebrow}</div>
          <h1 className="font-display text-6xl font-extrabold leading-[0.85] text-white">{phase.head}</h1>
        </div>
        <div className="text-right">
          <div className="eyebrow mb-1">{phase.timerLabel}</div>
          <div className="font-mono text-4xl font-extrabold tabular-nums text-[var(--green)] [text-shadow:0_0_22px_rgba(68,240,140,0.35)]">
            0:{String(showTimer ? secondsLeft : 0).padStart(2, "0")}
          </div>
        </div>
      </div>

      <section
        className="rise panel relative flex items-center justify-center overflow-hidden py-3"
        style={{ animationDelay: "120ms" }}
      >
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
          style={{ background: "radial-gradient(60% 100% at 50% 100%, rgba(68,240,140,0.1), transparent 70%)" }}
        />
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
          <div className="absolute bottom-4 z-10 flex items-center gap-3 rounded-full border border-[var(--line-strong)] bg-black/55 px-5 py-2 backdrop-blur-md">
            <span className="eyebrow">Landed</span>
            <span className="font-mono text-sm font-bold" style={{ color: winSeg.color }}>
              {winSeg.label.toUpperCase()}
            </span>
            {state.lastResult && state.lastResult.payout > 0 && (
              <span className="font-mono text-sm font-extrabold text-[var(--green)]">
                +{state.lastResult.payout.toLocaleString()}
              </span>
            )}
          </div>
        )}
      </section>

      <section className="rise panel p-5" style={{ animationDelay: "180ms" }}>
        <div className="mb-3 flex items-center justify-between">
          <span className="eyebrow">Your pick</span>
          {segment != null && (
            <span className="font-mono text-xs font-bold" style={{ color: state.segments[segment]?.color }}>
              {state.segments[segment]?.label.toUpperCase()} selected
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {state.segments.map((s) => {
            const selected = segment === s.index;
            return (
              <button
                key={s.index}
                type="button"
                disabled={!isBetting}
                onClick={() => selectSegment(s.index)}
                className="font-mono rounded-lg px-3.5 py-2 text-sm font-extrabold tracking-tight transition-transform duration-100 hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:translate-y-0"
                style={{
                  color: s.color,
                  background: selected ? `${s.color}26` : "rgba(255,255,255,0.02)",
                  border: `1.5px solid ${selected ? s.color : `${s.color}44`}`,
                  boxShadow: selected ? `0 0 18px ${s.color}55, inset 0 0 12px ${s.color}22` : "none",
                }}
              >
                {s.label.replace("x", "×")}
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-3">
            <Coin
              value={clampedStake.toLocaleString()}
              className="h-11 w-[104px] justify-center rounded-xl border border-[var(--line-strong)] bg-black/40 text-sm text-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]"
            />
            <input
              type="range"
              className="stake flex-1"
              min={MIN_STAKE}
              max={maxStake}
              step={5}
              value={clampedStake}
              disabled={!isBetting}
              onChange={(e) => setStake(Number(e.target.value))}
              style={{ background: `linear-gradient(90deg, var(--green-deep), var(--green) ${fillPct}%, rgba(255,255,255,0.06) ${fillPct}%)` }}
            />
            <button
              type="button"
              disabled={!isBetting}
              onClick={() => {
                setStake(maxStake);
                sfx.select();
              }}
              className="font-mono h-11 rounded-xl border border-[var(--line-strong)] bg-white/[0.03] px-4 text-xs font-extrabold uppercase tracking-[0.15em] text-[var(--muted)] transition hover:border-[var(--green)] hover:text-[var(--green)] disabled:opacity-35"
            >
              Max
            </button>
          </div>

          <button
            type="button"
            disabled={!canBet}
            onClick={handleBet}
            className="font-display rounded-xl bg-[var(--green)] px-8 py-3 text-base font-extrabold tracking-tight text-[#062012] shadow-[0_10px_30px_-8px_rgba(68,240,140,0.6),inset_0_1px_0_rgba(255,255,255,0.4)] transition hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-white/[0.05] disabled:text-[var(--muted-2)] disabled:shadow-none"
            style={canBet ? { animation: "pulse-ring 2.4s ease-out infinite" } : undefined}
          >
            {isBetting ? "Bet Now" : "Closed"}
          </button>
        </div>
      </section>

      <section className="rise panel p-5" style={{ animationDelay: "240ms" }}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--green)]" style={{ animation: "pulse-ring 2s ease-out infinite" }} />
            <h2 className="font-display text-lg font-bold text-white">All Bets</h2>
          </div>
          <span className="eyebrow">{liveBets.length} live</span>
        </div>

        <div className="mb-2 grid grid-cols-[1fr_70px_minmax(96px,1fr)] items-center gap-4 px-3 sm:grid-cols-[1fr_90px_120px]">
          <span className="eyebrow">Player</span>
          <span className="eyebrow text-right">Pick</span>
          <span className="eyebrow text-right">Wager</span>
        </div>

        <div className="flex flex-col">
          {liveBets.length === 0 && (
            <div className="py-8 text-center">
              <span className="eyebrow text-[var(--muted-2)]">No bets yet — place one to appear here</span>
            </div>
          )}
          {liveBets.map((b) => (
            <div
              key={b.key}
              className={`row-in grid grid-cols-[1fr_70px_minmax(96px,1fr)] items-center gap-4 rounded-lg border-t border-[var(--line)] px-3 py-2.5 first:border-t-0 sm:grid-cols-[1fr_90px_120px] ${
                b.you ? "bg-[var(--green)]/[0.06]" : "hover:bg-white/[0.02]"
              }`}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-black uppercase text-white/90"
                  style={{ background: `linear-gradient(140deg, ${b.color}, ${b.color}88)`, boxShadow: `0 0 10px ${b.color}44` }}
                >
                  {b.name[0]}
                </span>
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="flex items-center gap-1.5 truncate text-sm font-semibold text-[var(--text)]">
                    {b.name}
                    {b.you && (
                      <span className="font-mono rounded bg-[var(--green)]/15 px-1 text-[9px] font-bold uppercase tracking-wider text-[var(--green)]">
                        you
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-[10px] text-[var(--muted-2)]">#{b.id}</span>
                </span>
              </span>
              <span className="text-right font-mono text-sm font-bold" style={{ color: b.color }}>
                {b.mult.toFixed(2)}×
              </span>
              <span className="flex justify-end">
                {b.result === "win" ? (
                  <Coin value={`+${b.payout.toLocaleString()}`} className="text-sm text-[var(--green)]" />
                ) : b.result === "lose" ? (
                  <Coin value={b.amount.toLocaleString()} className="text-sm text-[var(--muted-2)] line-through" />
                ) : (
                  <Coin value={b.amount.toLocaleString()} className="text-sm text-[var(--text)]" />
                )}
              </span>
            </div>
          ))}
        </div>
      </section>

      <footer className="rise text-center" style={{ animationDelay: "300ms" }}>
        <span className="eyebrow !tracking-[0.25em] text-[var(--muted-2)]">
          Server-authoritative · crypto RNG · synced across tabs
        </span>
      </footer>
    </div>
  );
}
