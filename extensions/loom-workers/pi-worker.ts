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
    const [contract, session] = await Promise.all([
      this.options.loadContract(role),
      this.options.createSession({ role, projectRoot: this.options.projectRoot, model }),
    ]);
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
