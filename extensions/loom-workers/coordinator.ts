import { RoleLane, type LaneOptions, type LaneSnapshot } from "./lane.ts";
import type { BoardItem, ModelChoice, Role, WorkerActivity } from "./types.ts";

interface Board {
  listOpen(): Promise<BoardItem[]>;
  next?(role: Role): Promise<BoardItem | undefined>;
  observe?(item: BoardItem): Promise<BoardItem | undefined>;
}

interface RoleLock {
  owner: { pid: number; startedAt?: string };
  release(): Promise<void>;
}

interface CoordinatorOptions {
  board: Board;
  worker: any;
  acquire(role: Role): Promise<RoleLock>;
  saveChoice(role: Role, choice: ModelChoice): Promise<void>;
  createLane?: (options: LaneOptions) => RoleLane;
  onActivity?: (activity: WorkerActivity) => void;
  onChange?: () => void;
  onWarning?: (message: string) => void;
}

export interface StartResult {
  started: Role[];
  failures: Partial<Record<Role, string>>;
}

type StatusRow = LaneSnapshot | { role: Role; state: "stopped" };

export function formatStatus(rows: StatusRow[], now = Date.now()): string {
  return rows.map((row) => {
    if (row.state === "stopped") return `${row.role}: stopped`;
    const parts = [`${row.role}: ${row.state}`];
    if (row.current) parts.push(`${row.current.title} #${row.current.number}`);
    parts.push(`${row.model.provider}/${row.model.model} (${row.model.thinking})`);
    if (row.startedAt !== undefined) parts.push(`elapsed ${duration(now - row.startedAt)}`);
    parts.push(`retries ${row.retries}`);
    if (row.lastOutcome) parts.push(row.lastOutcome);
    if (row.nextPoll !== undefined) parts.push(`next poll ${duration(row.nextPoll - now)}`);
    return parts.join(" — ");
  }).join("\n");
}

function duration(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1_000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export class Coordinator {
  private readonly options: CoordinatorOptions;
  private readonly lanes = new Map<Role, RoleLane>();
  private shutDown = false;

  constructor(options: CoordinatorOptions) {
    this.options = options;
  }

  async start(
    target: Role | "both",
    choices: Partial<Record<Role, ModelChoice>>,
  ): Promise<StartResult> {
    const roles: Role[] = target === "both" ? ["implementor", "reviewer"] : [target];
    const result: StartResult = { started: [], failures: {} };

    for (const role of roles) {
      const choice = choices[role];
      if (this.shutDown) {
        result.failures[role] = "Coordinator is shut down";
        continue;
      }
      if (!choice) {
        result.failures[role] = `No model selected for ${role}`;
        continue;
      }
      if (this.lanes.has(role)) {
        result.failures[role] = `${role} lane is already running locally`;
        continue;
      }
      let lock: RoleLock | undefined;
      try {
        lock = await this.options.acquire(role);
        if (this.shutDown) throw new Error("Coordinator is shut down");
        const lane = (this.options.createLane ?? ((laneOptions) => new RoleLane(laneOptions)))({
          role,
          board: this.options.board as Required<Pick<Board, "next" | "observe">>,
          worker: this.options.worker,
          model: choice,
          onActivity: this.options.onActivity,
          onChange: this.options.onChange,
          releaseLock: lock.release,
        });
        this.lanes.set(role, lane);
        lane.start();
        result.started.push(role);
        try {
          await this.options.saveChoice(role, choice);
        } catch (error) {
          this.options.onWarning?.(`Could not save ${role} model choice: ${error instanceof Error ? error.message : String(error)}`);
        }
      } catch (error) {
        this.lanes.delete(role);
        await lock?.release();
        result.failures[role] = error instanceof Error ? error.message : String(error);
      }
    }

    const implementor = this.lanes.get("implementor")?.snapshot().model;
    const reviewer = this.lanes.get("reviewer")?.snapshot().model;
    if (implementor && reviewer && implementor.provider === reviewer.provider && implementor.model === reviewer.model) {
      this.options.onWarning?.("Implementor and reviewer use the same model; Model diversity is absent but contexts remain independent.");
    }
    this.options.onChange?.();
    return result;
  }

  list(): Promise<BoardItem[]> {
    return this.options.board.listOpen();
  }

  status(): StatusRow[] {
    return (["implementor", "reviewer"] as Role[]).map((role) =>
      this.lanes.get(role)?.snapshot() ?? { role, state: "stopped" },
    );
  }

  pause(role: Role): boolean {
    const lane = this.lanes.get(role);
    if (!lane) return false;
    lane.pause();
    return true;
  }

  resume(role: Role): boolean {
    return this.lanes.get(role)?.resume() ?? false;
  }

  retry(role: Role): boolean {
    return this.lanes.get(role)?.retry() ?? false;
  }

  async stop(role: Role): Promise<boolean> {
    const lane = this.lanes.get(role);
    if (!lane) return false;
    await lane.stop();
    this.lanes.delete(role);
    this.options.onChange?.();
    return true;
  }

  async shutdown(): Promise<void> {
    this.shutDown = true;
    await Promise.all(Array.from(this.lanes.keys(), (role) => this.stop(role)));
  }
}
