import type { BoardItem, Lifecycle, Role } from "./types.ts";

export interface CommandResult {
  stdout: string;
  stderr?: string;
  code?: number;
}

export type GhRunner = (args: string[]) => Promise<CommandResult>;

const missingObject = /not found|could not resolve to/i;

const searches: Array<{ lifecycle: Lifecycle; kind: "issue" | "pr" }> = [
  { lifecycle: "ready", kind: "issue" },
  { lifecycle: "review", kind: "pr" },
  { lifecycle: "rework", kind: "pr" },
  { lifecycle: "done", kind: "pr" },
];

export class GitHubBoard {
  private readonly repo: string;
  private readonly run: GhRunner;

  constructor(repo: string, run: GhRunner) {
    this.repo = repo;
    this.run = run;
  }

  async listOpen(): Promise<BoardItem[]> {
    const items: BoardItem[] = [];
    for (const search of searches) {
      const result = await this.run([
        search.kind, "list", "--repo", this.repo, "--state", "open",
        "--label", `loom:${search.lifecycle}`, "--limit", "10000",
        "--json", search.kind === "pr"
          ? "number,title,url,createdAt,state,labels,headRefName"
          : "number,title,url,createdAt,state,labels",
      ]);
      if ((result.code ?? 0) !== 0) throw new Error(result.stderr || `gh exited ${result.code}`);
      const rows = parseRows(result.stdout);
      for (const row of rows) {
        const labels = labelNames(row.labels);
        if (row.state !== "OPEN" || !labels.includes(`loom:${search.lifecycle}`)) continue;
        items.push({
          kind: search.kind,
          number: row.number,
          title: row.title,
          url: row.url,
          lifecycle: search.lifecycle,
          claimed: labels.includes("loom:wip"),
          createdAt: row.createdAt,
          headRefName: row.headRefName,
          open: true,
        });
      }
    }
    return items;
  }

  async observe(item: BoardItem): Promise<BoardItem | undefined> {
    let result: CommandResult;
    try {
      result = await this.run([
        item.kind, "view", String(item.number), "--repo", this.repo,
        "--json", item.kind === "pr"
          ? "number,title,url,createdAt,state,labels,headRefName"
          : "number,title,url,createdAt,state,labels",
      ]);
    } catch (error) {
      if (missingObject.test(error instanceof Error ? error.message : String(error))) return undefined;
      throw error;
    }
    if (result.code && result.code !== 0) {
      if (missingObject.test(result.stderr ?? "")) return undefined;
      throw new Error(result.stderr || `gh exited ${result.code}`);
    }
    const row = JSON.parse(result.stdout);
    const labels = labelNames(row.labels);
    const lifecycle = (["ready", "review", "rework", "done"] as const)
      .find((name) => labels.includes(`loom:${name}`)) ?? "none";
    return {
      kind: item.kind,
      number: row.number,
      title: row.title,
      url: row.url,
      createdAt: row.createdAt,
      lifecycle,
      claimed: labels.includes("loom:wip"),
      headRefName: row.headRefName,
      open: row.state === "OPEN",
    };
  }

  async next(role: Role): Promise<BoardItem | undefined> {
    const eligible = (await this.listOpen()).filter((item) =>
      !item.claimed && (role === "reviewer"
        ? item.kind === "pr" && item.lifecycle === "review"
        : (item.kind === "issue" && item.lifecycle === "ready") ||
          (item.kind === "pr" && item.lifecycle === "rework")),
    );
    eligible.sort((left, right) => {
      const lifecycle = Number(left.lifecycle !== "rework") - Number(right.lifecycle !== "rework");
      return lifecycle || left.createdAt.localeCompare(right.createdAt) || left.number - right.number;
    });
    return eligible[0];
  }
}

function parseRows(stdout: string): any[] {
  const value = JSON.parse(stdout || "[]");
  if (!Array.isArray(value)) throw new Error("gh returned invalid Board JSON");
  return value;
}

function labelNames(labels: unknown): string[] {
  if (!Array.isArray(labels)) return [];
  return labels.map((label) => typeof label === "string" ? label : (label as any)?.name).filter(Boolean);
}
