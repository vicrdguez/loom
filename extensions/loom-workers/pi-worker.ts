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
  dispose(): void;
}

interface SessionOptions {
  role: Role;
  projectRoot: string;
  model: ModelChoice;
}

interface PiWorkerOptions {
  projectRoot: string;
  loadContract(role: Role): Promise<string>;
  createSession(options: SessionOptions): Promise<SessionLike>;
}

interface PiSdk {
  AuthStorage: { create(): unknown };
  ModelRegistry: { create(auth: unknown): { find(provider: string, model: string): unknown } };
  DefaultResourceLoader: new (options: any) => { reload(): Promise<void> };
  SessionManager: { inMemory(cwd: string): unknown };
  getAgentDir(): string;
  createAgentSession(options: any): Promise<{ session: any }>;
}

export function createPiSessionFactory(
  loadSdk: () => Promise<PiSdk> = () => import("@earendil-works/pi-coding-agent") as Promise<PiSdk>,
): (options: SessionOptions) => Promise<SessionLike> {
  return async ({ projectRoot, model }) => {
    const sdk = await loadSdk();
    const authStorage = sdk.AuthStorage.create();
    const modelRegistry = sdk.ModelRegistry.create(authStorage);
    const selectedModel = modelRegistry.find(model.provider, model.model);
    if (!selectedModel) throw new Error(`Pi model is no longer available: ${model.provider}/${model.model}`);
    const resourceLoader = new sdk.DefaultResourceLoader({ cwd: projectRoot, agentDir: sdk.getAgentDir() });
    await resourceLoader.reload();
    const { session } = await sdk.createAgentSession({
      cwd: projectRoot,
      agentDir: sdk.getAgentDir(),
      authStorage,
      modelRegistry,
      model: selectedModel,
      thinkingLevel: model.thinking,
      resourceLoader,
      sessionManager: sdk.SessionManager.inMemory(projectRoot),
    });
    return {
      id: session.sessionId,
      messages: session.messages,
      subscribe: (listener) => session.subscribe(listener),
      prompt: (text) => session.prompt(text),
      abort: () => session.abort(),
      dispose: () => session.dispose(),
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
  ): Promise<WorkerRun> {
    const contract = await this.options.loadContract(role);
    const session = await this.options.createSession({ role, projectRoot: this.options.projectRoot, model });
    if (session.messages.length !== 0) {
      session.dispose();
      throw new Error("Worker session must start with empty message history");
    }

    const unsubscribe = session.subscribe((event) => emitActivity(role, event, onActivity));
    let disposed = false;
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      unsubscribe();
      session.dispose();
    };
    const settled = (async () => {
      try {
        await session.prompt(buildWorkerPrompt(role, item, contract));
        return { ok: true };
      } catch (error) {
        const text = error instanceof Error ? error.message : String(error);
        onActivity({ role, kind: "failure", text });
        return { ok: false, error: text };
      } finally {
        dispose();
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
