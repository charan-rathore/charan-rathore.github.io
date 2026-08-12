import { describe, expect, it } from 'vitest';
import { INTELLIRAG_RECIPE, createInitialState } from '../game';
import type { GameState, PlacedPiece } from '../game';
import { commandFromSemanticIntent, semanticSnapshotFromGame, worldSnapshotFromGame } from './game-adapter';

const pipeline = (): readonly PlacedPiece[] => INTELLIRAG_RECIPE.requiredPath.map((pieceId, index) => ({
  instanceId: `${pieceId}-${index}`,
  pieceId,
  transform: { x: index + 2, y: 15, rotation: 0 },
}));

describe('game integration projections', () => {
  it('maps UI meaning to reducer commands and toggles pause from current state', () => {
    const playing = createInitialState();
    const paused: GameState = { ...playing, phase: 'paused', resumePhase: 'playing' };
    expect(commandFromSemanticIntent({ type: 'place', source: 'keyboard' }, playing)).toEqual({ type: 'hard-drop' });
    expect(commandFromSemanticIntent({ type: 'pause', source: 'keyboard' }, playing)).toEqual({ type: 'pause' });
    expect(commandFromSemanticIntent({ type: 'pause', source: 'keyboard' }, paused)).toEqual({ type: 'resume' });
    expect(commandFromSemanticIntent({ type: 'withholdProvenance', source: 'control' }, playing)).toEqual({ type: 'remove-provenance' });
  });

  it('derives semantic and world views from the same authoritative state', () => {
    const state: GameState = { ...createInitialState(), active: null, queueIndex: 5, placements: pipeline(), phase: 'resolved', discoveries: ['intellirag'] };
    const semantic = semanticSnapshotFromGame(state);
    const world = worldSnapshotFromGame(state, 7);
    expect(semantic.phase).toBe('counterfactualPrompt');
    expect(semantic.recipe.completed).toEqual(['Ingestion', 'Chunking', 'Retrieval', 'Provenance', 'Evaluation']);
    expect(semantic.connections).toHaveLength(4);
    expect(world.revision).toBe(7);
    expect(world.mode).toBe('resolved');
    expect(world.pieces).toHaveLength(5);
    expect(world.connections).toHaveLength(4);
  });

  it('projects broken counterfactual links when Provenance is withheld', () => {
    const provenance = pipeline()[3]!;
    const state: GameState = { ...createInitialState(), active: null, queueIndex: 5, placements: pipeline().filter((piece) => piece !== provenance), phase: 'counterfactual', discoveries: ['intellirag'], removedProvenance: provenance };
    const semantic = semanticSnapshotFromGame(state);
    const world = worldSnapshotFromGame(state, 9);
    expect(semantic.provenanceWithheld).toBe(true);
    expect(world.mode).toBe('provenance-failure');
    expect(world.connections.filter((connection) => connection.broken)).toHaveLength(2);
  });
});
