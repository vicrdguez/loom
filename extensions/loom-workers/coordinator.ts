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

export class Coordinator {
  private readonly options: CoordinatorOptions;
  private readonly lanes = new Map<Role, RoleLane>();

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
      if (!choice) {
        result.failures[role] = `No model selected for ${role}`;
        continue;
      }
      if (this.lanes.has(role)) {
        result.failures[role] = `${role} lane is already running locally`;
        continue;
      }
      try {
        const lock = await this.options.acquire(role);
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

  status(): Array<LaneSnapshot | { role: Role; state: "stopped" }> {
    return (["implementor", "reviewer"] as Role[]).map((role) =>
      this.lanes.get(role)?.snapshot() ?? { role, state: "stopped" },
    );
  }
}
