import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Coordinator, formatStatus } from "./coordinator.ts";
import { GitHubBoard } from "./github.ts";
import { acquireRoleLock, loadChoice, saveChoice } from "./local-state.ts";
import { selectModelChoice } from "./models.ts";
import { createPiSessionFactory, loadBundledContract, PiWorker } from "./pi-worker.ts";
import { gateStartup } from "./project.ts";
import type { BoardItem, Role, WorkerActivity } from "./types.ts";

const roles: Role[] = ["implementor", "reviewer"];

export function presentActivity(pi: Pick<ExtensionAPI, "appendEntry">, activity: WorkerActivity): void {
  pi.appendEntry("loom-workers-activity", activity);
}

export async function shutdownConsole(
  coordinator: Pick<Coordinator, "shutdown"> | undefined,
  context: any,
): Promise<void> {
  await coordinator?.shutdown();
  if (context?.hasUI) {
    context.ui.setStatus("loom-workers", undefined);
    context.ui.setWidget("loom-workers", undefined);
  }
}

export default function loomWorkers(pi: ExtensionAPI) {
  let coordinator: Coordinator | undefined;
  let activeContext: any;

  pi.registerEntryRenderer("loom-workers-activity", (entry: any) => textComponent(
    `[${entry.data.role}] ${entry.data.kind === "failure" ? "failed: " : ""}${entry.data.text}`,
  ));
  pi.registerEntryRenderer("loom-workers-report", (entry: any) => textComponent(entry.data.text));

  pi.registerCommand("loom-workers", {
    description: "Start, inspect, and control Loom Board workers",
    handler: async (args, ctx) => {
      activeContext = ctx;
      const [action = "status", target = "both"] = args.trim().split(/\s+/);
      try {
        if (action === "start") {
          if (!isTarget(target)) return usage(ctx);
          const availableModels = await ctx.modelRegistry.getAvailable();
          const startup = await gateStartup({
            mode: ctx.mode,
            trusted: ctx.isProjectTrusted(),
            cwd: ctx.cwd,
            availableModels,
            runGh: () => pi.exec("gh", ["auth", "status", "-h", "github.com"], { timeout: 5_000 }),
          });
          if (!startup.ok) return ctx.ui.notify(startup.remedy, "error");
          const agentDir = (await import("@earendil-works/pi-coding-agent")).getAgentDir();
          if (!coordinator) {
            const board = new GitHubBoard(startup.repo, (command) => pi.exec("gh", command, { timeout: 30_000 }));
            coordinator = new Coordinator({
              board,
              worker: new PiWorker({
                projectRoot: startup.projectRoot,
                loadContract: loadBundledContract,
                createSession: createPiSessionFactory(),
              }),
              acquire: (role) => acquireRoleLock(startup.projectRoot, role, { agentDir }),
              saveChoice: (role, choice) => saveChoice(startup.projectRoot, role, choice, agentDir),
              onActivity: (activity) => {
                presentActivity(pi, activity);
                updateUi(activeContext, coordinator);
              },
              onChange: () => updateUi(activeContext, coordinator),
              onWarning: (warning) => ctx.ui.notify(warning, "warning"),
            });
          }
          const choices: Partial<Record<Role, any>> = {};
          for (const role of target === "both" ? roles : [target]) {
            const saved = await loadChoice(startup.projectRoot, role, agentDir);
            const choice = await selectModelChoice(role, availableModels, saved, ctx.ui);
            if (choice) choices[role] = choice;
          }
          const result = await coordinator.start(target, choices);
          for (const role of result.started) ctx.ui.notify(`Started ${role} lane.`, "info");
          for (const role of roles) {
            if (result.failures[role]) ctx.ui.notify(`${role}: ${result.failures[role]}`, "error");
          }
          updateUi(ctx, coordinator);
          return;
        }

        if (action === "list") {
          const board = coordinator ?? await readOnlyCoordinator(pi, ctx);
          if (!board) return;
          pi.appendEntry("loom-workers-report", { text: formatList(await board.list()) });
          return;
        }

        if (action === "status") {
          const status = coordinator?.status() ?? roles.map((role) => ({ role, state: "stopped" as const }));
          pi.appendEntry("loom-workers-report", { text: formatStatus(status) });
          updateUi(ctx, coordinator);
          return;
        }

        if (!["pause", "resume", "retry", "stop"].includes(action) || !isTarget(target)) return usage(ctx);
        if (!coordinator) return ctx.ui.notify("No Loom Worker lanes are started.", "warning");
        for (const role of target === "both" ? roles : [target]) {
          const changed = action === "stop"
            ? await coordinator.stop(role)
            : action === "pause"
              ? coordinator.pause(role)
              : action === "resume"
                ? coordinator.resume(role)
                : coordinator.retry(role);
          ctx.ui.notify(`${role}: ${changed ? action : "command refused"}`, changed ? "info" : "warning");
        }
        updateUi(ctx, coordinator);
      } catch (error) {
        ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
      }
    },
  });

  pi.on("session_shutdown", async () => {
    await shutdownConsole(coordinator, activeContext);
    coordinator = undefined;
  });
}

async function readOnlyCoordinator(pi: ExtensionAPI, ctx: any): Promise<Pick<Coordinator, "list"> | undefined> {
  const startup = await gateStartup({
    mode: ctx.mode,
    trusted: ctx.isProjectTrusted(),
    cwd: ctx.cwd,
    availableModels: [{}],
    runGh: () => pi.exec("gh", ["auth", "status", "-h", "github.com"], { timeout: 5_000 }),
  });
  if (!startup.ok) {
    ctx.ui.notify(startup.remedy, "error");
    return undefined;
  }
  return {
    list: () => new GitHubBoard(startup.repo, (command) => pi.exec("gh", command, { timeout: 30_000 })).listOpen(),
  };
}

export function formatList(items: BoardItem[]): string {
  return (["ready", "review", "rework", "done"] as const).map((lifecycle) => {
    const rows = items.filter((item) => item.lifecycle === lifecycle);
    return `loom:${lifecycle}\n${rows.length
      ? rows.map((item) => `- #${item.number} ${item.title}${item.claimed ? " [loom:wip]" : ""} — ${item.url}`).join("\n")
      : "- none"}`;
  }).join("\n\n");
}

function updateUi(ctx: any, coordinator: Coordinator | undefined): void {
  if (!ctx?.hasUI) return;
  const status = coordinator?.status() ?? roles.map((role) => ({ role, state: "stopped" as const }));
  const active = status.filter((row) => row.state !== "stopped");
  ctx.ui.setStatus("loom-workers", active.length ? `loom: ${active.map((row) => `${row.role} ${row.state}`).join(" · ")}` : undefined);
  ctx.ui.setWidget("loom-workers", active.length ? formatStatus(status).split("\n") : undefined, { placement: "belowEditor" });
}

function isTarget(value: string): value is Role | "both" {
  return value === "implementor" || value === "reviewer" || value === "both";
}

function usage(ctx: any): void {
  ctx.ui.notify("Usage: /loom-workers <start|list|status|pause|resume|retry|stop> [implementor|reviewer|both]", "error");
}

function textComponent(text: string) {
  return {
    render(width: number) {
      return text.split("\n").flatMap((line) => line.length > width
        ? Array.from({ length: Math.ceil(line.length / width) }, (_, index) => line.slice(index * width, (index + 1) * width))
        : [line]);
    },
    invalidate() {},
  };
}
