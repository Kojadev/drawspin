import { WebSocketServer, WebSocket } from "ws";
import { randomInt, randomUUID } from "crypto";

type Phase = "betting" | "drawing" | "result";

interface Segment {
  index: number;
  label: string;
  color: string;
  multiplier: number;
}

const SEGMENTS: Segment[] = [
  { index: 0, label: "2x", color: "#ef4444", multiplier: 2 },
  { index: 1, label: "3x", color: "#f59e0b", multiplier: 3 },
  { index: 2, label: "5x", color: "#10b981", multiplier: 5 },
  { index: 3, label: "2x", color: "#3b82f6", multiplier: 2 },
  { index: 4, label: "10x", color: "#a855f7", multiplier: 10 },
  { index: 5, label: "2x", color: "#ec4899", multiplier: 2 },
  { index: 6, label: "3x", color: "#22d3ee", multiplier: 3 },
  { index: 7, label: "5x", color: "#f97316", multiplier: 5 },
];

const BETTING_MS = 9000;
const DRAWING_MS = 6000;
const RESULT_MS = 4000;
const START_BALANCE = 1000;

interface Bet {
  segment: number;
  amount: number;
}

interface Client {
  id: string;
  socket: WebSocket;
  balance: number;
  bets: Bet[];
}

const clients = new Map<WebSocket, Client>();
const history: number[] = [];

let phase: Phase = "betting";
let roundId = 1;
let phaseEndsAt = Date.now() + BETTING_MS;
let winningIndex: number | null = null;
let spinSeed: number | null = null;

function send(ws: WebSocket, payload: unknown): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
}

function broadcast(payload: unknown): void {
  const msg = JSON.stringify(payload);
  for (const c of clients.values()) {
    if (c.socket.readyState === WebSocket.OPEN) c.socket.send(msg);
  }
}

function statePayload() {
  return {
    type: "state",
    phase,
    roundId,
    phaseEndsAt,
    serverNow: Date.now(),
    segments: SEGMENTS,
    winningIndex,
    spinSeed,
    players: clients.size,
  };
}

function broadcastState(): void {
  broadcast(statePayload());
}

function enterBetting(): void {
  phase = "betting";
  roundId += 1;
  winningIndex = null;
  spinSeed = null;
  phaseEndsAt = Date.now() + BETTING_MS;
  for (const c of clients.values()) c.bets = [];
  broadcastState();
}

function enterDrawing(): void {
  phase = "drawing";
  winningIndex = randomInt(0, SEGMENTS.length);
  spinSeed = randomInt(0, 1_000_000);
  phaseEndsAt = Date.now() + DRAWING_MS;
  broadcastState();
}

function enterResult(): void {
  phase = "result";
  phaseEndsAt = Date.now() + RESULT_MS;

  const win = winningIndex ?? 0;
  history.unshift(win);
  if (history.length > 16) history.pop();

  for (const c of clients.values()) {
    let payout = 0;
    for (const b of c.bets) {
      if (b.segment === win) payout += b.amount * SEGMENTS[win].multiplier;
    }
    if (payout > 0) c.balance += payout;
    const hadBet = c.bets.length > 0;
    send(c.socket, {
      type: "balance",
      balance: c.balance,
      lastWin: hadBet ? payout : null,
    });
  }

  broadcast({ type: "history", results: history });
  broadcastState();
}

function tick(): void {
  if (Date.now() < phaseEndsAt) return;
  if (phase === "betting") enterDrawing();
  else if (phase === "drawing") enterResult();
  else enterBetting();
}

setInterval(tick, 200);

const PORT = Number(process.env.PORT) || 8080;
const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (socket: WebSocket) => {
  const client: Client = {
    id: randomUUID(),
    socket,
    balance: START_BALANCE,
    bets: [],
  };
  clients.set(socket, client);

  send(socket, {
    type: "welcome",
    playerId: client.id,
    balance: client.balance,
    segments: SEGMENTS,
  });
  send(socket, statePayload());
  send(socket, { type: "history", results: history });
  broadcastState();

  socket.on("message", (raw) => {
    let msg: any;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg?.type === "bet") {
      if (phase !== "betting") return;

      const segment = Number(msg.segment);
      const amount = Number(msg.amount);
      if (!Number.isInteger(segment) || segment < 0 || segment >= SEGMENTS.length) return;
      if (!Number.isFinite(amount) || amount <= 0) return;
      if (amount > client.balance) return;

      client.balance -= amount;
      client.bets.push({ segment, amount });
      send(socket, { type: "balance", balance: client.balance, lastWin: null });
    }
  });

  socket.on("close", () => {
    clients.delete(socket);
    broadcastState();
  });
});

console.log(`DrawSpin server listening on ws://localhost:${PORT}`);
