export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 16;
export const RULES_VERSION = 1;
export const SCHEMA_VERSION = 1;
export type PieceId = 'ingestion' | 'chunking' | 'retrieval' | 'provenance' | 'evaluation';
export type ConceptId = PieceId | 'document-source';
export type PortType = 'documents' | 'chunks' | 'candidates' | 'grounded-evidence';
export type Facing = 'north' | 'east' | 'south' | 'west';
export type Rotation = 0 | 1 | 2 | 3;
export interface Point { readonly x: number; readonly y: number }
export interface Transform extends Point { readonly rotation: Rotation }
export interface PiecePort { readonly id: string; readonly cell: Point; readonly facing: Facing; readonly direction: 'input' | 'output'; readonly type: PortType }
export interface PieceDefinition { readonly id: PieceId; readonly conceptId: ConceptId; readonly label: string; readonly glyph: string; readonly description: string; readonly consequence: string; readonly cells: readonly Point[]; readonly pivot: Point; readonly ports: readonly PiecePort[] }
export interface PlacedPiece { readonly instanceId: string; readonly pieceId: PieceId; readonly transform: Transform }
export type ActivePiece = PlacedPiece;
export interface DirectedEdge { readonly fromInstanceId: string; readonly fromPieceId: PieceId; readonly toInstanceId: string; readonly toPieceId: PieceId; readonly type: PortType }
export interface RecipeDefinition { readonly id: 'intellirag-pipeline'; readonly projectId: 'intellirag'; readonly requiredPath: readonly PieceId[]; readonly forbiddenShortcuts: readonly (readonly [PieceId, PieceId])[]; readonly principleId: 'attributable-failure' }
export interface RecipeResolution { readonly recipeId: 'intellirag-pipeline'; readonly projectId: 'intellirag'; readonly componentInstanceIds: readonly string[]; readonly edges: readonly DirectedEdge[] }
export type GamePhase = 'playing' | 'paused' | 'resolved' | 'counterfactual' | 'insight-resolved';
export interface UndoFrame { readonly placements: readonly PlacedPiece[]; readonly active: ActivePiece | null; readonly queueIndex: number; readonly phase: GamePhase; readonly discoveries: readonly string[]; readonly removedProvenance: PlacedPiece | null }
export interface GameState { readonly schemaVersion: number; readonly rulesVersion: number; readonly seed: string; readonly tick: number; readonly started: boolean; readonly phase: GamePhase; readonly resumePhase: Exclude<GamePhase, 'paused'> | null; readonly queue: readonly PieceId[]; readonly queueIndex: number; readonly active: ActivePiece | null; readonly placements: readonly PlacedPiece[]; readonly undo: readonly UndoFrame[]; readonly discoveries: readonly string[]; readonly removedProvenance: PlacedPiece | null }
export type GameIntent = { readonly type: 'move'; readonly dx: -1 | 1 } | { readonly type: 'rotate'; readonly direction: -1 | 1 } | { readonly type: 'soft-drop' | 'hard-drop' | 'place' | 'undo' | 'pause' | 'resume' | 'tick' | 'remove-provenance' | 'restore-provenance' };
export type GameEvent = { readonly type: 'piece-moved' | 'piece-rotated'; readonly instanceId: string; readonly transform: Transform } | { readonly type: 'piece-dropped'; readonly instanceId: string; readonly distance: number } | { readonly type: 'piece-placed'; readonly placement: PlacedPiece } | { readonly type: 'piece-spawned'; readonly piece: ActivePiece } | { readonly type: 'intent-rejected'; readonly intent: GameIntent['type']; readonly reason: string } | { readonly type: 'connection-created'; readonly edge: DirectedEdge } | { readonly type: 'system-resolved'; readonly resolution: RecipeResolution } | { readonly type: 'undone' | 'paused' | 'resumed' } | { readonly type: 'counterfactual-started'; readonly removed: PlacedPiece } | { readonly type: 'insight'; readonly insightId: 'citation-path-broken' | 'evaluation-degraded' | 'provenance-load-bearing' } | { readonly type: 'counterfactual-restored'; readonly restored: PlacedPiece } | { readonly type: 'continuation-revealed'; readonly conceptId: 'document-source' };
export interface ReduceResult { readonly state: GameState; readonly events: readonly GameEvent[] }
export type GhostClassification = { readonly kind: 'invalid'; readonly transform: Transform; readonly reason: 'occupied' | 'out-of-bounds' } | { readonly kind: 'incomplete'; readonly transform: Transform; readonly openPorts: readonly PiecePort[]; readonly message: string } | { readonly kind: 'compatible'; readonly transform: Transform; readonly edges: readonly DirectedEdge[]; readonly message: string };
export interface ReplayCommand { readonly tick: number; readonly intent: GameIntent }
