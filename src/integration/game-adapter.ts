import { INTELLIRAG_RECIPE, PIECES, buildDirectedEdges, classifyGhost, worldCells } from '../game';
import type { GameEvent, GameIntent as GameCommand, GameState, PieceId } from '../game';
import type { GameIntent as SemanticIntent, LivingSystemsSnapshot } from '../ui/contracts';
import { toModelCommand } from '../ui/command-translation';
import type { ConnectionSnapshot, PieceSnapshot, WorldMode, WorldSnapshot } from '../world/types';

const FACING = ['north', 'east', 'south', 'west'] as const;

export function commandFromSemanticIntent(intent: SemanticIntent, state: GameState): GameCommand {
  return toModelCommand(intent, state);
}

export function semanticSnapshotFromGame(state: GameState, events: readonly GameEvent[] = []): LivingSystemsSnapshot {
  const edges = buildDirectedEdges(state.placements);
  const ghost = classifyGhost(state);
  const activeDefinition = state.active ? PIECES[state.active.pieceId] : null;
  const phase = state.phase === 'resolved' ? 'counterfactualPrompt'
    : state.phase === 'counterfactual' ? 'counterfactualPlaying'
      : state.phase === 'insight-resolved' ? 'insightResolved'
        : state.phase === 'paused' ? 'paused' : 'playing';
  return {
    phase,
    currentPiece: state.active && activeDefinition ? {
      id: state.active.pieceId,
      name: activeDefinition.label,
      role: activeDefinition.description,
      orientation: FACING[state.active.transform.rotation],
      ports: activeDefinition.ports.map((port) => `${port.direction}: ${port.type} (${port.facing})`),
    } : null,
    queue: state.queue.slice(state.queueIndex + 1).map((id) => PIECES[id].label),
    recipe: {
      name: 'IntelliRAG',
      completed: state.placements.map((placement) => PIECES[placement.pieceId].label),
      required: INTELLIRAG_RECIPE.requiredPath.map((id) => PIECES[id].label),
    },
    connections: edges.map((edge) => `${PIECES[edge.fromPieceId].label} → ${PIECES[edge.toPieceId].label}`),
    ghost: ghost ? {
      state: ghost.kind,
      message: ghost.kind === 'invalid' ? `Cannot place — ${ghost.reason}.` : ghost.message,
      consequence: ghost.kind === 'compatible' ? ghost.edges.map((edge) => `${PIECES[edge.fromPieceId].label} → ${PIECES[edge.toPieceId].label}`).join(', ') : undefined,
    } : null,
    provenanceWithheld: state.removedProvenance !== null,
    announcement: announcementFromEvents(events),
  };
}

export function worldSnapshotFromGame(
  state: GameState,
  revision: number,
  events: readonly GameEvent[] = [],
  staticMode = false,
): WorldSnapshot {
  const mode: WorldMode = staticMode ? 'static' : state.phase === 'counterfactual' ? 'provenance-failure' : state.phase === 'resolved' || state.phase === 'insight-resolved' ? 'resolved' : 'playing';
  const pieces: PieceSnapshot[] = state.placements.map((piece) => projectPiece(piece));
  if (state.active) pieces.push(projectPiece({ ...state.active, transform: state.active.transform }, true));
  const ghost = classifyGhost(state);
  const projectedGhost = state.active && ghost && ghost.kind !== 'invalid' ? {
    ...projectPiece({ ...state.active, transform: ghost.transform }, true),
    id: `ghost-${state.active.instanceId}`,
    state: ghost.kind,
  } : undefined;
  const byInstance = new Map(state.placements.map((placement) => [placement.instanceId, placement]));
  const connections: ConnectionSnapshot[] = buildDirectedEdges(state.placements).map((edge) => {
    const from = byInstance.get(edge.fromInstanceId)!;
    const to = byInstance.get(edge.toInstanceId)!;
    return {
      id: `${edge.fromInstanceId}-${edge.toInstanceId}`,
      fromRole: edge.fromPieceId,
      toRole: edge.toPieceId,
      from: { x: from.transform.x, y: from.transform.y },
      to: { x: to.transform.x, y: to.transform.y },
    };
  });
  if (state.phase === 'counterfactual' && state.removedProvenance) {
    const removed = state.removedProvenance;
    const retrieval = state.placements.find((piece) => piece.pieceId === 'retrieval');
    const evaluation = state.placements.find((piece) => piece.pieceId === 'evaluation');
    if (retrieval) connections.push(brokenConnection(retrieval, removed));
    if (evaluation) connections.push(brokenConnection(removed, evaluation));
  }
  const settlingPieceId = [...events].reverse().find((event) => event.type === 'piece-placed');
  return {
    revision,
    mode,
    pieces,
    ghost: projectedGhost,
    connections,
    settlingPieceId: settlingPieceId?.type === 'piece-placed' ? settlingPieceId.placement.instanceId : undefined,
  };
}

function projectPiece(piece: GameState['placements'][number], active = false): PieceSnapshot {
  const definition = PIECES[piece.pieceId];
  const cells = worldCells(definition, piece.transform);
  const origin = cells[0] ?? piece.transform;
  return {
    id: piece.instanceId,
    role: piece.pieceId,
    label: definition.label.toUpperCase(),
    cells: cells.map((cell) => ({ x: cell.x - origin.x, y: cell.y - origin.y })),
    position: origin,
    active,
  };
}

function brokenConnection(from: { instanceId: string; pieceId: PieceId; transform: GameState['placements'][number]['transform'] }, to: { instanceId: string; pieceId: PieceId; transform: GameState['placements'][number]['transform'] }): ConnectionSnapshot {
  return { id: `broken-${from.instanceId}-${to.instanceId}`, fromRole: from.pieceId, toRole: to.pieceId, from: from.transform, to: to.transform, broken: true };
}

export function announcementFromEvents(events: readonly GameEvent[]): string | undefined {
  const causalPriority: readonly GameEvent['type'][] = ['continuation-revealed', 'counterfactual-restored', 'counterfactual-started'];
  const event = causalPriority.map((type) => [...events].reverse().find((candidate) => candidate.type === type)).find(Boolean)
    ?? [...events].reverse().find((candidate) => candidate.type === 'insight' && candidate.insightId === 'provenance-load-bearing')
    ?? events.at(-1);
  if (!event) return undefined;
  switch (event.type) {
    case 'piece-moved': return 'Piece moved.';
    case 'piece-rotated': return 'Piece rotated.';
    case 'piece-placed': return `${PIECES[event.placement.pieceId].label} placed.`;
    case 'piece-spawned': return `${PIECES[event.piece.pieceId].label} ready.`;
    case 'connection-created': return `${PIECES[event.edge.fromPieceId].label} connected to ${PIECES[event.edge.toPieceId].label}.`;
    case 'system-resolved': return 'The system resolved. What breaks when provenance disappears?';
    case 'counterfactual-started': return 'Provenance withheld. Citation paths are broken and evaluation is degraded.';
    case 'counterfactual-restored': return 'Provenance restored. The grounded evidence path is repaired.';
    case 'continuation-revealed': return 'Insight resolved. Document and Source is now discoverable.';
    case 'insight': return event.insightId === 'provenance-load-bearing' ? 'Provenance is load-bearing infrastructure.' : undefined;
    case 'intent-rejected': return event.reason;
    case 'undone': return 'Last unresolved placement undone.';
    case 'paused': return 'Game paused.';
    case 'resumed': return 'Game resumed.';
    case 'piece-dropped': return undefined;
  }
}
