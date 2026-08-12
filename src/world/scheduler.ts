export interface FrameSchedulerOptions {
  readonly render: (time: number) => boolean;
  readonly requestFrame?: (callback: FrameRequestCallback) => number;
  readonly cancelFrame?: (handle: number) => void;
}

/** Demand-driven RAF loop. render() returns true only while bounded motion remains. */
export class FrameScheduler {
  private frame = 0;
  private disposed = false;
  private dirty = false;
  private readonly render: (time: number) => boolean;
  private readonly requestFrame: (callback: FrameRequestCallback) => number;
  private readonly cancelFrame: (handle: number) => void;

  constructor(options: FrameSchedulerOptions) {
    this.render = options.render;
    this.requestFrame = options.requestFrame ?? requestAnimationFrame;
    this.cancelFrame = options.cancelFrame ?? cancelAnimationFrame;
  }

  invalidate(): void {
    if (this.disposed) return;
    this.dirty = true;
    if (!this.frame) this.frame = this.requestFrame(this.tick);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.dirty = false;
    if (this.frame) this.cancelFrame(this.frame);
    this.frame = 0;
  }

  get isScheduled(): boolean {
    return this.frame !== 0;
  }

  private readonly tick = (time: number): void => {
    this.frame = 0;
    if (this.disposed) return;
    const shouldRender = this.dirty;
    this.dirty = false;
    const continues = shouldRender ? this.render(time) : false;
    if (continues) this.invalidate();
  };
}
