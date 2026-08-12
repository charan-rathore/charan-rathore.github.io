import { describe, expect, it } from 'vitest';
import { createDemoSnapshot } from './demo-snapshot';

describe('createDemoSnapshot', () => {
  it('preserves the five-stage immutable projection contract', () => {
    const snapshot = createDemoSnapshot('resolved', 4);
    expect(snapshot.revision).toBe(4);
    expect(snapshot.pieces.map(({ role }) => role)).toEqual(['ingestion', 'chunking', 'retrieval', 'provenance', 'evaluation']);
    expect(snapshot.connections).toHaveLength(4);
    expect(snapshot.ghost).toBeUndefined();
  });

  it('marks both provenance-adjacent edges as broken in failure mode', () => {
    const snapshot = createDemoSnapshot('provenance-failure');
    expect(snapshot.connections.filter(({ broken }) => broken).map(({ id }) => id)).toEqual(['retrieval-provenance', 'provenance-evaluation']);
  });
});
