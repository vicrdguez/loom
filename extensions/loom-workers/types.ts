export type Role = "implementor" | "reviewer";
export type Lifecycle = "ready" | "review" | "rework" | "done" | "none";
export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

export interface BoardItem {
  kind: "issue" | "pr";
  number: number;
  title: string;
  url: string;
  lifecycle: Lifecycle;
  claimed: boolean;
  createdAt: string;
  headRefName?: string;
  open?: boolean;
}

export interface ModelChoice {
  provider: string;
  model: string;
  thinking: ThinkingLevel;
}

export interface WorkerActivity {
  role: Role;
  kind: "message" | "failure";
  text: string;
}

export interface WorkerOutcome {
  ok: boolean;
  error?: string;
}

export interface WorkerRun {
  sessionId: string;
  settled: Promise<WorkerOutcome>;
  abort(): Promise<void>;
  dispose(): Promise<void> | void;
}
