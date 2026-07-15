import type { ModelChoice, Role, ThinkingLevel } from "./types.ts";

interface AvailableModel {
  provider: string;
  id: string;
  reasoning?: boolean;
  thinkingLevelMap?: Partial<Record<ThinkingLevel, string | null>>;
}

interface NativeUi {
  select(title: string, options: string[]): Promise<string | undefined>;
}

const standardThinking: ThinkingLevel[] = ["off", "minimal", "low", "medium", "high"];

export async function selectModelChoice(
  role: Role,
  available: AvailableModel[],
  saved: ModelChoice | undefined,
  ui: NativeUi,
): Promise<ModelChoice | undefined> {
  const models = [...available];
  models.sort((left, right) => Number(!matches(left, saved)) - Number(!matches(right, saved)));
  const selected = await ui.select(`Select ${role} model`, models.map((model) => `${model.provider}/${model.id}`));
  if (!selected) return undefined;
  const model = models.find((candidate) => `${candidate.provider}/${candidate.id}` === selected);
  if (!model) return undefined;

  const thinking = supportedThinking(model);
  if (matches(model, saved) && saved && thinking.includes(saved.thinking)) {
    thinking.sort((left, right) => Number(left !== saved.thinking) - Number(right !== saved.thinking));
  }
  const selectedThinking = await ui.select(`Select ${role} thinking level`, thinking);
  if (!selectedThinking) return undefined;
  return {
    provider: model.provider,
    model: model.id,
    thinking: selectedThinking as ThinkingLevel,
  };
}

function matches(model: AvailableModel, saved: ModelChoice | undefined): boolean {
  return model.provider === saved?.provider && model.id === saved.model;
}

function supportedThinking(model: AvailableModel): ThinkingLevel[] {
  if (!model.reasoning) return ["off"];
  const extended = (["xhigh", "max"] as ThinkingLevel[])
    .filter((level) => typeof model.thinkingLevelMap?.[level] === "string");
  return [...standardThinking, ...extended]
    .filter((level) => model.thinkingLevelMap?.[level] !== null);
}
