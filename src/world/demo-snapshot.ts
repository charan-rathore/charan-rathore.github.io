import type { PieceSnapshot, SemanticRole, WorldMode, WorldSnapshot } from './types';

const roles: readonly SemanticRole[] = ['ingestion', 'chunking', 'retrieval', 'provenance', 'evaluation'];
const labels: Record<SemanticRole, string> = {
  ingestion: 'INGEST',
  chunking: 'CHUNK',
  retrieval: 'RETRIEVE',
  provenance: 'PROVENANCE',
  evaluation: 'EVALUATE',
};

const shapes: Record<SemanticRole, readonly { x: number; y: number }[]> = {
  ingestion: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
  chunking: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
  retrieval: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }],
  provenance: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
  evaluation: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }],
};

const positions = [{ x: 0, y: 13 }, { x: 2, y: 12 }, { x: 4, y: 13 }, { x: 7, y: 13 }, { x: 9, y: 12 }];

export function createDemoSnapshot(mode: WorldMode = 'playing', revision = 0): WorldSnapshot {
  const pieces: PieceSnapshot[] = roles.map((role, index) => ({
    id: role,
    role,
    label: labels[role],
    cells: shapes[role],
    position: positions[index] ?? { x: 0, y: 0 },
  }));

  return {
    revision,
    mode,
    pieces,
    ghost: mode === 'playing' ? {
      id: 'active-retrieval',
      role: 'retrieval',
      label: 'RETRIEVAL',
      cells: shapes.retrieval,
      position: { x: 4, y: 8 },
      state: 'compatible',
      active: true,
    } : undefined,
    connections: roles.slice(0, -1).map((role, index) => ({
      id: `${role}-${roles[index + 1]}`,
      fromRole: role,
      toRole: roles[index + 1] ?? 'evaluation',
      from: { x: (positions[index]?.x ?? 0) + 1, y: positions[index]?.y ?? 0 },
      to: { x: positions[index + 1]?.x ?? 0, y: positions[index + 1]?.y ?? 0 },
      broken: mode === 'provenance-failure' && (role === 'retrieval' || role === 'provenance'),
    })),
  };
}
