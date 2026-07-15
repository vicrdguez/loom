import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import test from "node:test";
import { Worker } from "node:worker_threads";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPiSessionFactory, loadBundledContract, PiWorker } from "../extensions/loom-workers/pi-worker.ts";
import { acquireRoleLock, loadChoice, saveChoice } from "../extensions/loom-workers/local-state.ts";
import { selectModelChoice } from "../extensions/loom-workers/models.ts";
import { GitHubBoard } from "../extensions/loom-workers/github.ts";
import { RoleLane } from "../extensions/loom-workers/lane.ts";
import { Coordinator, formatStatus } from "../extensions/loom-workers/coordinator.ts";
import { gateStartup } from "../extensions/loom-workers/project.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("discover the extension and every Loom skill", async () => {
  const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  const skillNames = (await readdir(join(root, "skills"), { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("loom-"))
    .map((entry) => entry.name)
    .sort();

  assert.deepEqual(manifest.pi.extensions, ["./extensions/loom-workers/index.ts"]);
  assert.deepEqual(manifest.pi.skills, ["./skills"]);
  const commands: string[] = [];
  const extension = await import("../extensions/loom-workers/index.ts");
  extension.default({
    registerCommand(name: string) { commands.push(name); },
    registerEntryRenderer() {},
    on() {},
  });
  assert.deepEqual(commands, ["loom-workers"]);
  assert.ok(skillNames.length > 0);
  for (const name of skillNames) {
    assert.match(await readFile(join(root, "skills", name, "SKILL.md"), "utf8"), /^---\nname: loom-/);
  }
  assert.equal(manifest.scripts?.prepare, undefined);
  assert.equal(manifest.scripts?.postinstall, undefined);
  assert.equal(manifest.devDependencies, undefined);
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

class FakeScheduler {
  now = 1_000;
  jobs: Array<{ at: number; run: () => void }> = [];

  schedule = (run: () => void, delay: number) => {
    const job = { at: this.now + delay, run };
    this.jobs.push(job);
    return { cancel: () => { this.jobs = this.jobs.filter((entry) => entry !== job); } };
  };

  async runNext() {
    this.jobs.sort((left, right) => left.at - right.at);
    const job = this.jobs.shift();
    assert.ok(job, "expected a scheduled job");
    this.now = job.at;
    job.run();
    await new Promise((resolve) => setImmediate(resolve));
  }
}

test("leave projects unchanged on package installation", async () => {
  const project = await mkdtemp(join(tmpdir(), "loom-package-"));
  let command: ((args: string, ctx: any) => Promise<void>) | undefined;
  const extension = await import("../extensions/loom-workers/index.ts");

  try {
    extension.default({
      registerCommand(_name: string, options: { handler: typeof command }) { command = options.handler; },
      registerEntryRenderer() {},
      appendEntry() {},
      on() {},
    } as any);
    await command?.("", {
      cwd: project,
      hasUI: false,
      ui: { notify() {} },
    });
    assert.deepEqual(await readdir(project), []);
    assert.ok((await readdir(join(root, "skills"))).includes("loom-init"));
  } finally {
    await rm(project, { recursive: true, force: true });
  }
});

test("prefer Harness-native installation without changing the legacy installer", async () => {
  const readme = await readFile(join(root, "README.md"), "utf8");
  const installer = await readFile(join(root, "install.sh"), "utf8");
  const help = execFileSync("sh", [join(root, "install.sh"), "--help"], { encoding: "utf8" });

  assert.match(readme, /Claude Code.*native plugin/is);
  assert.match(readme, /pi install git:github\.com\/vicrdguez\/loom/);
  assert.match(readme, /deprecated compatibility path for Codex CLI and OpenCode/i);
  assert.doesNotMatch(installer, /--tools[^\n]*pi/i);
  assert.doesNotMatch(help, /\bpi\b/i);
  assert.doesNotMatch(help, /deprecated/i);
});

test("never substitute an ineligible assignment", async () => {
  for (const skill of ["loom-implement", "loom-review"]) {
    const content = await readFile(join(root, "skills", skill, "SKILL.md"), "utf8");
    assert.match(content, /## Exact scheduler assignment/);
    assert.match(content, /verify only that exact Board object/);
    assert.match(content, /exit without touching the Change/);
    assert.match(content, /never select or Claim a\s+replacement/i);
  }
});

test("run implementor and reviewer concurrently", async () => {
  const prompts = [deferred<void>(), deferred<void>()];
  const created: string[] = [];
  const worker = new PiWorker({
    projectRoot: root,
    loadContract: async (role) => `${role} contract`,
    createSession: async ({ role }) => {
      created.push(role);
      const current = prompts[created.length - 1];
      return {
        id: `${role}-session`,
        messages: [],
        subscribe() { return () => {}; },
        prompt: () => current.promise,
        abort: async () => {},
        dispose() {},
      };
    },
  });

  const implementor = await worker.start("implementor", {
    kind: "issue", number: 1, title: "one", url: "one", lifecycle: "ready", claimed: false, createdAt: "1",
  }, { provider: "p", model: "m", thinking: "off" }, () => {});
  const reviewer = await worker.start("reviewer", {
    kind: "pr", number: 2, title: "two", url: "two", lifecycle: "review", claimed: false, createdAt: "2",
  }, { provider: "p", model: "m", thinking: "off" }, () => {});

  assert.deepEqual(created, ["implementor", "reviewer"]);
  prompts[0].resolve();
  prompts[1].resolve();
  await Promise.all([implementor.settled, reviewer.settled]);
});

test("discard context between consecutive work units", async () => {
  const events: string[] = [];
  let nextId = 0;
  const worker = new PiWorker({
    projectRoot: root,
    loadContract: async () => "contract",
    createSession: async () => {
      const id = `session-${++nextId}`;
      events.push(`create:${id}`);
      return {
        id,
        messages: [],
        subscribe() { return () => {}; },
        prompt: async () => {},
        abort: async () => {},
        dispose() { events.push(`dispose:${id}`); },
      };
    },
  });
  const item = {
    kind: "issue" as const, number: 1, title: "one", url: "one", lifecycle: "ready" as const,
    claimed: false, createdAt: "1",
  };
  const choice = { provider: "p", model: "m", thinking: "off" as const };

  const first = await worker.start("implementor", item, choice, () => {});
  await first.settled;
  const second = await worker.start("implementor", item, choice, () => {});
  await second.settled;

  assert.notEqual(first.sessionId, second.sessionId);
  assert.deepEqual(events, ["create:session-1", "dispose:session-1", "create:session-2", "dispose:session-2"]);
});

test("load standard project policy around the bundled Role contract", async () => {
  const calls: string[] = [];
  let prompt = "";
  const createSession = createPiSessionFactory(async () => ({
    AuthStorage: { create: () => ({}) },
    ModelRegistry: { create: () => ({ find: () => ({ id: "model" }) }) },
    DefaultResourceLoader: class {
      constructor(options: any) { calls.push(`loader:${options.cwd}`); }
      async reload() { calls.push("reload"); }
    },
    SessionManager: { inMemory: (cwd: string) => { calls.push(`memory:${cwd}`); return {}; } },
    getAgentDir: () => "/agent",
    createAgentSession: async (options: any) => {
      calls.push(`create:${options.cwd}`);
      return { session: {
        sessionId: "fresh",
        messages: [],
        subscribe() { return () => {}; },
        async prompt(value: string) { prompt = value; },
        async abort() {},
        dispose() {},
      } };
    },
  }));
  const worker = new PiWorker({
    projectRoot: "/project",
    loadContract: async () => "BUNDLED ROLE CONTRACT",
    createSession,
  });
  const run = await worker.start("reviewer", {
    kind: "pr", number: 42, title: "change", url: "url", lifecycle: "review", claimed: false, createdAt: "now",
  }, { provider: "provider", model: "model", thinking: "high" }, () => {});
  await run.settled;

  assert.deepEqual(calls, ["loader:/project", "reload", "memory:/project", "create:/project"]);
  assert.match(prompt, /^BUNDLED ROLE CONTRACT/);
  assert.match(prompt, /Process only this exact Board object; never discover or substitute another/);
  assert.match(prompt, /"number":42/);
  assert.match(await loadBundledContract("reviewer"), /^---\nname: loom-review/);
});

test("refuse unsafe or unsupported startup", async () => {
  const initialized = await mkdtemp(join(tmpdir(), "loom-gate-project-"));
  const uninitialized = await mkdtemp(join(tmpdir(), "loom-gate-empty-"));
  await mkdir(join(initialized, "docs/loom"), { recursive: true });
  await writeFile(join(initialized, "docs/loom/project.md"), "## Forge\n- **Host:** github\n- **Repo:** owner/repo\n");
  const base = {
    mode: "tui",
    trusted: true,
    cwd: initialized,
    availableModels: [{}],
    runGh: async () => ({ code: 0, stdout: "", stderr: "" }),
  };

  try {
    const cases = [
      [{ ...base, mode: "print" }, /interactive only/],
      [{ ...base, trusted: false }, /\/trust.*restart Pi/],
      [{ ...base, cwd: uninitialized }, /\/skill:loom-init/],
      [{ ...base, overrideHost: "gitlab" }, /only GitHub/i],
      [{ ...base, runGh: async () => ({ code: 1, stdout: "", stderr: "not logged in" }) }, /install.*authenticate `gh`/i],
      [{ ...base, availableModels: [] }, /configure a Pi model/i],
    ] as const;
    for (const [input, remedy] of cases) {
      if ("overrideHost" in input) {
        await writeFile(join(initialized, "docs/loom/project.md"), "## Forge\n- **Host:** gitlab\n- **Repo:** owner/repo\n");
      }
      const result = await gateStartup(input as any);
      assert.equal(result.ok, false);
      assert.match(result.remedy ?? "", remedy);
      await writeFile(join(initialized, "docs/loom/project.md"), "## Forge\n- **Host:** github\n- **Repo:** owner/repo\n");
    }
  } finally {
    await rm(initialized, { recursive: true, force: true });
    await rm(uninitialized, { recursive: true, force: true });
  }
});

test("select and remember a Role model natively", async () => {
  const project = await mkdtemp(join(tmpdir(), "loom-choice-project-"));
  const agentDir = await mkdtemp(join(tmpdir(), "loom-choice-agent-"));
  const saved = { provider: "beta", model: "two", thinking: "high" as const };
  await saveChoice(project, "implementor", saved, agentDir);
  const selections: Array<{ title: string; options: string[] }> = [];
  const ui = {
    select: async (title: string, options: string[]) => {
      selections.push({ title, options });
      return options[0];
    },
  };

  try {
    const choice = await selectModelChoice("implementor", [
      { provider: "alpha", id: "one", reasoning: false },
      { provider: "beta", id: "two", reasoning: true },
    ], await loadChoice(project, "implementor", agentDir), ui);
    assert.deepEqual(choice, saved);
    assert.equal(selections[0].options[0], "beta/two");
    assert.equal(selections[1].options[0], "high");
    assert.match(selections[0].title, /implementor model/i);
    assert.match(selections[1].title, /thinking/i);
  } finally {
    await rm(project, { recursive: true, force: true });
    await rm(agentDir, { recursive: true, force: true });
  }
});

test("start available Roles independently", async () => {
  const started: string[] = [];
  const saved: string[] = [];
  const coordinator = new Coordinator({
    board: { listOpen: async () => [] },
    worker: {} as any,
    acquire: async (role) => {
      if (role === "reviewer") throw new Error("owned by process 99");
      return { owner: { pid: 1 }, release: async () => {} } as any;
    },
    saveChoice: async (role) => { saved.push(role); },
    createLane: (options) => ({
      start() { started.push(options.role); },
      snapshot: () => ({ role: options.role, state: "idle", model: options.model, retries: 0 }),
    } as any),
  });
  const choice = { provider: "p", model: "m", thinking: "off" as const };

  const result = await coordinator.start("both", { implementor: choice, reviewer: choice });
  assert.deepEqual(result.started, ["implementor"]);
  assert.match(result.failures.reviewer ?? "", /process 99/);
  assert.deepEqual(started, ["implementor"]);
  assert.deepEqual(saved, ["implementor"]);
});

test("allow matching Role models with a warning", async () => {
  const warnings: string[] = [];
  const identities: object[] = [];
  const coordinator = new Coordinator({
    board: { listOpen: async () => [] },
    worker: {} as any,
    acquire: async () => ({ owner: { pid: 1 }, release: async () => {} }),
    saveChoice: async () => {},
    createLane: (options) => {
      const identity = {};
      identities.push(identity);
      return {
        start() {},
        snapshot: () => ({ role: options.role, state: "idle", model: options.model, retries: 0, identity }),
      } as any;
    },
    onWarning: (warning) => warnings.push(warning),
  });
  const choice = { provider: "same", model: "model", thinking: "high" as const };
  const result = await coordinator.start("both", { implementor: choice, reviewer: choice });

  assert.deepEqual(result.started, ["implementor", "reviewer"]);
  assert.notEqual(identities[0], identities[1]);
  assert.match(warnings.join("\n"), /Model diversity is absent/);
});

test("list all open Board Changes", async () => {
  const rows: Record<string, any[]> = {
    "loom:ready": [
      { number: 1, title: "ready", url: "u1", createdAt: "1", state: "OPEN", labels: [{ name: "loom:ready" }] },
      { number: 9, title: "unlabeled", url: "u9", createdAt: "9", state: "OPEN", labels: [] },
    ],
    "loom:review": [{ number: 2, title: "review", url: "u2", createdAt: "2", state: "OPEN", headRefName: "two", labels: [{ name: "loom:review" }, { name: "loom:wip" }] }],
    "loom:rework": [{ number: 3, title: "rework", url: "u3", createdAt: "3", state: "OPEN", headRefName: "three", labels: [{ name: "loom:rework" }] }],
    "loom:done": [
      { number: 4, title: "done", url: "u4", createdAt: "4", state: "OPEN", headRefName: "four", labels: [{ name: "loom:done" }] },
      { number: 5, title: "closed", url: "u5", createdAt: "5", state: "CLOSED", labels: [{ name: "loom:done" }] },
    ],
  };
  const board = new GitHubBoard("owner/repo", async (args) => {
    const label = args[args.indexOf("--label") + 1];
    return { stdout: JSON.stringify(rows[label]) };
  });

  const items = await board.listOpen();
  assert.deepEqual(items.map((item) => [item.lifecycle, item.number, item.claimed]), [
    ["ready", 1, false],
    ["review", 2, true],
    ["rework", 3, false],
    ["done", 4, false],
  ]);
  const { formatList } = await import("../extensions/loom-workers/index.ts");
  const text = formatList(items);
  for (const lifecycle of ["ready", "review", "rework", "done"]) assert.match(text, new RegExp(`loom:${lifecycle}`));
  assert.match(text, /#2 review \[loom:wip\] — u2/);
});

test("degrade when GitHub Board listing fails", async () => {
  const board = new GitHubBoard("owner/repo", async () => ({
    code: 1,
    stdout: "",
    stderr: "network down",
  }));

  await assert.rejects(board.listOpen(), /network down/);
});

test("report current Role status", () => {
  const text = formatStatus([{
    role: "implementor",
    state: "running",
    current: { kind: "issue", number: 12, title: "change", url: "u", lifecycle: "ready", claimed: true, createdAt: "1" },
    model: { provider: "provider", model: "model", thinking: "high" },
    startedAt: 1_000,
    retries: 2,
    lastOutcome: "Worker running",
    nextPoll: 70_000,
  }, { role: "reviewer", state: "stopped" }], 61_000);

  assert.match(text, /implementor.*running.*change.*#12/i);
  assert.match(text, /provider\/model.*high/);
  assert.match(text, /elapsed 1m/);
  assert.match(text, /retries 2/);
  assert.match(text, /Worker running/);
  assert.match(text, /next poll 9s/);
  assert.match(text, /reviewer.*stopped/i);
});

test("observe one exact GitHub Board object", async () => {
  const commands: string[][] = [];
  const board = new GitHubBoard("owner/repo", async (args) => {
    commands.push(args);
    return { stdout: JSON.stringify({
      number: 7, title: "change", url: "u", createdAt: "1", state: "OPEN",
      headRefName: "change", labels: [{ name: "loom:review" }, { name: "loom:wip" }],
    }) };
  });
  const observed = await board.observe({
    kind: "pr", number: 7, title: "old", url: "u", createdAt: "1", lifecycle: "review", claimed: false,
  });
  assert.deepEqual(commands[0].slice(0, 5), ["pr", "view", "7", "--repo", "owner/repo"]);
  assert.equal(observed?.claimed, true);
  assert.equal(observed?.headRefName, "change");
});

test("prefer eligible rework over ready work", async () => {
  const rows: Record<string, any[]> = {
    "loom:ready": [{ number: 1, title: "ready", url: "u1", createdAt: "2026-01-01", state: "OPEN", labels: [{ name: "loom:ready" }] }],
    "loom:review": [],
    "loom:rework": [
      { number: 3, title: "newer rework", url: "u3", createdAt: "2026-01-03", state: "OPEN", labels: [{ name: "loom:rework" }] },
      { number: 2, title: "older rework", url: "u2", createdAt: "2026-01-02", state: "OPEN", labels: [{ name: "loom:rework" }] },
    ],
    "loom:done": [],
  };
  const board = new GitHubBoard("owner/repo", async (args) => ({
    stdout: JSON.stringify(rows[args[args.indexOf("--label") + 1]]),
  }));

  assert.equal((await board.next("implementor"))?.number, 2);
});

test("exclude Claims before oldest-item selection", async () => {
  for (const [role, lifecycle, kind] of [
    ["implementor", "ready", "issue"],
    ["implementor", "rework", "pr"],
    ["reviewer", "review", "pr"],
  ] as const) {
    const rows: Record<string, any[]> = {
      "loom:ready": [], "loom:review": [], "loom:rework": [], "loom:done": [],
    };
    rows[`loom:${lifecycle}`] = [
      { number: 1, title: "claimed", url: "u1", createdAt: "1", state: "OPEN", labels: [{ name: `loom:${lifecycle}` }, { name: "loom:wip" }] },
      { number: 2, title: "eligible", url: "u2", createdAt: "2", state: "OPEN", labels: [{ name: `loom:${lifecycle}` }] },
    ];
    const board = new GitHubBoard("owner/repo", async (args) => ({
      stdout: JSON.stringify(rows[args[args.indexOf("--label") + 1]].map((row) => ({ ...row, kind }))),
    }));
    assert.equal((await board.next(role))?.number, 2, `${role} ${lifecycle}`);
  }
});

test("remain idle with no eligible work", async () => {
  const scheduler = new FakeScheduler();
  let workerStarts = 0;
  const lane = new RoleLane({
    role: "implementor",
    board: { next: async () => undefined, observe: async () => undefined },
    worker: { start: async () => { workerStarts++; throw new Error("unexpected"); } },
    model: { provider: "p", model: "m", thinking: "off" },
    schedule: scheduler.schedule,
    now: () => scheduler.now,
  });

  lane.start();
  await scheduler.runNext();
  assert.equal(lane.snapshot().state, "idle");
  assert.equal(lane.snapshot().nextPoll, 61_000);
  assert.equal(workerStarts, 0);
  await scheduler.runNext();
  assert.equal(workerStarts, 0);
});

test("stop does not launch after Board selection settles", async () => {
  const scheduler = new FakeScheduler();
  const selection = deferred<{
    kind: "issue";
    number: number;
    title: string;
    url: string;
    lifecycle: "ready";
    claimed: boolean;
    createdAt: string;
  }>();
  let starts = 0;
  const lane = new RoleLane({
    role: "implementor",
    board: { next: () => selection.promise, observe: async () => undefined },
    worker: { start: async () => {
      starts++;
      return { sessionId: "late", settled: new Promise(() => {}), abort: async () => {}, dispose() {} };
    } },
    model: { provider: "p", model: "m", thinking: "off" },
    schedule: scheduler.schedule,
    now: () => scheduler.now,
  });

  lane.start();
  await scheduler.runNext();
  await lane.stop();
  selection.resolve({
    kind: "issue", number: 1, title: "change", url: "u", lifecycle: "ready", claimed: false, createdAt: "1",
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(starts, 0);
  assert.equal(lane.snapshot().state, "stopped");
});

test("stop cancels Worker startup before session creation finishes", async () => {
  const scheduler = new FakeScheduler();
  const creating = deferred<void>();
  const session = deferred<any>();
  let prompted = false;
  let disposed = false;
  let released = false;
  const item = {
    kind: "issue" as const, number: 1, title: "change", url: "u", lifecycle: "ready" as const,
    claimed: false, createdAt: "1",
  };
  const lane = new RoleLane({
    role: "implementor",
    board: { next: async () => item, observe: async () => item },
    worker: new PiWorker({
      projectRoot: root,
      loadContract: async () => "contract",
      createSession: async () => {
        creating.resolve();
        return session.promise;
      },
    }),
    model: { provider: "p", model: "m", thinking: "off" },
    schedule: scheduler.schedule,
    now: () => scheduler.now,
    releaseLock: async () => { released = true; },
  });

  lane.start();
  await scheduler.runNext();
  await creating.promise;
  await lane.stop();
  session.resolve({
    id: "late",
    messages: [],
    subscribe() { return () => {}; },
    async prompt() { prompted = true; },
    async abort() {},
    dispose() { disposed = true; },
  });
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(prompted, false);
  assert.equal(disposed, true);
  assert.equal(released, true);
  assert.equal(lane.snapshot().state, "stopped");
});

test("classify Board state after session settlement", async () => {
  const cases = [
    ["implementor", "left", "cooldown"],
    ["reviewer", "left", "cooldown"],
    ["implementor", "eligible", "retry-backoff"],
    ["reviewer", "eligible", "retry-backoff"],
    ["implementor", "claimed", "awaiting-requeue"],
    ["reviewer", "claimed", "awaiting-requeue"],
    ["reviewer", "unavailable", "degraded"],
  ] as const;

  for (const [role, boardState, expected] of cases) {
    const scheduler = new FakeScheduler();
    const done = deferred<{ ok: boolean }>();
    const item = role === "implementor"
      ? { kind: "issue" as const, number: 1, title: "change", url: "u", lifecycle: "ready" as const, claimed: false, createdAt: "1" }
      : { kind: "pr" as const, number: 1, title: "change", url: "u", lifecycle: "review" as const, claimed: false, createdAt: "1" };
    const board = {
      next: async () => item,
      observe: async () => {
        if (boardState === "unavailable") throw new Error("GitHub unavailable");
        if (boardState === "left") return { ...item, lifecycle: "done" as const };
        return { ...item, claimed: boardState === "claimed" };
      },
    };
    const lane = new RoleLane({
      role,
      board,
      worker: { start: async () => ({
        sessionId: role,
        settled: done.promise,
        abort: async () => {},
        dispose() {},
      }) },
      model: { provider: "p", model: "m", thinking: "off" },
      schedule: scheduler.schedule,
      now: () => scheduler.now,
    });

    lane.start();
    await scheduler.runNext();
    assert.equal(lane.snapshot().state, "running", `${role} starts running`);
    done.resolve({ ok: true });
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(lane.snapshot().state, expected, `${role} ${boardState}`);
  }
});

test("let Board truth override session failure", async () => {
  const scheduler = new FakeScheduler();
  const done = deferred<{ ok: boolean; error: string }>();
  const item = { kind: "pr" as const, number: 1, title: "change", url: "u", lifecycle: "review" as const, claimed: false, createdAt: "1" };
  const lane = new RoleLane({
    role: "reviewer",
    board: {
      next: async () => item,
      observe: async () => ({ ...item, lifecycle: "done" as const }),
    },
    worker: { start: async () => ({ sessionId: "s", settled: done.promise, abort: async () => {}, dispose() {} }) },
    model: { provider: "p", model: "m", thinking: "off" },
    schedule: scheduler.schedule,
    now: () => scheduler.now,
  });
  lane.start();
  await scheduler.runNext();
  done.resolve({ ok: false, error: "session exploded" });
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(lane.snapshot().state, "cooldown");
  assert.doesNotMatch(lane.snapshot().lastOutcome ?? "", /session exploded/);
});

test("pause after three pre-Claim failures", async () => {
  const scheduler = new FakeScheduler();
  const runs = [deferred<{ ok: boolean }>(), deferred<{ ok: boolean }>(), deferred<{ ok: boolean }>()];
  const item = { kind: "issue" as const, number: 1, title: "change", url: "u", lifecycle: "ready" as const, claimed: false, createdAt: "1" };
  let starts = 0;
  const lane = new RoleLane({
    role: "implementor",
    board: { next: async () => item, observe: async () => item },
    worker: { start: async () => ({
      sessionId: `s${starts}`,
      settled: runs[starts++].promise,
      abort: async () => {},
      dispose() {},
    }) },
    model: { provider: "p", model: "m", thinking: "off" },
    schedule: scheduler.schedule,
    now: () => scheduler.now,
  });

  lane.start();
  await scheduler.runNext();
  for (let attempt = 0; attempt < 3; attempt++) {
    runs[attempt].resolve({ ok: false });
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    if (attempt < 2) {
      assert.equal((lane.snapshot().nextPoll ?? 0) - scheduler.now, [5_000, 30_000][attempt]);
      await scheduler.runNext();
    }
  }
  assert.equal(starts, 3);
  assert.equal(lane.snapshot().retries, 3);
  assert.equal(lane.snapshot().state, "paused");
  assert.equal(scheduler.jobs.length, 0);
});

test("retry automatically after human requeue", async () => {
  const scheduler = new FakeScheduler();
  const first = deferred<{ ok: boolean }>();
  const second = deferred<{ ok: boolean }>();
  const item = { kind: "pr" as const, number: 1, title: "change", url: "u", lifecycle: "review" as const, claimed: false, createdAt: "1" };
  let claimed = true;
  let starts = 0;
  const lane = new RoleLane({
    role: "reviewer",
    board: { next: async () => item, observe: async () => ({ ...item, claimed }) },
    worker: { start: async () => ({
      sessionId: `session-${++starts}`,
      settled: starts === 1 ? first.promise : second.promise,
      abort: async () => {},
      dispose() {},
    }) },
    model: { provider: "p", model: "m", thinking: "off" },
    schedule: scheduler.schedule,
    now: () => scheduler.now,
  });

  lane.start();
  await scheduler.runNext();
  first.resolve({ ok: true });
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(lane.snapshot().state, "awaiting-requeue");
  claimed = false;
  await scheduler.runNext();
  assert.equal(starts, 2);
  assert.equal(lane.snapshot().state, "running");
  second.resolve({ ok: true });
});

test("recover awaiting-requeue observation after a Board failure", async () => {
  const scheduler = new FakeScheduler();
  const done = deferred<{ ok: boolean }>();
  const item = { kind: "pr" as const, number: 1, title: "change", url: "u", lifecycle: "review" as const, claimed: true, createdAt: "1" };
  let observations = 0;
  const lane = new RoleLane({
    role: "reviewer",
    board: {
      next: async () => ({ ...item, claimed: false }),
      observe: async () => {
        observations++;
        if (observations === 2) throw new Error("temporary");
        return item;
      },
    },
    worker: { start: async () => ({ sessionId: "s", settled: done.promise, abort: async () => {}, dispose() {} }) },
    model: { provider: "p", model: "m", thinking: "off" },
    schedule: scheduler.schedule,
    now: () => scheduler.now,
  });
  lane.start();
  await scheduler.runNext();
  done.resolve({ ok: true });
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  await scheduler.runNext();
  assert.equal(lane.snapshot().state, "degraded");
  await scheduler.runNext();
  assert.equal(lane.snapshot().state, "awaiting-requeue");
});

test("pause when an observed Claim becomes orphaned", async () => {
  const scheduler = new FakeScheduler();
  const done = deferred<{ ok: boolean }>();
  const item = { kind: "issue" as const, number: 1, title: "change", url: "u", lifecycle: "ready" as const, claimed: false, createdAt: "1" };
  let observation: typeof item | undefined = { ...item, claimed: true };
  let selections = 0;
  const lane = new RoleLane({
    role: "implementor",
    board: { next: async () => { selections++; return item; }, observe: async () => observation },
    worker: { start: async () => ({ sessionId: "s", settled: done.promise, abort: async () => {}, dispose() {} }) },
    model: { provider: "p", model: "m", thinking: "off" },
    schedule: scheduler.schedule,
    now: () => scheduler.now,
  });
  lane.start();
  await scheduler.runNext();
  done.resolve({ ok: true });
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(lane.snapshot().state, "awaiting-requeue");
  observation = undefined;
  await scheduler.runNext();
  assert.equal(lane.snapshot().state, "paused");
  assert.match(lane.snapshot().lastOutcome ?? "", /orphaned/);
  assert.equal(selections, 1);
});

test("observe only the active assignment while running", async () => {
  const scheduler = new FakeScheduler();
  const done = deferred<{ ok: boolean }>();
  const item = { kind: "pr" as const, number: 8, title: "change", url: "u", lifecycle: "review" as const, claimed: false, createdAt: "1" };
  let selections = 0;
  const observations: number[] = [];
  let starts = 0;
  const lane = new RoleLane({
    role: "reviewer",
    board: {
      next: async () => { selections++; return item; },
      observe: async (assigned) => { observations.push(assigned.number); return { ...item, claimed: true }; },
    },
    worker: { start: async () => {
      starts++;
      return { sessionId: "s", settled: done.promise, abort: async () => {}, dispose() {} };
    } },
    model: { provider: "p", model: "m", thinking: "off" },
    schedule: scheduler.schedule,
    now: () => scheduler.now,
  });
  lane.start();
  await scheduler.runNext();
  await scheduler.runNext();

  assert.deepEqual(observations, [8]);
  assert.equal(selections, 1);
  assert.equal(starts, 1);
  assert.equal(lane.snapshot().state, "running");
  done.resolve({ ok: true });
});

test("wait for settlement after eligibility changes", async () => {
  const scheduler = new FakeScheduler();
  const done = deferred<{ ok: boolean }>();
  const item = { kind: "pr" as const, number: 8, title: "change", url: "u", lifecycle: "review" as const, claimed: false, createdAt: "1" };
  const handedOff = { ...item, lifecycle: "done" as const };
  const lane = new RoleLane({
    role: "reviewer",
    board: { next: async () => item, observe: async () => handedOff },
    worker: { start: async () => ({ sessionId: "s", settled: done.promise, abort: async () => {}, dispose() {} }) },
    model: { provider: "p", model: "m", thinking: "off" },
    schedule: scheduler.schedule,
    now: () => scheduler.now,
  });
  lane.start();
  await scheduler.runNext();
  await scheduler.runNext();
  assert.equal(lane.snapshot().state, "running");
  assert.match(lane.snapshot().lastOutcome ?? "", /waiting for Worker settlement/);
  done.resolve({ ok: true });
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(lane.snapshot().state, "cooldown");
});

test("keep the other Role operational after failure", async () => {
  const scheduler = new FakeScheduler();
  const implementorItem = { kind: "issue" as const, number: 1, title: "build", url: "u1", lifecycle: "ready" as const, claimed: false, createdAt: "1" };
  const reviewerItem = { kind: "pr" as const, number: 2, title: "review", url: "u2", lifecycle: "review" as const, claimed: false, createdAt: "2" };
  const starts: string[] = [];
  const coordinator = new Coordinator({
    board: {
      listOpen: async () => [],
      next: async (role) => role === "implementor" ? implementorItem : reviewerItem,
      observe: async (item) => item.kind === "issue" ? item : { ...item, lifecycle: "done" as const },
    },
    worker: { start: async (role: string) => {
      starts.push(role);
      return {
        sessionId: role,
        settled: Promise.resolve(role === "implementor" ? { ok: false, error: "failed" } : { ok: true }),
        abort: async () => {},
        dispose() {},
      };
    } },
    acquire: async () => ({ owner: { pid: 1 }, release: async () => {} }),
    saveChoice: async () => {},
    createLane: (options) => new RoleLane({ ...options, schedule: scheduler.schedule, now: () => scheduler.now }),
  });
  const choice = { provider: "p", model: "m", thinking: "off" as const };
  await coordinator.start("both", { implementor: choice, reviewer: choice });
  await scheduler.runNext();
  await scheduler.runNext();
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(starts.sort(), ["implementor", "reviewer"]);
  assert.equal(coordinator.status().find((row) => row.role === "implementor")?.state, "retry-backoff");
  assert.equal(coordinator.status().find((row) => row.role === "reviewer")?.state, "cooldown");
});

test("apply deterministic lane controls", async () => {
  const item = { kind: "issue" as const, number: 1, title: "change", url: "u", lifecycle: "ready" as const, claimed: false, createdAt: "1" };
  const choice = { provider: "p", model: "m", thinking: "off" as const };

  // pause lets a running Worker settle and prevents another launch
  {
    const scheduler = new FakeScheduler();
    const done = deferred<{ ok: boolean }>();
    const lane = new RoleLane({
      role: "implementor",
      board: { next: async () => item, observe: async () => ({ ...item, lifecycle: "done" as const }) },
      worker: { start: async () => ({ sessionId: "s", settled: done.promise, abort: async () => {}, dispose() {} }) },
      model: choice, schedule: scheduler.schedule, now: () => scheduler.now,
    });
    lane.start();
    await scheduler.runNext();
    lane.pause();
    assert.equal(lane.snapshot().state, "running");
    done.resolve({ ok: true });
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(lane.snapshot().state, "paused");
  }

  // resume clears a manual pause
  {
    const scheduler = new FakeScheduler();
    const lane = new RoleLane({
      role: "reviewer",
      board: { next: async () => undefined, observe: async () => undefined },
      worker: { start: async () => { throw new Error("unexpected"); } },
      model: choice, schedule: scheduler.schedule, now: () => scheduler.now,
    });
    lane.start();
    lane.pause();
    assert.equal(lane.resume(), true);
    await scheduler.runNext();
    assert.equal(lane.snapshot().state, "idle");
  }

  // retry resets a failure pause, but cannot bypass an active Claim
  {
    const scheduler = new FakeScheduler();
    const runs = Array.from({ length: 4 }, () => deferred<{ ok: boolean }>());
    let starts = 0;
    const lane = new RoleLane({
      role: "implementor",
      board: { next: async () => item, observe: async () => item },
      worker: { start: async () => ({ sessionId: String(starts), settled: runs[starts++].promise, abort: async () => {}, dispose() {} }) },
      model: choice, schedule: scheduler.schedule, now: () => scheduler.now,
    });
    lane.start();
    await scheduler.runNext();
    for (let attempt = 0; attempt < 3; attempt++) {
      runs[attempt].resolve({ ok: false });
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));
      if (attempt < 2) await scheduler.runNext();
    }
    assert.equal(lane.retry(), true);
    assert.equal(lane.snapshot().retries, 0);
    await scheduler.runNext();
    assert.equal(starts, 4);
  }
  {
    const scheduler = new FakeScheduler();
    const done = deferred<{ ok: boolean }>();
    const lane = new RoleLane({
      role: "implementor",
      board: { next: async () => item, observe: async () => ({ ...item, claimed: true }) },
      worker: { start: async () => ({ sessionId: "s", settled: done.promise, abort: async () => {}, dispose() {} }) },
      model: choice, schedule: scheduler.schedule, now: () => scheduler.now,
    });
    lane.start();
    await scheduler.runNext();
    done.resolve({ ok: true });
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(lane.retry(), false);
    assert.equal(lane.snapshot().state, "awaiting-requeue");
  }

  // stop aborts, disposes, and releases the lock
  {
    const scheduler = new FakeScheduler();
    const done = deferred<{ ok: boolean }>();
    let aborted = false;
    let disposed = false;
    let released = false;
    const lane = new RoleLane({
      role: "implementor",
      board: { next: async () => item, observe: async () => item },
      worker: { start: async () => ({
        sessionId: "s", settled: done.promise,
        abort: async () => { aborted = true; done.resolve({ ok: false }); },
        dispose() { disposed = true; },
      }) },
      model: choice, schedule: scheduler.schedule, now: () => scheduler.now,
      releaseLock: async () => { released = true; },
    });
    lane.start();
    await scheduler.runNext();
    await lane.stop();
    assert.deepEqual([aborted, disposed, released, lane.snapshot().state], [true, true, true, "stopped"]);
  }

  // cancellation remains bounded even when abort never settles
  {
    const scheduler = new FakeScheduler();
    let disposed = false;
    const lane = new RoleLane({
      role: "implementor",
      board: { next: async () => item, observe: async () => item },
      worker: { start: async () => ({
        sessionId: "hung",
        settled: new Promise(() => {}),
        abort: async () => new Promise(() => {}),
        dispose() { disposed = true; },
      }) },
      model: choice, schedule: scheduler.schedule, now: () => scheduler.now,
      cancelTimeoutMs: 1,
    });
    lane.start();
    await scheduler.runNext();
    const stopped = await Promise.race([
      lane.stop().then(() => true),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 50)),
    ]);
    assert.equal(stopped, true);
    assert.equal(disposed, true);
  }
});

test("stop extension resources on parent session shutdown", async () => {
  const handlers: Record<string, () => Promise<void>> = {};
  const extension = await import("../extensions/loom-workers/index.ts");
  extension.default({
    registerCommand() {},
    registerEntryRenderer() {},
    on(name: string, handler: () => Promise<void>) { handlers[name] = handler; },
  } as any);
  assert.equal(typeof handlers.session_shutdown, "function");

  const cleared: string[] = [];
  let stopped = false;
  await extension.shutdownConsole({ shutdown: async () => { stopped = true; } } as any, {
    hasUI: true,
    ui: {
      setStatus(name: string, value: unknown) { if (value === undefined) cleared.push(`status:${name}`); },
      setWidget(name: string, value: unknown) { if (value === undefined) cleared.push(`widget:${name}`); },
    },
  });
  assert.equal(stopped, true);
  assert.deepEqual(cleared, ["status:loom-workers", "widget:loom-workers"]);
});

test("keep Worker narration out of parent model context", async () => {
  const pending = deferred<void>();
  let listener: (event: any) => void = () => {};
  const activities: any[] = [];
  const worker = new PiWorker({
    projectRoot: root,
    loadContract: async () => "contract",
    createSession: async () => ({
      id: "s",
      messages: [],
      subscribe(value) { listener = value; return () => {}; },
      prompt: () => pending.promise,
      abort: async () => {},
      dispose() {},
    }),
  });
  const run = await worker.start("reviewer", {
    kind: "pr", number: 1, title: "change", url: "u", lifecycle: "review", claimed: false, createdAt: "1",
  }, { provider: "p", model: "m", thinking: "off" }, (activity) => activities.push(activity));
  listener({ type: "message_update", assistantMessageEvent: { type: "thinking_delta", delta: "secret" } });
  listener({ type: "tool_execution_end", toolName: "bash", result: "raw" });
  listener({ type: "message_end", message: { role: "assistant", content: [{ type: "text", text: "Completed summary" }] } });
  listener({ type: "message_end", message: { role: "assistant", errorMessage: "Lifecycle failed" } });

  assert.deepEqual(activities.map(({ kind, text }) => [kind, text]), [
    ["message", "Completed summary"],
    ["failure", "Lifecycle failed"],
  ]);
  const appended: any[] = [];
  const extension = await import("../extensions/loom-workers/index.ts");
  extension.presentActivity({ appendEntry: (...args: any[]) => appended.push(args) } as any, activities[0]);
  assert.deepEqual(appended, [["loom-workers-activity", activities[0]]]);
  pending.resolve();
  await run.settled;
});

test("recover a stale Role lock", async () => {
  const project = await mkdtemp(join(tmpdir(), "loom-lock-project-"));
  const agentDir = await mkdtemp(join(tmpdir(), "loom-lock-agent-"));

  try {
    const stale = await acquireRoleLock(project, "implementor", {
      agentDir, pid: 111, isAlive: () => false,
    });
    const recovered = await acquireRoleLock(project, "implementor", {
      agentDir, pid: 222, isAlive: () => false,
    });
    assert.equal(recovered.owner.pid, 222);
    await stale.release();
    await assert.rejects(
      acquireRoleLock(project, "implementor", { agentDir, pid: 333, isAlive: () => true }),
      /owned by process 222/,
    );
    await recovered.release();
  } finally {
    await rm(project, { recursive: true, force: true });
    await rm(agentDir, { recursive: true, force: true });
  }
});

test("recover a stale Role lock atomically under contention", async () => {
  const project = await mkdtemp(join(tmpdir(), "loom-racing-lock-project-"));
  const agentDir = await mkdtemp(join(tmpdir(), "loom-racing-lock-agent-"));
  const gate = new Int32Array(new SharedArrayBuffer(3 * Int32Array.BYTES_PER_ELEMENT));
  const localStateUrl = new URL("../extensions/loom-workers/local-state.ts", import.meta.url).href;
  const worker = new Worker(new URL(`data:text/javascript,${encodeURIComponent(`
    import { workerData } from "node:worker_threads";
    import { acquireRoleLock } from ${JSON.stringify(localStateUrl)};
    const gate = new Int32Array(workerData.gate);
    Atomics.store(gate, 0, 1);
    Atomics.notify(gate, 0);
    Atomics.wait(gate, 1, 0);
    try {
      const lock = await acquireRoleLock(workerData.project, "implementor", {
        agentDir: workerData.agentDir,
        pid: 222,
        isAlive: (pid) => pid !== 111,
      });
      Atomics.store(gate, 2, lock.owner.pid);
    } finally {
      Atomics.store(gate, 1, 2);
      Atomics.notify(gate, 1);
    }
  `)}`), { workerData: { project, agentDir, gate: gate.buffer } });
  const exited = new Promise<void>((resolve, reject) => {
    worker.once("error", reject);
    worker.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`Lock contender exited ${code}`)));
  });

  try {
    const stale = await acquireRoleLock(project, "implementor", {
      agentDir, pid: 111, isAlive: () => false,
    });
    if (Atomics.load(gate, 0) === 0) assert.notEqual(Atomics.wait(gate, 0, 0, 5_000), "timed-out");

    await assert.rejects(acquireRoleLock(project, "implementor", {
      agentDir,
      pid: 333,
      isAlive: (pid) => {
        if (pid !== 111) return true;
        Atomics.store(gate, 1, 1);
        Atomics.notify(gate, 1);
        if (Atomics.load(gate, 1) === 1) assert.notEqual(Atomics.wait(gate, 1, 1, 5_000), "timed-out");
        return false;
      },
    }), /owned by process 222/);
    await exited;
    assert.equal(Atomics.load(gate, 2), 222);
    await stale.release();
    await assert.rejects(
      acquireRoleLock(project, "implementor", { agentDir, pid: 444, isAlive: (pid) => pid === 222 }),
      /owned by process 222/,
    );
  } finally {
    await worker.terminate();
    await rm(project, { recursive: true, force: true });
    await rm(agentDir, { recursive: true, force: true });
  }
});

test("refuse a second live Role owner", async () => {
  const project = await mkdtemp(join(tmpdir(), "loom-live-lock-project-"));
  const agentDir = await mkdtemp(join(tmpdir(), "loom-live-lock-agent-"));

  try {
    const first = await acquireRoleLock(project, "implementor", { agentDir, pid: 123, isAlive: () => true });
    await assert.rejects(
      acquireRoleLock(project, "implementor", { agentDir, pid: 456, isAlive: () => true }),
      /owned by process 123/,
    );
    await first.release();
    const next = await acquireRoleLock(project, "implementor", { agentDir, pid: 456, isAlive: () => true });
    assert.equal(next.owner.pid, 456);
    await next.release();
  } finally {
    await rm(project, { recursive: true, force: true });
    await rm(agentDir, { recursive: true, force: true });
  }
});

test("dispose context without cleaning repository work", async () => {
  const project = await mkdtemp(join(tmpdir(), "loom-worker-files-"));
  const changed = join(project, "work.txt");
  let disposed = false;
  const worker = new PiWorker({
    projectRoot: project,
    loadContract: async () => "contract",
    createSession: async () => ({
      id: "session",
      messages: [],
      subscribe() { return () => {}; },
      async prompt() {
        await writeFile(changed, "kept", "utf8");
        throw new Error("worker failed after writing");
      },
      async abort() {},
      dispose() { disposed = true; },
    }),
  });

  try {
    const run = await worker.start("implementor", {
      kind: "issue", number: 1, title: "change", url: "url", lifecycle: "ready", claimed: false, createdAt: "now",
    }, { provider: "p", model: "m", thinking: "off" }, () => {});
    assert.equal((await run.settled).ok, false);
    assert.equal(await readFile(changed, "utf8"), "kept");
    assert.equal(disposed, true);
  } finally {
    await rm(project, { recursive: true, force: true });
  }
});
