import type { GameIntent as ModelGameCommand, GameState } from '../game/types';
import type { GameIntent as SemanticIntent } from './contracts';

/** Keeps presentation vocabulary out of the deterministic model contract. */
export function toModelCommand(intent: SemanticIntent, state?: Pick<GameState, 'phase'>): ModelGameCommand {
  switch (intent.type) {
    case 'moveLeft': return { type: 'move', dx: -1 };
    case 'moveRight': return { type: 'move', dx: 1 };
    case 'softDrop': return { type: 'soft-drop' };
    case 'rotateClockwise': return { type: 'rotate', direction: 1 };
    case 'place': return { type: 'hard-drop' };
    case 'undo': return { type: 'undo' };
    case 'pause': return { type: state?.phase === 'paused' ? 'resume' : 'pause' };
    case 'resume': return { type: 'resume' };
    case 'withholdProvenance': return { type: 'remove-provenance' };
    case 'restoreProvenance': return { type: 'restore-provenance' };
  }
}
