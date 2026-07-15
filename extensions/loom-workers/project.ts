import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";

interface StartupInput {
  mode: string;
  trusted: boolean;
  cwd: string;
  availableModels: unknown[];
  runGh(): Promise<{ code?: number; stdout?: string; stderr?: string }>;
}

export type StartupResult =
  | { ok: true; projectRoot: string; repo: string }
  | { ok: false; remedy: string };

export async function gateStartup(input: StartupInput): Promise<StartupResult> {
  if (input.mode !== "tui") {
    return { ok: false, remedy: "The Loom Worker console is interactive only; restart Pi in TUI mode." };
  }
  if (!input.trusted) {
    return { ok: false, remedy: "Run /trust and restart Pi before starting Loom Workers." };
  }
  const projectFile = await findProjectFile(input.cwd);
  if (!projectFile) {
    return { ok: false, remedy: "No docs/loom/project.md found; run /skill:loom-init first." };
  }
  const config = await readFile(projectFile, "utf8");
  const host = config.match(/^\s*-\s*\*\*Host:\*\*\s*(.+?)\s*$/mi)?.[1]?.toLowerCase();
  if (host !== "github") {
    return { ok: false, remedy: "Only GitHub is currently supported by the Loom Worker console." };
  }
  const repo = config.match(/^\s*-\s*\*\*Repo:\*\*\s*(.+?)\s*$/mi)?.[1];
  if (!repo) {
    return { ok: false, remedy: "Set **Repo:** under ## Forge in docs/loom/project.md." };
  }
  try {
    const gh = await input.runGh();
    if (gh.code && gh.code !== 0) throw new Error(gh.stderr || `gh exited ${gh.code}`);
  } catch {
    return { ok: false, remedy: "Install and authenticate `gh` (`gh auth login`), then retry." };
  }
  if (input.availableModels.length === 0) {
    return { ok: false, remedy: "Configure a Pi model with /model or /login, then retry." };
  }
  return {
    ok: true,
    projectRoot: dirname(dirname(dirname(projectFile))),
    repo,
  };
}

async function findProjectFile(cwd: string): Promise<string | undefined> {
  let current = cwd;
  while (true) {
    const candidate = join(current, "docs", "loom", "project.md");
    try {
      await readFile(candidate);
      return candidate;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const parent = dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}
