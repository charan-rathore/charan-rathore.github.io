import { createInitialState, reduceGame } from './reducer';
import type { GameState, ReplayCommand } from './types';
const canonicalize = (value: unknown): unknown => Array.isArray(value) ? value.map(canonicalize) : value !== null && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonicalize(item)])) : value;
export const canonicalSerialize = (state: GameState): string => JSON.stringify(canonicalize(state));
export const stableStateHash = (state: GameState): string => { let hash = 0xcbf29ce484222325n; for (const byte of new TextEncoder().encode(canonicalSerialize(state))) { hash ^= BigInt(byte); hash = BigInt.asUintN(64, hash * 0x100000001b3n); } return hash.toString(16).padStart(16, '0'); };
export const replay = (seed: string, commands: readonly ReplayCommand[]): GameState => { let state = createInitialState(seed); for (const command of commands) { while (state.tick < command.tick) state = reduceGame(state, { type: 'tick' }).state; state = reduceGame(state, command.intent).state; } return state; };
