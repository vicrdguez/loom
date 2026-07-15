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
  start(
    role: Role,
    item: BoardItem,
    model: ModelChoice,
    onActivity: (activity: WorkerActivity) => void,
    signal?: AbortSignal,
  ): Promise<WorkerRun>;
}

export interface LaneOptions {
  role: Role;
  board: BoardReader;
  worker: WorkerStarter;
  model: ModelChoice;
  schedule?: (run: () => void, delay: number) => { cancel(): void };
  now?: () => number;
  onActivity?: (activity: WorkerActivity) => void;
  onChange?: (snapshot: LaneSnapshot) => void;
  releaseLock?: () => Promise<void>;
  cancelTimeoutMs?: number;
}

const POLL_MS = 60_000;
const COOLDOWN_MS = 5_000;
const BACKOFF_MS = [5_000, 30_000];

export class RoleLane {
  private readonly options: LaneOptions;
  private readonly now: () => number;
  private readonly schedule: NonNullable<LaneOptions["schedule"]>;
  private readonly cancelTimeoutMs: number;
  private state: LaneState = "stopped";
  private timer?: { cancel(): void };
  private timerAction?: () => Promise<void> | void;
  private nextPoll?: number;
  private startedAt?: number;
  private retries = 0;
  private current?: BoardItem;
  private lastOutcome?: string;
  private active?: WorkerRun;
  private starting?: AbortController;
  private observedClaim = false;
  private orphanedClaim = false;
  private manualPause = false;
  private pauseReason?: "manual" | "retry" | "blocked";
  private resumeAction?: () => Promise<void> | void;
  private lockReleased = false;
  private generation = 0;

  constructor(options: LaneOptions) {
    this.options = options;
    this.now = options.now ?? Date.now;
    this.schedule = options.schedule ?? ((run, delay) => {
      const timer = setTimeout(run, delay);
      return { cancel: () => clearTimeout(timer) };
    });
    this.cancelTimeoutMs = options.cancelTimeoutMs ?? 5_000;
  }

  start(): void {
    if (this.state !== "stopped") return;
    this.generation++;
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

  pause(): void {
    if (this.state === "stopped" || this.state === "paused") return;
    this.manualPause = true;
    if (this.active || this.state === "running") {
      this.lastOutcome = "Pause requested; waiting for Worker settlement";
      this.changed();
      return;
    }
    this.generation++;
    this.pauseManually(this.timerAction ?? (() => this.pollForWork()));
  }

  resume(): boolean {
    if (this.state !== "paused" || this.pauseReason !== "manual") return false;
    this.manualPause = false;
    this.pauseReason = undefined;
    const action = this.resumeAction ?? (() => this.pollForWork());
    this.resumeAction = undefined;
    this.state = "idle";
    this.setTimer(0, action);
    this.changed();
    return true;
  }

  retry(): boolean {
    if (this.state === "awaiting-requeue" || this.pauseReason !== "retry") return false;
    this.retries = 0;
    this.pauseReason = undefined;
    this.state = "retry-backoff";
    this.setTimer(0, () => this.retryExact());
    this.changed();
    return true;
  }

  async stop(): Promise<void> {
    if (this.state === "stopped" && this.lockReleased) return;
    this.generation++;
    this.state = "stopped";
    this.manualPause = false;
    this.clearTimer();
    this.starting?.abort();
    this.starting = undefined;
    const run = this.active;
    this.active = undefined;
    if (run) {
      try {
        await settleWithin((async () => {
          await run.abort();
          await run.settled;
        })().catch((error) => {
          this.lastOutcome = `Cancellation failed: ${error instanceof Error ? error.message : String(error)}`;
        }), this.cancelTimeoutMs);
      } finally {
        await run.dispose();
      }
    }
    this.current = undefined;
    if (!this.lockReleased) {
      this.lockReleased = true;
      await this.options.releaseLock?.();
    }
    this.changed();
  }

  private async pollForWork(): Promise<void> {
    if (this.state === "stopped" || this.state === "paused" || this.active) return;
    const generation = ++this.generation;
    this.state = "idle";
    try {
      const item = await this.options.board.next(this.options.role);
      if (generation !== this.generation || this.state !== "idle" || this.active) return;
      if (item) {
        await this.launch(item);
        return;
      }
      this.lastOutcome = "No eligible work";
      this.setTimer(POLL_MS, () => this.pollForWork());
    } catch (error) {
      if (generation === this.generation && this.state !== "stopped" && this.state !== "paused") {
        this.degrade(error, () => this.pollForWork());
      }
    }
    this.changed();
  }

  private async launch(item: BoardItem): Promise<void> {
    const generation = ++this.generation;
    this.clearTimer();
    this.current = item;
    this.observedClaim ||= item.claimed;
    this.state = "running";
    this.lastOutcome = "Worker started";
    this.changed();
    const startup = new AbortController();
    this.starting = startup;
    try {
      const run = await this.options.worker.start(
        this.options.role,
        item,
        this.options.model,
        (activity) => this.options.onActivity?.(activity),
        startup.signal,
      );
      if (this.starting === startup) this.starting = undefined;
      if (generation !== this.generation || this.state === "stopped") {
        try {
          await settleWithin(run.abort().catch(() => {}), this.cancelTimeoutMs);
        } finally {
          await run.dispose();
        }
        return;
      }
      this.active = run;
      this.setTimer(POLL_MS, () => this.observeRunning(run));
      void run.settled.then((outcome) => this.settle(run, outcome));
    } catch (error) {
      if (generation === this.generation && this.state !== "stopped") {
        await this.reconcile({ ok: false, error: error instanceof Error ? error.message : String(error) });
      }
    } finally {
      if (this.starting === startup) this.starting = undefined;
    }
  }

  private async settle(run: WorkerRun, outcome: WorkerOutcome): Promise<void> {
    if (this.active !== run || this.state === "stopped") return;
    this.active = undefined;
    await this.reconcile(outcome);
  }

  private async reconcile(outcome: WorkerOutcome): Promise<void> {
    const generation = ++this.generation;
    this.clearTimer();
    this.lastOutcome = outcome.ok ? "Worker settled" : outcome.error ?? "Worker failed";
    const assigned = this.current;
    if (!assigned) return this.resolve();
    try {
      const observed = await this.options.board.observe(assigned);
      if (generation !== this.generation || this.state === "stopped") return;
      if (!observed) {
        if (this.observedClaim || this.orphanedClaim) return this.pauseFor("Observed Claim became orphaned");
        return this.resolve();
      }
      this.current = observed;
      this.observedClaim ||= observed.claimed;
      if (!isEligible(this.options.role, observed)) return this.resolve();
      if (observed.claimed) return this.awaitRequeue();
      this.retries += 1;
      if (this.retries >= 3) return this.pauseFor("Three pre-Claim Worker failures", true);
      if (this.manualPause) return this.pauseManually(() => {
        this.state = "retry-backoff";
        this.setTimer(0, () => this.retryExact());
        this.changed();
      });
      this.state = "retry-backoff";
      this.setTimer(BACKOFF_MS[this.retries - 1], () => this.retryExact());
      this.changed();
    } catch (error) {
      if (generation === this.generation && this.state !== "stopped") {
        this.degrade(error, () => this.reconcile(outcome));
      }
    }
  }

  private async retryExact(): Promise<void> {
    const assigned = this.current;
    if (!assigned || this.state === "stopped" || this.state === "paused") return;
    const generation = ++this.generation;
    try {
      const observed = await this.options.board.observe(assigned);
      if (generation !== this.generation || this.state === "stopped" || this.state === "paused") return;
      if (!observed) return this.observedClaim ? this.pauseFor("Observed Claim became orphaned") : this.resolve();
      this.current = observed;
      this.observedClaim ||= observed.claimed;
      if (!isEligible(this.options.role, observed)) return this.resolve();
      if (observed.claimed) return this.awaitRequeue();
      await this.launch(observed);
    } catch (error) {
      if (generation === this.generation && this.state !== "stopped" && this.state !== "paused") {
        this.degrade(error, () => this.retryExact());
      }
    }
  }

  private async observeRunning(run: WorkerRun): Promise<void> {
    if (this.active !== run || !this.current) return;
    const generation = ++this.generation;
    try {
      const observed = await this.options.board.observe(this.current);
      if (generation !== this.generation || this.active !== run || this.state === "stopped") return;
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
      if (generation !== this.generation || this.active !== run || this.state === "stopped") return;
      this.lastOutcome = `Observation failed: ${error instanceof Error ? error.message : String(error)}`;
    }
    if (this.active === run) this.setTimer(POLL_MS, () => this.observeRunning(run));
    this.changed();
  }

  private async observeAwaiting(): Promise<void> {
    const assigned = this.current;
    if (!assigned || this.state === "stopped" || this.state === "paused" || this.active) return;
    const generation = ++this.generation;
    try {
      const observed = await this.options.board.observe(assigned);
      if (generation !== this.generation || this.state === "stopped" || this.state === "paused" || this.active) return;
      if (!observed) return this.pauseFor("Observed Claim became orphaned");
      this.current = observed;
      if (!isEligible(this.options.role, observed)) return this.resolve();
      if (!observed.claimed) {
        this.observedClaim = false;
        await this.launch(observed);
        return;
      }
      this.state = "awaiting-requeue";
      this.setTimer(POLL_MS, () => this.observeAwaiting());
      this.changed();
    } catch (error) {
      if (generation === this.generation && this.state !== "stopped" && this.state !== "paused") {
        this.degrade(error, () => this.observeAwaiting());
      }
    }
  }

  private resolve(): void {
    this.lastOutcome = "Board handoff resolved the assignment";
    this.retries = 0;
    this.observedClaim = false;
    this.orphanedClaim = false;
    if (this.manualPause) {
      this.current = undefined;
      return this.pauseManually(() => this.pollForWork());
    }
    this.state = "cooldown";
    this.setTimer(COOLDOWN_MS, () => {
      this.current = undefined;
      return this.pollForWork();
    });
    this.changed();
  }

  private awaitRequeue(): void {
    if (this.manualPause) return this.pauseManually(() => {
      this.state = "awaiting-requeue";
      this.setTimer(0, () => this.observeAwaiting());
      this.changed();
    });
    this.state = "awaiting-requeue";
    this.setTimer(POLL_MS, () => this.observeAwaiting());
    this.changed();
  }

  private pauseManually(resume: () => Promise<void> | void): void {
    this.clearTimer();
    this.state = "paused";
    this.pauseReason = "manual";
    this.resumeAction = resume;
    this.changed();
  }

  private pauseFor(reason: string, retryable = false): void {
    this.clearTimer();
    this.state = "paused";
    this.pauseReason = retryable ? "retry" : "blocked";
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
    this.timerAction = action;
    this.nextPoll = this.now() + delay;
    this.timer = this.schedule(() => { void action(); }, delay);
  }

  private clearTimer() {
    this.timer?.cancel();
    this.timer = undefined;
    this.timerAction = undefined;
    this.nextPoll = undefined;
  }

  private changed() {
    this.options.onChange?.(this.snapshot());
  }
}

async function settleWithin(settled: Promise<unknown>, timeout: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      settled.then(() => undefined),
      new Promise<void>((resolve) => { timer = setTimeout(resolve, timeout); }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function isEligible(role: Role, item: BoardItem): boolean {
  if (item.open === false) return false;
  return role === "reviewer"
    ? item.kind === "pr" && item.lifecycle === "review"
    : (item.kind === "issue" && item.lifecycle === "ready") ||
      (item.kind === "pr" && item.lifecycle === "rework");
}
