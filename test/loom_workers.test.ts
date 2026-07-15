import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import test from "node:test";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PiWorker } from "../extensions/loom-workers/pi-worker.ts";

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
