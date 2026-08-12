import * as THREE from 'three';
import { FrameScheduler } from './scheduler';
import { ResourceRegistry } from './resource-registry';
import type { GhostState, PieceSnapshot, SemanticRole, WorldRuntimeOptions, WorldSnapshot } from './types';

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 16;
const CELL = 0.72;
const HALF_W = BOARD_WIDTH * CELL * 0.5;
const HALF_H = BOARD_HEIGHT * CELL * 0.5;
const MAX_CONNECTIONS = 24;

const PALETTE: Record<SemanticRole, number> = {
  ingestion: 0x00ff88,
  chunking: 0xffb800,
  retrieval: 0x4c7bf4,
  provenance: 0xf06292,
  evaluation: 0x26a69a,
};

export type CameraState = 'bootWide' | 'boardPlay' | 'placementConfirm' | 'systemResolve' | 'projectInspect' | 'directStatic';

const CAMERA_POSES: Record<CameraState, { position: THREE.Vector3; target: THREE.Vector3 }> = {
  bootWide: { position: new THREE.Vector3(0.8, 0.7, 16.2), target: new THREE.Vector3(0, -0.2, 0) },
  boardPlay: { position: new THREE.Vector3(0.3, 0.1, 14.7), target: new THREE.Vector3(0, -0.25, 0) },
  placementConfirm: { position: new THREE.Vector3(0.1, -0.3, 13.8), target: new THREE.Vector3(0, -1.2, 0) },
  systemResolve: { position: new THREE.Vector3(0.4, -0.7, 13.2), target: new THREE.Vector3(0, -1.5, 0) },
  projectInspect: { position: new THREE.Vector3(1.8, -1.1, 12.5), target: new THREE.Vector3(0, -1.6, 0) },
  directStatic: { position: new THREE.Vector3(0, 0, 15.1), target: new THREE.Vector3(0, 0, 0) },
};

interface PieceView {
  group: THREE.Group;
  role: SemanticRole;
}

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
  private readonly registry = new ResourceRegistry();
  private readonly scheduler: FrameScheduler;
  private readonly pieceViews = new Map<string, PieceView>();
  private readonly connectionLines: THREE.Line[] = [];
  private readonly resizeObserver: ResizeObserver;
  private snapshot?: WorldSnapshot;
  private disposed = false;
  private hidden = document.hidden;
  private offscreen = false;
  private animationUntil = 0;
  private cameraState: CameraState = 'bootWide';
  private cameraFrom = new THREE.Vector3();
  private cameraTargetFrom = new THREE.Vector3();
  private cameraTarget = new THREE.Vector3();
  private cameraTransitionStart = 0;
  private cameraTransitionDuration = 0;
  private readonly quality: 'high' | 'low';

  constructor(host: HTMLElement, options: WorldRuntimeOptions = {}) {
    this.host = host;
    this.options = options;
    this.quality = options.quality === 'low' || (options.quality !== 'high' && matchMedia('(max-width: 700px)').matches) ? 'low' : 'high';
    this.renderer = new THREE.WebGLRenderer({ antialias: this.quality === 'high', alpha: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setClearColor(0x0a0a0c, 0);
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    this.renderer.domElement.tabIndex = -1;
    host.append(this.renderer.domElement);

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
    if (this.disposed || snapshot.revision === this.snapshot?.revision) return;
    this.snapshot = snapshot;
    this.reconcilePieces(snapshot);
    this.reconcileGhost(snapshot.ghost);
    this.reconcileConnections(snapshot);
    this.reconcileProjectCore(snapshot);
    if (snapshot.settlingPieceId && !this.options.reducedMotion) this.pulsePlacement(snapshot.settlingPieceId);
    if (snapshot.mode === 'resolved') this.setCameraState('systemResolve');
    else if (snapshot.mode === 'provenance-failure') this.setCameraState('projectInspect');
    else if (snapshot.mode === 'static') this.setCameraState('directStatic');
    else this.setCameraState('boardPlay');
    this.invalidate();
  }

  setCameraState(state: CameraState): void {
    const pose = CAMERA_POSES[state];
    if (state === this.cameraState && this.cameraTransitionDuration > 0) return;
    this.cameraState = state;
    this.cameraFrom.copy(this.camera.position);
    this.cameraTargetFrom.copy(this.cameraTarget);
    this.cameraTransitionStart = performance.now();
    this.cameraTransitionDuration = this.options.reducedMotion ? 0 : state === 'systemResolve' ? 900 : 520;
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

  setStaticMode(enabled: boolean): void {
    if (enabled) this.setCameraState('directStatic');
    this.worldRoot.visible = !enabled;
    this.invalidate();
  }

  invalidate(): void {
    if (!this.hidden && !this.offscreen && !this.disposed) this.scheduler.invalidate();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.scheduler.dispose();
    this.resizeObserver.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.onContextRestored);
    this.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        Object.values(material).forEach((value) => { if (value instanceof THREE.Texture) value.dispose(); });
        material.dispose();
      });
    });
    this.registry.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }

  private buildScene(): void {
    this.scene.add(this.worldRoot);
    this.worldRoot.add(this.boardView, this.piecePool, this.ghostView, this.connectionPool, this.projectCoreView, this.effectsView);
    this.buildBoard();
    this.buildLighting();
    this.buildConnectionPool();
    this.scene.fog = new THREE.FogExp2(0x0a0a0c, 0.026);
  }

  private buildBoard(): void {
    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(BOARD_WIDTH * CELL + 0.15, BOARD_HEIGHT * CELL + 0.15),
      new THREE.MeshStandardMaterial({ color: 0x0c0c10, roughness: 0.92, metalness: 0.1 }),
    );
    back.position.z = -0.18;
    this.boardView.add(back);

    const vertices: number[] = [];
    for (let x = 0; x <= BOARD_WIDTH; x += 1) vertices.push(x * CELL - HALF_W, -HALF_H, -0.1, x * CELL - HALF_W, HALF_H, -0.1);
    for (let y = 0; y <= BOARD_HEIGHT; y += 1) vertices.push(-HALF_W, y * CELL - HALF_H, -0.1, HALF_W, y * CELL - HALF_H, -0.1);
    const gridGeometry = new THREE.BufferGeometry();
    gridGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    this.boardView.add(new THREE.LineSegments(gridGeometry, new THREE.LineBasicMaterial({ color: 0x252530, transparent: true, opacity: 0.42 })));

    const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(BOARD_WIDTH * CELL + 0.22, BOARD_HEIGHT * CELL + 0.22, 0.35)), new THREE.LineBasicMaterial({ color: 0x454553, transparent: true, opacity: 0.8 }));
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
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3));
      const line = new THREE.Line(geometry, new THREE.LineDashedMaterial({ color: 0x00ff88, transparent: true, opacity: 0.68, dashSize: 0.13, gapSize: 0.07 }));
      line.visible = false;
      this.connectionLines.push(line);
      this.connectionPool.add(line);
    }
  }

  private reconcilePieces(snapshot: WorldSnapshot): void {
    const nextIds = new Set(snapshot.pieces.map(({ id }) => id));
    this.pieceViews.forEach((view, id) => {
      if (nextIds.has(id)) return;
      this.piecePool.remove(view.group);
      this.disposeObject(view.group);
      this.pieceViews.delete(id);
    });
    snapshot.pieces.forEach((piece) => {
      let view = this.pieceViews.get(piece.id);
      if (!view || view.role !== piece.role) {
        if (view) { this.piecePool.remove(view.group); this.disposeObject(view.group); }
        view = { group: this.createPiece(piece), role: piece.role };
        this.pieceViews.set(piece.id, view);
        this.piecePool.add(view.group);
      }
      this.positionPiece(view.group, piece);
      view.group.visible = !(snapshot.mode === 'provenance-failure' && piece.role === 'provenance');
    });
  }

  private reconcileGhost(ghost: (PieceSnapshot & { readonly state: GhostState }) | undefined): void {
    this.disposeChildren(this.ghostView);
    if (!ghost) return;
    const group = this.createPiece(ghost, true, ghost.state);
    this.positionPiece(group, ghost);
    this.ghostView.add(group);
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
      const material = line.material as THREE.LineDashedMaterial;
      material.color.setHex(connection.broken ? 0xe53935 : PALETTE[connection.toRole]);
      material.opacity = connection.broken ? 0.38 : 0.72;
      line.computeLineDistances();
    });
  }

  private reconcileProjectCore(snapshot: WorldSnapshot): void {
    this.disposeChildren(this.projectCoreView);
    if (snapshot.mode !== 'resolved' && snapshot.mode !== 'provenance-failure') return;
    const roles: SemanticRole[] = ['ingestion', 'chunking', 'retrieval', 'provenance', 'evaluation'];
    const core = new THREE.Group();
    core.position.set(0, -0.2, 0.85);
    roles.forEach((role, index) => {
      const missing = snapshot.mode === 'provenance-failure' && role === 'provenance';
      const geometry = new THREE.BoxGeometry(3.8, 0.58, 0.16);
      const material = new THREE.MeshStandardMaterial({
        color: missing ? 0x18181e : 0x111116,
        emissive: missing ? 0x4a0b12 : PALETTE[role],
        emissiveIntensity: missing ? 0.18 : 0.22,
        transparent: true,
        opacity: missing ? 0.48 : 0.96,
        roughness: 0.4,
      });
      const stage = new THREE.Mesh(geometry, material);
      stage.position.y = (2 - index) * 0.72;
      core.add(stage);
      const accent = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.34, 0.2), new THREE.MeshBasicMaterial({ color: missing ? 0xe53935 : PALETTE[role] }));
      accent.position.set(-1.65, stage.position.y, 0.14);
      core.add(accent);
      core.add(this.createLabel(missing ? 'PROVENANCE / WITHHELD' : role.toUpperCase(), missing ? 0xe07a7a : 0xe8e6e1, new THREE.Vector3(0.1, stage.position.y, 0.16), 0.82));
    });
    this.projectCoreView.add(core);
  }

  private createPiece(piece: PieceSnapshot, ghost = false, ghostState: GhostState = 'incomplete'): THREE.Group {
    const group = new THREE.Group();
    const color = PALETTE[piece.role];
    piece.cells.forEach((cell, index) => {
      const geometry = new THREE.BoxGeometry(CELL * 0.91, CELL * 0.91, ghost ? 0.025 : 0.2);
      const invalid = ghostState === 'invalid';
      const material = new THREE.MeshStandardMaterial({
        color: ghost ? 0x101016 : 0x14141a,
        emissive: invalid ? 0xe53935 : color,
        emissiveIntensity: ghost ? 0.12 : 0.26,
        transparent: ghost,
        opacity: ghost ? 0.28 : 0.96,
        roughness: 0.38,
        metalness: 0.42,
        wireframe: ghost && ghostState === 'incomplete',
      });
      const block = new THREE.Mesh(geometry, material);
      block.position.set(cell.x * CELL, -cell.y * CELL, 0);
      group.add(block);

      const circuitMaterial = new THREE.LineBasicMaterial({ color: invalid ? 0xe53935 : color, transparent: true, opacity: ghost ? 0.5 : 0.78 });
      const path = index % 2 === 0
        ? [new THREE.Vector3(-0.2, 0, 0.12), new THREE.Vector3(0, 0, 0.12), new THREE.Vector3(0, 0.2, 0.12)]
        : [new THREE.Vector3(0, -0.2, 0.12), new THREE.Vector3(0, 0, 0.12), new THREE.Vector3(0.2, 0, 0.12)];
      const circuit = new THREE.Line(new THREE.BufferGeometry().setFromPoints(path), circuitMaterial);
      circuit.position.copy(block.position);
      group.add(circuit);
      const node = new THREE.Mesh(new THREE.RingGeometry(0.045, 0.07, 10), new THREE.MeshBasicMaterial({ color: invalid ? 0xe53935 : color, side: THREE.DoubleSide }));
      node.position.copy(block.position).add(new THREE.Vector3(0, 0, 0.13));
      group.add(node);
    });
    group.add(this.createLabel(piece.label, color, new THREE.Vector3(0, 0.62, 0.2), 0.72));
    return group;
  }

  private createLabel(text: string, color: number, position: THREE.Vector3, scale = 1): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 96;
    const context = canvas.getContext('2d');
    if (context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.font = '500 28px ui-monospace, monospace';
      context.letterSpacing = '4px';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
      context.fillText(text, 256, 48);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
    sprite.position.copy(position);
    sprite.scale.set(3.4 * scale, 0.64 * scale, 1);
    return sprite;
  }

  private positionPiece(group: THREE.Group, piece: PieceSnapshot): void {
    const position = this.cellCenter(piece.position.x, piece.position.y, 0.12);
    group.position.set(position.x, position.y, position.z);
  }

  private pulsePlacement(pieceId: string): void {
    const view = this.pieceViews.get(pieceId);
    if (!view) return;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.24, 0.3, 32), new THREE.MeshBasicMaterial({ color: PALETTE[view.role], transparent: true, opacity: 0.68, side: THREE.DoubleSide }));
    ring.position.copy(view.group.position).add(new THREE.Vector3(CELL, -CELL * 0.5, 0.32));
    ring.userData.born = performance.now();
    this.effectsView.add(ring);
    this.animationUntil = performance.now() + 560;
  }

  private render = (time: number): boolean => {
    if (this.hidden || this.offscreen || this.disposed) return false;
    let active = time < this.animationUntil;
    const pose = CAMERA_POSES[this.cameraState];
    if (this.cameraTransitionDuration > 0) {
      const progress = Math.min(1, (time - this.cameraTransitionStart) / this.cameraTransitionDuration);
      const eased = 1 - Math.pow(1 - progress, 3);
      this.camera.position.lerpVectors(this.cameraFrom, pose.position, eased);
      this.cameraTarget.lerpVectors(this.cameraTargetFrom, pose.target, eased);
      this.camera.lookAt(this.cameraTarget);
      if (progress >= 1) this.cameraTransitionDuration = 0;
      else active = true;
    }
    this.effectsView.children.slice().forEach((effect) => {
      const age = (time - Number(effect.userData.born)) / 560;
      if (age >= 1) { this.effectsView.remove(effect); this.disposeObject(effect); return; }
      effect.scale.setScalar(1 + age * 4);
      const material = (effect as THREE.Mesh).material as THREE.MeshBasicMaterial;
      material.opacity = (1 - age) * 0.65;
      active = true;
    });
    this.renderer.render(this.scene, this.camera);
    return active;
  };

  private resize = (): void => {
    if (this.disposed) return;
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    const cap = this.quality === 'high' ? 1.75 : 1.25;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
    this.renderer.setSize(width, height, false);
    this.invalidate();
  };

  private onVisibility = (): void => {
    this.hidden = document.hidden;
    if (!this.hidden) this.invalidate();
  };

  private onContextLost = (event: Event): void => {
    event.preventDefault();
    this.options.onFailure?.('WebGL context was lost. Switched to the semantic static view.');
    this.host.dataset.renderFailure = 'true';
  };

  private onContextRestored = (): void => {
    delete this.host.dataset.renderFailure;
    this.invalidate();
  };

  private cellCenter(x: number, y: number, z: number): THREE.Vector3 {
    return new THREE.Vector3(-HALF_W + x * CELL + CELL * 0.5, HALF_H - y * CELL - CELL * 0.5, z);
  }

  private disposeChildren(group: THREE.Group): void {
    group.children.slice().forEach((child) => { group.remove(child); this.disposeObject(child); });
  }

  private disposeObject(object: THREE.Object3D): void {
    object.traverse((child) => {
      if (!(child instanceof THREE.Mesh || child instanceof THREE.Line || child instanceof THREE.Sprite)) return;
      if ('geometry' in child && child.geometry) child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        Object.values(material).forEach((value) => { if (value instanceof THREE.Texture) value.dispose(); });
        material.dispose();
      });
    });
  }
}
