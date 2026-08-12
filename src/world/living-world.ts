import * as THREE from 'three';
import { selectRendererProfile, type RendererProfile } from './renderer-profile';
import { FrameScheduler } from './scheduler';
import type { GhostState, PieceSnapshot, SemanticRole, WorldRuntimeOptions, WorldSnapshot } from './types';

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 16;
const CELL = 0.72;
const HALF_W = BOARD_WIDTH * CELL * 0.5;
const HALF_H = BOARD_HEIGHT * CELL * 0.5;
const MAX_CONNECTIONS = 24;
const MAX_PIECE_CELLS = 4;

const PALETTE: Record<SemanticRole, number> = {
  ingestion: 0x00ff88,
  chunking: 0xffb800,
  retrieval: 0x4c7bf4,
  provenance: 0xf06292,
  evaluation: 0x26a69a,
};

export type CameraState = 'boardPlay' | 'placementConfirm' | 'systemResolve' | 'projectInspect';

const CAMERA_POSES: Record<CameraState, { position: THREE.Vector3; target: THREE.Vector3 }> = {
  boardPlay: { position: new THREE.Vector3(0.3, 0.1, 14.7), target: new THREE.Vector3(0, -0.25, 0) },
  placementConfirm: { position: new THREE.Vector3(0.1, -0.3, 13.8), target: new THREE.Vector3(0, -1.2, 0) },
  systemResolve: { position: new THREE.Vector3(0.4, -0.7, 13.2), target: new THREE.Vector3(0, -1.5, 0) },
  projectInspect: { position: new THREE.Vector3(1.8, -1.1, 12.5), target: new THREE.Vector3(0, -1.6, 0) },
};

interface PieceView {
  readonly group: THREE.Group;
  readonly blocks: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>[];
  readonly circuits: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>[];
  readonly nodes: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>[];
  readonly label: THREE.Sprite;
  role: SemanticRole;
  labelText: string;
}

interface CoreStageView {
  readonly role: SemanticRole;
  readonly stage: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
  readonly accent: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
  readonly normalLabel: THREE.Sprite;
  readonly missingLabel?: THREE.Sprite;
}

/** Imperative projection of immutable game snapshots. It never owns game outcomes. */
export class LivingSystemsWorld {
  private readonly host: HTMLElement;
  private readonly options: WorldRuntimeOptions;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);
  private readonly worldRoot = new THREE.Group();
  private readonly boardView = new THREE.Group();
  private readonly piecePool = new THREE.Group();
  private readonly ghostView = new THREE.Group();
  private readonly connectionPool = new THREE.Group();
  private readonly projectCoreView = new THREE.Group();
  private readonly effectsView = new THREE.Group();
  private readonly scheduler: FrameScheduler;
  private readonly pieceViews = new Map<string, PieceView>();
  private readonly connectionLines: THREE.Line<THREE.BufferGeometry, THREE.LineDashedMaterial>[] = [];
  private readonly coreStages: CoreStageView[] = [];
  private readonly ownedResources = new Set<{ dispose(): void }>();
  private readonly labelMaterials = new Map<string, THREE.SpriteMaterial>();
  private readonly resizeObserver: ResizeObserver;
  private readonly solidCellGeometry: THREE.BoxGeometry;
  private readonly ghostCellGeometry: THREE.BoxGeometry;
  private readonly circuitGeometries: readonly THREE.BufferGeometry[];
  private readonly nodeGeometry: THREE.RingGeometry;
  private readonly pulseGeometry: THREE.RingGeometry;
  private readonly pulseMaterials: Record<SemanticRole, THREE.MeshBasicMaterial>;
  private readonly pulseMesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private ghostPiece?: PieceView;
  private snapshot?: WorldSnapshot;
  private disposed = false;
  private hidden = document.hidden;
  private offscreen = false;
  private animationUntil = 0;
  private cameraState?: CameraState;
  private readonly cameraFrom = new THREE.Vector3();
  private readonly cameraTargetFrom = new THREE.Vector3();
  private readonly cameraTarget = new THREE.Vector3();
  private cameraTransitionStart = 0;
  private cameraTransitionDuration = 0;
  private readonly profile: RendererProfile;
  private contextRecoveryAttempted = false;
  private contextRecoveryTimer = 0;
  private permanentFailure = false;

  constructor(host: HTMLElement, options: WorldRuntimeOptions = {}) {
    this.host = host;
    this.options = options;
    this.profile = selectRendererProfile(options.quality, window.innerWidth, Boolean(options.reducedMotion));
    this.renderer = new THREE.WebGLRenderer({ antialias: this.profile.quality === 'high', alpha: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setClearColor(0x0a0a0c, 0);
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    this.renderer.domElement.tabIndex = -1;
    host.append(this.renderer.domElement);

    this.solidCellGeometry = this.own(new THREE.BoxGeometry(CELL * 0.91, CELL * 0.91, 0.2));
    this.ghostCellGeometry = this.own(new THREE.BoxGeometry(CELL * 0.91, CELL * 0.91, 0.025));
    this.circuitGeometries = [
      this.own(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.2, 0, 0.12), new THREE.Vector3(0, 0, 0.12), new THREE.Vector3(0, 0.2, 0.12)])),
      this.own(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -0.2, 0.12), new THREE.Vector3(0, 0, 0.12), new THREE.Vector3(0.2, 0, 0.12)])),
    ];
    this.nodeGeometry = this.own(new THREE.RingGeometry(0.045, 0.07, 10));
    this.pulseGeometry = this.own(new THREE.RingGeometry(0.24, 0.3, 32));
    this.pulseMaterials = Object.fromEntries(Object.entries(PALETTE).map(([role, color]) => [role, this.own(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.68, side: THREE.DoubleSide }))])) as Record<SemanticRole, THREE.MeshBasicMaterial>;
    this.pulseMesh = new THREE.Mesh(this.pulseGeometry, this.pulseMaterials.ingestion);
    this.pulseMesh.visible = false;
    this.effectsView.add(this.pulseMesh);

    this.scheduler = new FrameScheduler({ render: this.render });
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(host);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.onContextRestored);

    this.buildScene();
    this.resize();
    this.setCameraState('boardPlay');
  }

  update(snapshot: WorldSnapshot): void {
    if (this.disposed || this.permanentFailure || snapshot.revision === this.snapshot?.revision) return;
    this.snapshot = snapshot;
    this.reconcilePieces(snapshot);
    this.reconcileGhost(snapshot.ghost);
    this.reconcileConnections(snapshot);
    this.reconcileProjectCore(snapshot);
    if (snapshot.settlingPieceId && !this.options.reducedMotion) this.pulsePlacement(snapshot.settlingPieceId);
    if (snapshot.mode === 'resolved') this.setCameraState('systemResolve');
    else if (snapshot.mode === 'provenance-failure') this.setCameraState('projectInspect');
    else this.setCameraState('boardPlay');
    this.invalidate();
  }

  setCameraState(state: CameraState): void {
    if (state === this.cameraState) return;
    const pose = this.cameraPose(state);
    this.cameraState = state;
    this.cameraFrom.copy(this.camera.position);
    this.cameraTargetFrom.copy(this.cameraTarget);
    this.cameraTransitionStart = performance.now();
    this.cameraTransitionDuration = this.profile.animateTransitions ? state === 'systemResolve' ? 900 : 520 : 0;
    if (!this.cameraTransitionDuration) {
      this.camera.position.copy(pose.position);
      this.cameraTarget.copy(pose.target);
      this.camera.lookAt(this.cameraTarget);
    }
    this.animationUntil = Math.max(this.animationUntil, this.cameraTransitionStart + this.cameraTransitionDuration);
    this.invalidate();
  }

  setOffscreen(offscreen: boolean): void {
    this.offscreen = offscreen;
    if (!offscreen) this.invalidate();
  }

  invalidate(): void {
    if (!this.hidden && !this.offscreen && !this.disposed && !this.permanentFailure) this.scheduler.invalidate();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.scheduler.dispose();
    this.resizeObserver.disconnect();
    window.clearTimeout(this.contextRecoveryTimer);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.onContextRestored);
    this.ownedResources.forEach((resource) => resource.dispose());
    this.ownedResources.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }

  private own<T extends { dispose(): void }>(resource: T): T {
    this.ownedResources.add(resource);
    return resource;
  }

  private buildScene(): void {
    this.scene.add(this.worldRoot);
    this.worldRoot.add(this.boardView, this.piecePool, this.ghostView, this.connectionPool, this.projectCoreView, this.effectsView);
    this.buildBoard();
    this.buildLighting();
    this.buildConnectionPool();
    this.buildProjectCore();
    this.scene.fog = new THREE.FogExp2(0x0a0a0c, 0.026);
  }

  private buildBoard(): void {
    const back = new THREE.Mesh(
      this.own(new THREE.PlaneGeometry(BOARD_WIDTH * CELL + 0.15, BOARD_HEIGHT * CELL + 0.15)),
      this.own(new THREE.MeshStandardMaterial({ color: 0x0c0c10, roughness: 0.92, metalness: 0.1 })),
    );
    back.position.z = -0.18;
    this.boardView.add(back);

    const vertices: number[] = [];
    for (let x = 0; x <= BOARD_WIDTH; x += 1) vertices.push(x * CELL - HALF_W, -HALF_H, -0.1, x * CELL - HALF_W, HALF_H, -0.1);
    for (let y = 0; y <= BOARD_HEIGHT; y += 1) vertices.push(-HALF_W, y * CELL - HALF_H, -0.1, HALF_W, y * CELL - HALF_H, -0.1);
    const gridGeometry = this.own(new THREE.BufferGeometry());
    gridGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    this.boardView.add(new THREE.LineSegments(gridGeometry, this.own(new THREE.LineBasicMaterial({ color: 0x252530, transparent: true, opacity: 0.42 }))));

    const frameBox = this.own(new THREE.BoxGeometry(BOARD_WIDTH * CELL + 0.22, BOARD_HEIGHT * CELL + 0.22, 0.35));
    const frame = new THREE.LineSegments(this.own(new THREE.EdgesGeometry(frameBox)), this.own(new THREE.LineBasicMaterial({ color: 0x454553, transparent: true, opacity: 0.8 })));
    frame.position.z = -0.03;
    this.boardView.add(frame);
  }

  private buildLighting(): void {
    this.scene.add(new THREE.HemisphereLight(0xcbd6ff, 0x101014, 1.35));
    const key = new THREE.DirectionalLight(0xffe0bd, 2.6);
    key.position.set(-5, 8, 10);
    this.scene.add(key);
    const rim = new THREE.PointLight(0x4c7bf4, 18, 24, 2);
    rim.position.set(6, -2, 7);
    this.scene.add(rim);
  }

  private buildConnectionPool(): void {
    for (let index = 0; index < MAX_CONNECTIONS; index += 1) {
      const geometry = this.own(new THREE.BufferGeometry());
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3));
      const line = new THREE.Line(geometry, this.own(new THREE.LineDashedMaterial({ color: 0x00ff88, transparent: true, opacity: 0.68, dashSize: 0.13, gapSize: 0.07 })));
      line.visible = false;
      this.connectionLines.push(line);
      this.connectionPool.add(line);
    }
  }

  private buildProjectCore(): void {
    const core = new THREE.Group();
    core.position.set(0, -0.2, 0.85);
    const stageGeometry = this.own(new THREE.BoxGeometry(3.8, 0.58, 0.16));
    const accentGeometry = this.own(new THREE.BoxGeometry(0.08, 0.34, 0.2));
    (Object.keys(PALETTE) as SemanticRole[]).forEach((role, index) => {
      const stage = new THREE.Mesh(stageGeometry, this.own(new THREE.MeshStandardMaterial({ color: 0x111116, emissive: PALETTE[role], emissiveIntensity: 0.22, transparent: true, opacity: 0.96, roughness: 0.4 })));
      stage.position.y = (2 - index) * 0.72;
      const accent = new THREE.Mesh(accentGeometry, this.own(new THREE.MeshBasicMaterial({ color: PALETTE[role] })));
      accent.position.set(-1.65, stage.position.y, 0.14);
      const normalLabel = this.createLabel(role.toUpperCase(), 0xe8e6e1, new THREE.Vector3(0.1, stage.position.y, 0.16), 0.82);
      const missingLabel = role === 'provenance' ? this.createLabel('PROVENANCE / WITHHELD', 0xe07a7a, normalLabel.position, 0.82) : undefined;
      if (missingLabel) missingLabel.visible = false;
      core.add(stage, accent, normalLabel);
      if (missingLabel) core.add(missingLabel);
      this.coreStages.push({ role, stage, accent, normalLabel, missingLabel });
    });
    this.projectCoreView.add(core);
    this.projectCoreView.visible = false;
  }

  private reconcilePieces(snapshot: WorldSnapshot): void {
    const nextIds = new Set(snapshot.pieces.map(({ id }) => id));
    this.pieceViews.forEach((view, id) => {
      if (nextIds.has(id)) return;
      this.piecePool.remove(view.group);
      this.pieceViews.delete(id);
    });
    snapshot.pieces.forEach((piece) => {
      let view = this.pieceViews.get(piece.id);
      if (!view || view.role !== piece.role || view.labelText !== piece.label) {
        if (view) this.piecePool.remove(view.group);
        view = this.createPieceView(piece, false);
        this.pieceViews.set(piece.id, view);
        this.piecePool.add(view.group);
      }
      this.updatePieceView(view, piece);
      view.group.visible = !(snapshot.mode === 'provenance-failure' && piece.role === 'provenance');
    });
  }

  private reconcileGhost(ghost: (PieceSnapshot & { readonly state: GhostState }) | undefined): void {
    if (!ghost) {
      if (this.ghostPiece) this.ghostPiece.group.visible = false;
      return;
    }
    if (!this.ghostPiece || this.ghostPiece.role !== ghost.role || this.ghostPiece.labelText !== ghost.label) {
      if (this.ghostPiece) this.ghostView.remove(this.ghostPiece.group);
      this.ghostPiece = this.createPieceView(ghost, true);
      this.ghostView.add(this.ghostPiece.group);
    }
    this.ghostPiece.group.visible = true;
    this.updatePieceView(this.ghostPiece, ghost, ghost.state);
  }

  private reconcileConnections(snapshot: WorldSnapshot): void {
    this.connectionLines.forEach((line, index) => {
      const connection = snapshot.connections[index];
      line.visible = Boolean(connection);
      if (!connection) return;
      const positions = line.geometry.getAttribute('position') as THREE.BufferAttribute;
      const from = this.cellCenter(connection.from.x, connection.from.y, 0.16);
      const to = this.cellCenter(connection.to.x, connection.to.y, 0.16);
      positions.setXYZ(0, from.x, from.y, from.z);
      positions.setXYZ(1, to.x, to.y, to.z);
      positions.needsUpdate = true;
      line.material.color.setHex(connection.broken ? 0xe53935 : PALETTE[connection.toRole]);
      line.material.opacity = connection.broken ? 0.38 : 0.72;
      line.computeLineDistances();
    });
  }

  private reconcileProjectCore(snapshot: WorldSnapshot): void {
    const visible = snapshot.mode === 'resolved' || snapshot.mode === 'provenance-failure';
    this.projectCoreView.visible = visible;
    if (!visible) return;
    this.coreStages.forEach(({ role, stage, accent, normalLabel, missingLabel }) => {
      const missing = snapshot.mode === 'provenance-failure' && role === 'provenance';
      stage.material.color.setHex(missing ? 0x18181e : 0x111116);
      stage.material.emissive.setHex(missing ? 0x4a0b12 : PALETTE[role]);
      stage.material.emissiveIntensity = missing ? 0.18 : 0.22;
      stage.material.opacity = missing ? 0.48 : 0.96;
      accent.material.color.setHex(missing ? 0xe53935 : PALETTE[role]);
      normalLabel.visible = !missing;
      if (missingLabel) missingLabel.visible = missing;
    });
  }

  private createPieceView(piece: PieceSnapshot, ghost: boolean): PieceView {
    const group = new THREE.Group();
    const blocks: PieceView['blocks'] = [];
    const circuits: PieceView['circuits'] = [];
    const nodes: PieceView['nodes'] = [];
    for (let index = 0; index < MAX_PIECE_CELLS; index += 1) {
      const block = new THREE.Mesh(ghost ? this.ghostCellGeometry : this.solidCellGeometry, this.own(new THREE.MeshStandardMaterial({ transparent: ghost, roughness: 0.38, metalness: 0.42 })));
      const circuit = new THREE.Line(this.circuitGeometries[index % 2]!, this.own(new THREE.LineBasicMaterial({ transparent: true })));
      const node = new THREE.Mesh(this.nodeGeometry, this.own(new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })));
      blocks.push(block);
      circuits.push(circuit);
      nodes.push(node);
      group.add(block, circuit, node);
    }
    const label = this.createLabel(piece.label, PALETTE[piece.role], new THREE.Vector3(0, 0.62, 0.2), 0.72);
    group.add(label);
    return { group, blocks, circuits, nodes, label, role: piece.role, labelText: piece.label };
  }

  private updatePieceView(view: PieceView, piece: PieceSnapshot, ghostState?: GhostState): void {
    const ghost = ghostState !== undefined;
    const invalid = ghostState === 'invalid';
    const color = invalid ? 0xe53935 : PALETTE[piece.role];
    for (let index = 0; index < MAX_PIECE_CELLS; index += 1) {
      const cell = piece.cells[index];
      const block = view.blocks[index]!;
      const circuit = view.circuits[index]!;
      const node = view.nodes[index]!;
      const visible = Boolean(cell);
      block.visible = visible;
      circuit.visible = node.visible = visible && (this.profile.showCircuitDetails || ghost);
      if (!cell) continue;
      block.position.set(cell.x * CELL, -cell.y * CELL, 0);
      circuit.position.copy(block.position);
      node.position.copy(block.position).add(new THREE.Vector3(0, 0, 0.13));
      block.material.color.setHex(ghost ? 0x101016 : 0x14141a);
      block.material.emissive.setHex(color);
      block.material.emissiveIntensity = ghost ? 0.12 : 0.26;
      block.material.opacity = ghost ? 0.28 : 0.96;
      block.material.wireframe = ghostState === 'incomplete';
      circuit.material.color.setHex(color);
      circuit.material.opacity = ghost ? 0.5 : 0.78;
      node.material.color.setHex(color);
    }
    this.positionPiece(view.group, piece);
  }

  private createLabel(text: string, color: number, position: THREE.Vector3, scale = 1): THREE.Sprite {
    const key = `${text}:${color}`;
    let material = this.labelMaterials.get(key);
    if (!material) {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 96;
      const context = canvas.getContext('2d');
      if (context) {
        context.font = '500 28px ui-monospace, monospace';
        context.letterSpacing = '4px';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
        context.fillText(text, 256, 48);
      }
      const texture = this.own(new THREE.CanvasTexture(canvas));
      texture.colorSpace = THREE.SRGBColorSpace;
      material = this.own(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
      this.labelMaterials.set(key, material);
    }
    const sprite = new THREE.Sprite(material);
    sprite.position.copy(position);
    sprite.scale.set(3.4 * scale, 0.64 * scale, 1);
    return sprite;
  }

  private positionPiece(group: THREE.Group, piece: PieceSnapshot): void {
    const position = this.cellCenter(piece.position.x, piece.position.y, 0.12);
    group.position.copy(position);
  }

  private pulsePlacement(pieceId: string): void {
    const view = this.pieceViews.get(pieceId);
    if (!view) return;
    if (this.profile.quality === 'low') return;
    this.pulseMesh.material = this.pulseMaterials[view.role];
    this.pulseMesh.material.opacity = 0.68;
    this.pulseMesh.position.copy(view.group.position).add(new THREE.Vector3(CELL, -CELL * 0.5, 0.32));
    this.pulseMesh.scale.setScalar(1);
    this.pulseMesh.visible = true;
    this.pulseMesh.userData.born = performance.now();
    this.animationUntil = performance.now() + 560;
  }

  private render = (time: number): boolean => {
    if (this.hidden || this.offscreen || this.disposed || this.permanentFailure) return false;
    let active = time < this.animationUntil;
    const pose = this.cameraState ? this.cameraPose(this.cameraState) : undefined;
    if (pose && this.cameraTransitionDuration > 0) {
      const progress = Math.min(1, (time - this.cameraTransitionStart) / this.cameraTransitionDuration);
      const eased = 1 - Math.pow(1 - progress, 3);
      this.camera.position.lerpVectors(this.cameraFrom, pose.position, eased);
      this.cameraTarget.lerpVectors(this.cameraTargetFrom, pose.target, eased);
      this.camera.lookAt(this.cameraTarget);
      if (progress >= 1) this.cameraTransitionDuration = 0;
      else active = true;
    }
    if (this.pulseMesh.visible) {
      const age = (time - Number(this.pulseMesh.userData.born)) / 560;
      if (age >= 1) this.pulseMesh.visible = false;
      else {
        this.pulseMesh.scale.setScalar(1 + age * 4);
        this.pulseMesh.material.opacity = (1 - age) * 0.65;
        active = true;
      }
    }
    this.renderer.render(this.scene, this.camera);
    return active;
  };

  private cameraPose(state: CameraState): { position: THREE.Vector3; target: THREE.Vector3 } {
    const pose = CAMERA_POSES[state];
    if (this.profile.quality === 'high') return pose;
    return {
      position: new THREE.Vector3(pose.position.x * 0.45, pose.position.y * 0.6, pose.position.z * 0.86),
      target: pose.target,
    };
  }

  private resize = (): void => {
    if (this.disposed || this.permanentFailure) return;
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.profile.dprCap));
    this.renderer.setSize(width, height, false);
    this.invalidate();
  };

  private onVisibility = (): void => {
    this.hidden = document.hidden;
    if (!this.hidden) this.invalidate();
  };

  private onContextLost = (event: Event): void => {
    event.preventDefault();
    if (this.contextRecoveryAttempted) {
      this.failPermanently('WebGL context was lost again. Switched to the semantic static view.');
      return;
    }
    this.contextRecoveryAttempted = true;
    this.host.dataset.renderFailure = 'recovering';
    this.contextRecoveryTimer = window.setTimeout(() => {
      this.failPermanently('WebGL context could not be restored. Switched to the semantic static view.');
    }, 2000);
  };

  private onContextRestored = (): void => {
    if (this.permanentFailure || !this.contextRecoveryAttempted) return;
    window.clearTimeout(this.contextRecoveryTimer);
    try {
      this.renderer.resetState();
      this.resize();
      this.renderer.render(this.scene, this.camera);
      delete this.host.dataset.renderFailure;
      this.invalidate();
    } catch {
      this.failPermanently('WebGL resources could not be rebuilt. Switched to the semantic static view.');
    }
  };

  private failPermanently(reason: string): void {
    if (this.permanentFailure) return;
    this.permanentFailure = true;
    window.clearTimeout(this.contextRecoveryTimer);
    this.scheduler.dispose();
    this.host.dataset.renderFailure = 'true';
    this.options.onFailure?.(reason);
  }

  private cellCenter(x: number, y: number, z: number): THREE.Vector3 {
    return new THREE.Vector3(-HALF_W + x * CELL + CELL * 0.5, HALF_H - y * CELL - CELL * 0.5, z);
  }
}
