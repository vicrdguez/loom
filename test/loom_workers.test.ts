import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import test from "node:test";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPiSessionFactory, PiWorker } from "../extensions/loom-workers/pi-worker.ts";
import { acquireRoleLock } from "../extensions/loom-workers/local-state.ts";
import { GitHubBoard } from "../extensions/loom-workers/github.ts";
import { RoleLane } from "../extensions/loom-workers/lane.ts";

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
    } as any);
    await command?.("", {
      cwd: project,
      ui: { notify() {} },
    });
    assert.deepEqual(await readdir(project), []);
    assert.ok((await readdir(join(root, "skills"))).includes("loom-init"));
  } finally {
    await rm(project, { recursive: true, force: true });
  }
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

  assert.deepEqual((await board.listOpen()).map((item) => [item.lifecycle, item.number, item.claimed]), [
    ["ready", 1, false],
    ["review", 2, true],
    ["rework", 3, false],
    ["done", 4, false],
  ]);
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
    if (attempt < 2) await scheduler.runNext();
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
