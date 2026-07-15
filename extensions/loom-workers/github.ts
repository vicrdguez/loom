import type { BoardItem, Lifecycle, Role } from "./types.ts";

export interface CommandResult {
  stdout: string;
  stderr?: string;
  code?: number;
}

export type GhRunner = (args: string[]) => Promise<CommandResult>;

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
        "--label", `loom:${search.lifecycle}`, "--limit", "100",
        "--json", "number,title,url,createdAt,state,labels,headRefName",
      ]);
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
        });
      }
    }
    return items;
  }

  async next(_role: Role): Promise<BoardItem | undefined> {
    return undefined;
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
