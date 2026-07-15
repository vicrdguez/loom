import type { BoardItem, ModelChoice, Role, WorkerActivity, WorkerRun } from "./types.ts";

export type LaneState =
  | "stopped"
  | "idle"
  | "running"
  | "cooldown"
  | "retry-backoff"
  | "awaiting-requeue"
  | "paused"
  | "degraded";

export interface LaneSnapshot {
  role: Role;
  state: LaneState;
  current?: BoardItem;
  model: ModelChoice;
  startedAt?: number;
  retries: number;
  lastOutcome?: string;
  nextPoll?: number;
}

interface BoardReader {
  next(role: Role): Promise<BoardItem | undefined>;
  observe(item: BoardItem): Promise<BoardItem | undefined>;
}

interface WorkerStarter {
  start(role: Role, item: BoardItem, model: ModelChoice, onActivity: (activity: WorkerActivity) => void): Promise<WorkerRun>;
}

interface LaneOptions {
  role: Role;
  board: BoardReader;
  worker: WorkerStarter;
  model: ModelChoice;
  schedule?: (run: () => void, delay: number) => { cancel(): void };
  now?: () => number;
  onActivity?: (activity: WorkerActivity) => void;
  onChange?: (snapshot: LaneSnapshot) => void;
  releaseLock?: () => Promise<void>;
}

export class RoleLane {
  private readonly options: LaneOptions;
  private readonly now: () => number;
  private readonly schedule: NonNullable<LaneOptions["schedule"]>;
  private state: LaneState = "stopped";
  private timer?: { cancel(): void };
  private nextPoll?: number;
  private startedAt?: number;
  private retries = 0;
  private current?: BoardItem;
  private lastOutcome?: string;

  constructor(options: LaneOptions) {
    this.options = options;
    this.now = options.now ?? Date.now;
    this.schedule = options.schedule ?? ((run, delay) => {
      const timer = setTimeout(run, delay);
      return { cancel: () => clearTimeout(timer) };
    });
  }

  start(): void {
    if (this.state !== "stopped") return;
    this.state = "idle";
    this.startedAt = this.now();
    this.setTimer(0, () => this.poll());
    this.changed();
  }

  snapshot(): LaneSnapshot {
    return {
      role: this.options.role,
      state: this.state,
      current: this.current,
      model: this.options.model,
      startedAt: this.startedAt,
      retries: this.retries,
      lastOutcome: this.lastOutcome,
      nextPoll: this.nextPoll,
    };
  }

  private async poll(): Promise<void> {
    if (this.state !== "idle") return;
    try {
      const item = await this.options.board.next(this.options.role);
      if (!item) {
        this.lastOutcome = "No eligible work";
        this.setTimer(60_000, () => this.poll());
      }
    } catch (error) {
      this.state = "degraded";
      this.lastOutcome = error instanceof Error ? error.message : String(error);
      this.setTimer(60_000, () => this.poll());
    }
    this.changed();
  }

  private setTimer(delay: number, action: () => Promise<void> | void) {
    this.timer?.cancel();
    this.nextPoll = this.now() + delay;
    this.timer = this.schedule(() => { void action(); }, delay);
  }

  private changed() {
    this.options.onChange?.(this.snapshot());
  }
}
