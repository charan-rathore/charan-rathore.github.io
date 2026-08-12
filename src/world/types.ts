export type SemanticRole =
  | 'ingestion'
  | 'chunking'
  | 'retrieval'
  | 'provenance'
  | 'evaluation';

export type GhostState = 'invalid' | 'incomplete' | 'compatible';
export type WorldMode = 'playing' | 'resolved' | 'provenance-failure' | 'static';

/** Direct manipulation intents the visual world can emit from the canvas. */
export type WorldIntent = 'moveLeft' | 'moveRight' | 'rotateClockwise';

export interface GridCell {
  readonly x: number;
  readonly y: number;
}

export interface PieceSnapshot {
  readonly id: string;
  readonly role: SemanticRole;
  readonly label: string;
  readonly cells: readonly GridCell[];
  readonly position: GridCell;
  readonly active?: boolean;
}

export interface ConnectionSnapshot {
  readonly id: string;
  readonly from: GridCell;
  readonly to: GridCell;
  readonly fromRole: SemanticRole;
  readonly toRole: SemanticRole;
  readonly broken?: boolean;
}

/** Narrow immutable projection contract. The pure game reducer remains authoritative. */
export interface WorldSnapshot {
  readonly revision: number;
  readonly mode: WorldMode;
  readonly pieces: readonly PieceSnapshot[];
  readonly ghost?: PieceSnapshot & { readonly state: GhostState };
  readonly connections: readonly ConnectionSnapshot[];
  readonly settlingPieceId?: string;
}

export interface WorldRuntimeOptions {
  readonly quality?: 'auto' | 'high' | 'low';
  readonly reducedMotion?: boolean;
  readonly onFailure?: (reason: string) => void;
  readonly onIntent?: (intent: WorldIntent) => void;
}
