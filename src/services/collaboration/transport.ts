import type { ClientMessage, ServerMessage } from "./protocol";
import { isServerMessage } from "./protocol";

export type ConnectionState = "connecting" | "open" | "reconnecting" | "closed";

export interface CollabTransport {
  connect(): void;
  send(message: ClientMessage): void;
  onMessage(handler: (message: ServerMessage) => void): void;
  close(): void;
  getState(): ConnectionState;
  subscribe(listener: (state: ConnectionState) => void): () => void;
}

const INITIAL_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 10_000;

export class WebSocketCollabTransport implements CollabTransport {
  private socket: WebSocket | null = null;
  private state: ConnectionState = "closed";
  private messageHandler: ((message: ServerMessage) => void) | null = null;
  private readonly stateListeners = new Set<(state: ConnectionState) => void>();
  private backoffMs = INITIAL_BACKOFF_MS;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private manuallyClosed = false;

  constructor(private readonly url: string) {}

  connect(): void {
    this.manuallyClosed = false;
    this.openSocket();
  }

  send(message: ClientMessage): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  onMessage(handler: (message: ServerMessage) => void): void {
    this.messageHandler = handler;
  }

  close(): void {
    this.manuallyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const socket = this.socket;
    this.socket = null;
    socket?.close();
    this.setState("closed");
  }

  getState(): ConnectionState {
    return this.state;
  }

  subscribe(listener: (state: ConnectionState) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  private openSocket(): void {
    this.setState(this.socket ? "reconnecting" : "connecting");
    const socket = new WebSocket(this.url);
    this.socket = socket;
    socket.addEventListener("open", () => {
      this.backoffMs = INITIAL_BACKOFF_MS;
      this.setState("open");
    });
    socket.addEventListener("message", (event) => this.handleRaw(event.data));
    socket.addEventListener("close", () => this.handleClose(socket));
    socket.addEventListener("error", () => socket.close());
  }

  private handleRaw(data: unknown): void {
    if (typeof data !== "string") return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      return;
    }
    if (!isServerMessage(parsed)) return;
    this.messageHandler?.(parsed);
  }

  private handleClose(socket: WebSocket): void {
    if (this.socket !== socket) return;
    this.socket = null;
    if (this.manuallyClosed) {
      this.setState("closed");
      return;
    }
    this.setState("reconnecting");
    const delay = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);
    this.reconnectTimer = setTimeout(() => this.openSocket(), delay);
  }

  private setState(state: ConnectionState): void {
    if (this.state === state) return;
    this.state = state;
    for (const listener of this.stateListeners) {
      listener(state);
    }
  }
}
