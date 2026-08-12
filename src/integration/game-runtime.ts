import { createInitialState, reduceGame } from '../game';
import type { GameEvent, GameState } from '../game';
import type { GameIntent as SemanticIntent, LivingSystemsAdapter, LivingSystemsSnapshot } from '../ui/contracts';
import type { WorldSnapshot } from '../world/types';
import { commandFromSemanticIntent, semanticSnapshotFromGame, worldSnapshotFromGame } from './game-adapter';

export interface GameRuntimeOptions {
  readonly gravityIntervalMs?: number;
  readonly maxTicksPerFrame?: number;
  readonly now?: () => number;
  readonly requestFrame?: (callback: FrameRequestCallback) => number;
  readonly cancelFrame?: (handle: number) => void;
  readonly onWorldSnapshot?: (snapshot: WorldSnapshot) => void;
}

export class GameRuntime implements LivingSystemsAdapter {
  private state: GameState = createInitialState();
  private events: readonly GameEvent[] = [];
  private revision = 0;
  private staticMode = false;
  private frame = 0;
  private lastFrameTime: number | null = null;
  private accumulator = 0;
  private readonly listeners = new Set<(snapshot: LivingSystemsSnapshot) => void>();
  private readonly gravityIntervalMs: number;
  private readonly maxTicksPerFrame: number;
  private readonly now: () => number;
  private readonly requestFrame: (callback: FrameRequestCallback) => number;
  private readonly cancelFrame: (handle: number) => void;
  private readonly onWorldSnapshot?: (snapshot: WorldSnapshot) => void;

  constructor(options: GameRuntimeOptions = {}) {
    this.gravityIntervalMs = options.gravityIntervalMs ?? 700;
    this.maxTicksPerFrame = options.maxTicksPerFrame ?? 5;
    this.now = options.now ?? (() => performance.now());
    this.requestFrame = options.requestFrame ?? ((callback) => requestAnimationFrame(callback));
    this.cancelFrame = options.cancelFrame ?? ((handle) => cancelAnimationFrame(handle));
    this.onWorldSnapshot = options.onWorldSnapshot;
  }

  dispatch(intent: SemanticIntent): void {
    this.apply(commandFromSemanticIntent(intent, this.state));
  }

  getSnapshot(): LivingSystemsSnapshot {
    return semanticSnapshotFromGame(this.state, this.events);
  }

  getGameState(): GameState {
    return this.state;
  }

  subscribe(listener: (snapshot: LivingSystemsSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  start(): void {
    this.publish([]);
  }

  setStaticMode(enabled: boolean): void {
    if (this.staticMode === enabled) return;
    this.staticMode = enabled;
    this.publish([]);
  }

  pauseForEnvironment(): void {
    if (this.state.phase !== 'paused') this.apply({ type: 'pause' });
  }

  resumeFromEnvironment(): void {
    if (this.state.phase === 'paused') this.apply({ type: 'resume' });
  }

  dispose(): void {
    if (this.frame) this.cancelFrame(this.frame);
    this.frame = 0;
    this.listeners.clear();
  }

  private apply(command: Parameters<typeof reduceGame>[1]): void {
    const result = reduceGame(this.state, command);
    this.state = result.state;
    this.publish(result.events);
  }

  private publish(events: readonly GameEvent[]): void {
    this.events = events;
    this.revision += 1;
    const semantic = semanticSnapshotFromGame(this.state, events);
    this.listeners.forEach((listener) => listener(semantic));
    this.onWorldSnapshot?.(worldSnapshotFromGame(this.state, this.revision, events, this.staticMode));
    this.syncTicker();
  }

  private syncTicker(): void {
    const shouldTick = this.state.started && this.state.phase === 'playing' && this.state.active !== null && !this.staticMode;
    if (shouldTick && !this.frame) {
      this.lastFrameTime = this.now();
      this.frame = this.requestFrame(this.tick);
    } else if (!shouldTick && this.frame) {
      this.cancelFrame(this.frame);
      this.frame = 0;
      this.lastFrameTime = null;
      this.accumulator = 0;
    }
  }

  private readonly tick = (time: number): void => {
    this.frame = 0;
    if (this.state.phase !== 'playing' || !this.state.active || this.staticMode) return;
    const previous = this.lastFrameTime ?? time;
    this.lastFrameTime = time;
    this.accumulator += Math.min(100, Math.max(0, time - previous));
    let steps = 0;
    let events: readonly GameEvent[] = [];
    while (this.accumulator >= this.gravityIntervalMs && steps < this.maxTicksPerFrame) {
      const result = reduceGame(this.state, { type: 'tick' });
      this.state = result.state;
      events = [...events, ...result.events];
      this.accumulator -= this.gravityIntervalMs;
      steps += 1;
    }
    if (steps === this.maxTicksPerFrame && this.accumulator >= this.gravityIntervalMs) this.accumulator = 0;
    if (events.length) this.publish(events);
    else this.syncTicker();
  };
}
