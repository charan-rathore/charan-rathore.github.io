export const GAME_INTENTS = [
  'start',
  'moveLeft',
  'moveRight',
  'softDrop',
  'rotateClockwise',
  'place',
  'undo',
  'pause',
  'resume',
  'withholdProvenance',
  'restoreProvenance',
] as const;

export type GameIntentType = (typeof GAME_INTENTS)[number];
export type InputSource = 'keyboard' | 'pointer' | 'touch' | 'control';

export interface GameIntent {
  type: GameIntentType;
  source: InputSource;
}

export type ExperiencePhase =
  | 'intro'
  | 'playing'
  | 'placementConfirmation'
  | 'resolving'
  | 'counterfactualPrompt'
  | 'counterfactualPlaying'
  | 'insightResolved'
  | 'inspection'
  | 'paused'
  | 'direct'
  | 'fallback';

export type GhostState = 'invalid' | 'incomplete' | 'compatible';

export interface SemanticPiece {
  id: string;
  name: string;
  role: string;
  orientation: string;
  ports: readonly string[];
}

export interface LivingSystemsSnapshot {
  phase: ExperiencePhase;
  currentPiece: SemanticPiece | null;
  queue: readonly string[];
  recipe: {
    name: string;
    completed: readonly string[];
    required: readonly string[];
  };
  connections: readonly string[];
  ghost: {
    state: GhostState;
    message: string;
    consequence?: string;
  } | null;
  provenanceWithheld: boolean;
  announcement?: string;
}

export interface LivingSystemsAdapter {
  dispatch(intent: GameIntent): void;
  subscribe?(listener: (snapshot: LivingSystemsSnapshot) => void): () => void;
  getSnapshot?(): LivingSystemsSnapshot;
}

export const INITIAL_SEMANTIC_SNAPSHOT: LivingSystemsSnapshot = {
  phase: 'intro',
  currentPiece: {
    id: 'retrieval',
    name: 'Retrieval',
    role: 'Hybrid retrieval',
    orientation: 'north',
    ports: ['input: chunks', 'output: evidence candidates'],
  },
  queue: ['Provenance', 'Evaluation'],
  recipe: {
    name: 'IntelliRAG',
    completed: ['Ingestion', 'Chunking'],
    required: ['Ingestion', 'Chunking', 'Retrieval', 'Provenance', 'Evaluation'],
  },
  connections: ['Ingestion → Chunking'],
  ghost: {
    state: 'compatible',
    message: 'Can place, compatible evidence path.',
    consequence: 'Predicted connection: Chunking → Retrieval.',
  },
  provenanceWithheld: false,
};
