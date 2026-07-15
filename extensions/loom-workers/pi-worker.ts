import { readFile } from "node:fs/promises";
import type {
  BoardItem,
  ModelChoice,
  Role,
  WorkerActivity,
  WorkerRun,
} from "./types.ts";

interface SessionLike {
  id: string;
  messages: unknown[];
  subscribe(listener: (event: any) => void): () => void;
  prompt(text: string): Promise<void>;
  abort(): Promise<void>;
  dispose(): Promise<void> | void;
}

interface SessionOptions {
  role: Role;
  projectRoot: string;
  model: ModelChoice;
  signal?: AbortSignal;
}

interface PiWorkerOptions {
  projectRoot: string;
  loadContract(role: Role): Promise<string>;
  createSession(options: SessionOptions): Promise<SessionLike>;
}

interface PiSdk {
  createAgentSessionServices(options: { cwd: string }): Promise<{
    modelRegistry: { find(provider: string, model: string): unknown };
  }>;
  createAgentSessionFromServices(options: any): Promise<{ session: any }>;
  SessionManager: { inMemory(cwd: string): unknown };
}

export function createPiSessionFactory(
  loadSdk: () => Promise<PiSdk> = () => import("@earendil-works/pi-coding-agent") as Promise<PiSdk>,
): (options: SessionOptions) => Promise<SessionLike> {
  return async ({ projectRoot, model, signal }) => {
    const sdk = await loadSdk();
    signal?.throwIfAborted();
    const services = await sdk.createAgentSessionServices({ cwd: projectRoot });
    signal?.throwIfAborted();
    const selectedModel = services.modelRegistry.find(model.provider, model.model);
    if (!selectedModel) throw new Error(`Pi model is no longer available: ${model.provider}/${model.model}`);
    const { session } = await sdk.createAgentSessionFromServices({
      services,
      model: selectedModel,
      thinkingLevel: model.thinking,
      sessionManager: sdk.SessionManager.inMemory(projectRoot),
    });
    let disposal: Promise<void> | undefined;
    const dispose = () => disposal ??= (async () => {
      try {
        await session.extensionRunner.emit({ type: "session_shutdown", reason: "quit" });
      } finally {
        session.dispose();
      }
    })();
    try {
      signal?.throwIfAborted();
      await session.bindExtensions({});
      signal?.throwIfAborted();
    } catch (error) {
      await dispose();
      throw error;
    }
    return {
      id: session.sessionId,
      messages: session.messages,
      subscribe: (listener) => session.subscribe(listener),
      prompt: (text) => session.prompt(text),
      abort: () => session.abort(),
      dispose,
    };
  };
}

export async function loadBundledContract(role: Role): Promise<string> {
  return readFile(new URL(`../../skills/loom-${role === "implementor" ? "implement" : "review"}/SKILL.md`, import.meta.url), "utf8");
}

export function buildWorkerPrompt(role: Role, item: BoardItem, contract: string): string {
  return `${contract}\n\n## Scheduler assignment\n\nYou are the ${role} Worker. Process only this exact Board object; never discover or substitute another:\n${JSON.stringify(item)}\n`;
}

export class PiWorker {
  private readonly options: PiWorkerOptions;

  constructor(options: PiWorkerOptions) {
    this.options = options;
  }

  async start(
    role: Role,
    item: BoardItem,
    model: ModelChoice,
    onActivity: (activity: WorkerActivity) => void,
    signal?: AbortSignal,
  ): Promise<WorkerRun> {
    signal?.throwIfAborted();
    const contract = await this.options.loadContract(role);
    signal?.throwIfAborted();
    const session = await this.options.createSession({ role, projectRoot: this.options.projectRoot, model, signal });
    if (signal?.aborted) {
      await session.dispose();
      signal.throwIfAborted();
    }
    if (session.messages.length !== 0) {
      await session.dispose();
      throw new Error("Worker session must start with empty message history");
    }

    const unsubscribe = session.subscribe((event) => emitActivity(role, event, onActivity));
    let disposal: Promise<void> | undefined;
    const dispose = () => disposal ??= (async () => {
      unsubscribe();
      await session.dispose();
    })();
    const settled = (async () => {
      try {
        await session.prompt(buildWorkerPrompt(role, item, contract));
        return { ok: true };
      } catch (error) {
        const text = error instanceof Error ? error.message : String(error);
        onActivity({ role, kind: "failure", text });
        return { ok: false, error: text };
      } finally {
        await dispose();
      }
    })();

    return {
      sessionId: session.id,
      settled,
      abort: () => session.abort(),
      dispose,
    };
  }
}

function emitActivity(role: Role, event: any, emit: (activity: WorkerActivity) => void) {
  if (event?.type !== "message_end" || event.message?.role !== "assistant") return;
  if (event.message.errorMessage) {
    emit({ role, kind: "failure", text: event.message.errorMessage });
    return;
  }
  const text = event.message.content
    ?.filter((part: any) => part.type === "text")
    .map((part: any) => part.text)
    .join("\n")
    .trim();
  if (text) emit({ role, kind: "message", text });
}
