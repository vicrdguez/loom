import type { BoardItem, ModelChoice, Role, WorkerActivity, WorkerOutcome, WorkerRun } from "./types.ts";

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

const POLL_MS = 60_000;
const COOLDOWN_MS = 5_000;
const BACKOFF_MS = [5_000, 30_000];

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
  private active?: WorkerRun;
  private observedClaim = false;
  private orphanedClaim = false;

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
    this.setTimer(0, () => this.pollForWork());
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

  private async pollForWork(): Promise<void> {
    if (this.state === "stopped" || this.state === "paused" || this.active) return;
    this.state = "idle";
    try {
      const item = await this.options.board.next(this.options.role);
      if (item) {
        await this.launch(item);
        return;
      }
      this.lastOutcome = "No eligible work";
      this.setTimer(POLL_MS, () => this.pollForWork());
    } catch (error) {
      this.degrade(error, () => this.pollForWork());
    }
    this.changed();
  }

  private async launch(item: BoardItem): Promise<void> {
    this.clearTimer();
    this.current = item;
    this.observedClaim ||= item.claimed;
    this.state = "running";
    this.lastOutcome = "Worker started";
    this.changed();
    try {
      const run = await this.options.worker.start(
        this.options.role,
        item,
        this.options.model,
        (activity) => this.options.onActivity?.(activity),
      );
      if (this.state === "stopped") {
        await run.abort();
        run.dispose();
        return;
      }
      this.active = run;
      this.setTimer(POLL_MS, () => this.observeRunning(run));
      void run.settled.then((outcome) => this.settle(run, outcome));
    } catch (error) {
      await this.reconcile({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }

  private async settle(run: WorkerRun, outcome: WorkerOutcome): Promise<void> {
    if (this.active !== run || this.state === "stopped") return;
    this.active = undefined;
    await this.reconcile(outcome);
  }

  private async reconcile(outcome: WorkerOutcome): Promise<void> {
    this.clearTimer();
    this.lastOutcome = outcome.ok ? "Worker settled" : outcome.error ?? "Worker failed";
    const assigned = this.current;
    if (!assigned) return this.resolve();
    try {
      const observed = await this.options.board.observe(assigned);
      if (!observed) {
        if (this.observedClaim || this.orphanedClaim) return this.pauseFor("Observed Claim became orphaned");
        return this.resolve();
      }
      this.current = observed;
      this.observedClaim ||= observed.claimed;
      if (!isEligible(this.options.role, observed)) return this.resolve();
      if (observed.claimed) return this.awaitRequeue();
      this.retries += 1;
      if (this.retries >= 3) return this.pauseFor("Three pre-Claim Worker failures");
      this.state = "retry-backoff";
      this.setTimer(BACKOFF_MS[this.retries - 1], () => this.retryExact());
      this.changed();
    } catch (error) {
      this.degrade(error, () => this.reconcile(outcome));
    }
  }

  private async retryExact(): Promise<void> {
    const assigned = this.current;
    if (!assigned || this.state === "stopped" || this.state === "paused") return;
    try {
      const observed = await this.options.board.observe(assigned);
      if (!observed) return this.observedClaim ? this.pauseFor("Observed Claim became orphaned") : this.resolve();
      this.current = observed;
      this.observedClaim ||= observed.claimed;
      if (!isEligible(this.options.role, observed)) return this.resolve();
      if (observed.claimed) return this.awaitRequeue();
      await this.launch(observed);
    } catch (error) {
      this.degrade(error, () => this.retryExact());
    }
  }

  private async observeRunning(run: WorkerRun): Promise<void> {
    if (this.active !== run || !this.current) return;
    try {
      const observed = await this.options.board.observe(this.current);
      if (!observed) {
        this.orphanedClaim ||= this.observedClaim;
        this.lastOutcome = "Assigned Board object disappeared; waiting for Worker settlement";
      } else {
        this.current = observed;
        this.observedClaim ||= observed.claimed;
        this.lastOutcome = isEligible(this.options.role, observed)
          ? "Worker running"
          : "Board handoff observed; waiting for Worker settlement";
      }
    } catch (error) {
      this.lastOutcome = `Observation failed: ${error instanceof Error ? error.message : String(error)}`;
    }
    if (this.active === run) this.setTimer(POLL_MS, () => this.observeRunning(run));
    this.changed();
  }

  private async observeAwaiting(): Promise<void> {
    const assigned = this.current;
    if (!assigned || this.state !== "awaiting-requeue") return;
    try {
      const observed = await this.options.board.observe(assigned);
      if (!observed) return this.pauseFor("Observed Claim became orphaned");
      this.current = observed;
      if (!isEligible(this.options.role, observed)) return this.resolve();
      if (!observed.claimed) {
        this.observedClaim = false;
        await this.launch(observed);
        return;
      }
      this.setTimer(POLL_MS, () => this.observeAwaiting());
      this.changed();
    } catch (error) {
      this.degrade(error, () => this.observeAwaiting());
    }
  }

  private resolve(): void {
    this.state = "cooldown";
    this.lastOutcome = "Board handoff resolved the assignment";
    this.retries = 0;
    this.observedClaim = false;
    this.orphanedClaim = false;
    this.setTimer(COOLDOWN_MS, () => {
      this.current = undefined;
      return this.pollForWork();
    });
    this.changed();
  }

  private awaitRequeue(): void {
    this.state = "awaiting-requeue";
    this.setTimer(POLL_MS, () => this.observeAwaiting());
    this.changed();
  }

  private pauseFor(reason: string): void {
    this.clearTimer();
    this.state = "paused";
    this.lastOutcome = reason;
    this.changed();
  }

  private degrade(error: unknown, retry: () => Promise<void>): void {
    this.state = "degraded";
    this.lastOutcome = error instanceof Error ? error.message : String(error);
    this.setTimer(POLL_MS, retry);
    this.changed();
  }

  private setTimer(delay: number, action: () => Promise<void> | void) {
    this.timer?.cancel();
    this.nextPoll = this.now() + delay;
    this.timer = this.schedule(() => { void action(); }, delay);
  }

  private clearTimer() {
    this.timer?.cancel();
    this.timer = undefined;
    this.nextPoll = undefined;
  }

  private changed() {
    this.options.onChange?.(this.snapshot());
  }
}

export function isEligible(role: Role, item: BoardItem): boolean {
  if (item.open === false) return false;
  return role === "reviewer"
    ? item.kind === "pr" && item.lifecycle === "review"
    : (item.kind === "issue" && item.lifecycle === "ready") ||
      (item.kind === "pr" && item.lifecycle === "rework");
}
