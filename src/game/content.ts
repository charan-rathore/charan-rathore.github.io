import type { ConceptId, PieceDefinition, PieceId, RecipeDefinition } from './types';
export interface ConceptContent { readonly id: ConceptId; readonly label: string; readonly summary: string }
export interface ProjectContent { readonly id: 'intellirag'; readonly title: string; readonly question: string; readonly stakes: string; readonly systemLoop: string; readonly evidence: string; readonly caveat: string; readonly judgment: string; readonly actions: readonly { readonly label: string; readonly href: string }[] }
const input = (type: 'documents' | 'chunks' | 'candidates' | 'grounded-evidence') => ({ id: `in-${type}`, cell: { x: 0, y: 0 }, facing: 'west', direction: 'input', type } as const);
const output = (type: 'documents' | 'chunks' | 'candidates' | 'grounded-evidence') => ({ id: `out-${type}`, cell: { x: 0, y: 0 }, facing: 'east', direction: 'output', type } as const);
const piece = (id: PieceId, label: string, glyph: string, description: string, consequence: string, ports: PieceDefinition['ports']): PieceDefinition => ({ id, conceptId: id, label, glyph, description, consequence, cells: [{ x: 0, y: 0 }], pivot: { x: 0, y: 0 }, ports });
export const PIECES = {
  ingestion: piece('ingestion', 'Ingestion', 'IN', 'Brings source material into the system.', 'Documents enter the pipeline.', [output('documents')]),
  chunking: piece('chunking', 'Chunking', 'CH', 'Segments documents into retrievable units.', 'Documents become addressable chunks.', [input('documents'), output('chunks')]),
  retrieval: piece('retrieval', 'Retrieval', 'RT', 'Selects candidate context.', 'Relevant candidates enter the evidence path.', [input('chunks'), output('candidates')]),
  provenance: piece('provenance', 'Provenance', 'PV', 'Carries source identity with claims.', 'Candidates become attributable evidence.', [input('candidates'), output('grounded-evidence')]),
  evaluation: piece('evaluation', 'Evaluation', 'EV', 'Checks quality against grounded evidence.', 'Supported output can be distinguished.', [input('grounded-evidence')]),
} as const satisfies Record<PieceId, PieceDefinition>;
export const CONCEPTS = {
  ingestion: { id: 'ingestion', label: 'Ingestion', summary: 'Acquire source material.' }, chunking: { id: 'chunking', label: 'Chunking', summary: 'Create retrievable units.' }, retrieval: { id: 'retrieval', label: 'Retrieval', summary: 'Select useful context.' }, provenance: { id: 'provenance', label: 'Provenance', summary: 'Preserve attribution.' }, evaluation: { id: 'evaluation', label: 'Evaluation', summary: 'Measure grounded output.' }, 'document-source': { id: 'document-source', label: 'Document / Source', summary: 'A continuation toward memoRABLE.' },
} as const satisfies Record<ConceptId, ConceptContent>;
export const INTELLIRAG_RECIPE: RecipeDefinition = { id: 'intellirag-pipeline', projectId: 'intellirag', requiredPath: ['ingestion', 'chunking', 'retrieval', 'provenance', 'evaluation'], forbiddenShortcuts: [['retrieval', 'evaluation'], ['chunking', 'provenance']], principleId: 'attributable-failure' };
export const INTELLIRAG_PROJECT: ProjectContent = { id: 'intellirag', title: 'IntelliRAG', question: 'How can retrieval remain useful and explainable?', stakes: 'Answers without traceable evidence are difficult to trust or improve.', systemLoop: 'Ingest → chunk → retrieve → preserve provenance → evaluate.', evidence: 'The prototype demonstrates the architecture through a deterministic typed graph.', caveat: 'The hero uses an authored mock pipeline; it does not claim production benchmark results.', judgment: 'Provenance is load-bearing infrastructure, not documentation added afterward.', actions: [{ label: 'View GitHub', href: 'https://github.com/charan-rathore/IntelliRAG' }] };
export const AUTHORED_QUEUE = ['ingestion', 'chunking', 'retrieval', 'provenance', 'evaluation'] as const satisfies readonly PieceId[];
export const AUTHORED_SEED = 'intellirag-phase1-v1';
export const SPAWN = { x: 4, y: 0, rotation: 0 } as const;
