let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

if (typeof window !== "undefined") {
  const unlock = () => ensure();
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
}

export function setMuted(m: boolean): void {
  muted = m;
}
export function isMuted(): boolean {
  return muted;
}

function blip(freq: number, dur: number, type: OscillatorType, gain: number): void {
  if (muted) return;
  const ac = ensure();
  if (!ac || !master) return;
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export function tick(intensity = 0.5): void {
  const freq = 1500 + (1 - intensity) * 900;
  blip(freq, 0.05, "square", 0.06 + intensity * 0.06);
}

export function select(): void {
  blip(660, 0.06, "triangle", 0.08);
}

export function bet(): void {
  blip(420, 0.05, "sine", 0.12);
  setTimeout(() => blip(880, 0.08, "sine", 0.1), 45);
}

export function win(): void {
  if (muted) return;
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((f, i) => setTimeout(() => blip(f, 0.22, "triangle", 0.16), i * 80));
}

export function land(): void {
  if (muted) return;
  const ac = ensure();
  if (!ac || !master) return;
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(420, t);
  osc.frequency.exponentialRampToValueAtTime(90, t + 0.18);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.28, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + 0.3);
  blip(1600, 0.04, "square", 0.07);
}

export function lose(): void {
  if (muted) return;
  blip(300, 0.18, "sine", 0.1);
  setTimeout(() => blip(200, 0.26, "sine", 0.09), 110);
}
