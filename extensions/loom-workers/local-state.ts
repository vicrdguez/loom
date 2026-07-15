import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ModelChoice, Role } from "./types.ts";

interface LockOwner {
  pid: number;
  startedAt: string;
  token: string;
}

interface LockOptions {
  agentDir: string;
  pid?: number;
  isAlive?: (pid: number) => boolean;
}

export interface RoleLock {
  owner: LockOwner;
  release(): Promise<void>;
}

async function stateDir(project: string, agentDir: string): Promise<string> {
  const canonical = await realpath(project);
  const key = createHash("sha256").update(canonical).digest("hex").slice(0, 20);
  const dir = join(agentDir, "loom-workers", key);
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function acquireRoleLock(project: string, role: Role, options: LockOptions): Promise<RoleLock> {
  const file = join(await stateDir(project, options.agentDir), `${role}.lock`);
  const owner: LockOwner = {
    pid: options.pid ?? process.pid,
    startedAt: new Date().toISOString(),
    token: randomUUID(),
  };
  const isAlive = options.isAlive ?? processIsAlive;

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const handle = await open(file, "wx", 0o600);
      await handle.writeFile(JSON.stringify(owner));
      await handle.close();
      return {
        owner,
        release: async () => {
          try {
            const current = JSON.parse(await readFile(file, "utf8")) as LockOwner;
            if (current.token === owner.token) await rm(file);
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
          }
        },
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      let current: LockOwner | undefined;
      try {
        current = JSON.parse(await readFile(file, "utf8"));
      } catch {
        // A truncated lock is stale.
      }
      if (current && Number.isSafeInteger(current.pid) && current.pid > 0 && isAlive(current.pid)) {
        throw new Error(`${role} Role is owned by process ${current.pid} since ${current.startedAt}`);
      }
      try {
        await rm(file);
      } catch (removeError) {
        if ((removeError as NodeJS.ErrnoException).code !== "ENOENT") throw removeError;
      }
    }
  }
  throw new Error(`Could not acquire ${role} Role lock`);
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

export async function loadChoice(project: string, role: Role, agentDir: string): Promise<ModelChoice | undefined> {
  try {
    return JSON.parse(await readFile(join(await stateDir(project, agentDir), `${role}.json`), "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT" || error instanceof SyntaxError) return undefined;
    throw error;
  }
}

export async function saveChoice(project: string, role: Role, choice: ModelChoice, agentDir: string): Promise<void> {
  const dir = await stateDir(project, agentDir);
  const target = join(dir, `${role}.json`);
  const temporary = `${target}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(choice), { mode: 0o600 });
  await rename(temporary, target);
}
