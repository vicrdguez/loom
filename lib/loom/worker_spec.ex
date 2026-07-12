defmodule Loom.WorkerSpec do
  @moduledoc "Harness-neutral, Loom-owned policy for one Worker Role."

  @roles [:implementor, :reviewer]
  @efforts [:low, :medium, :high, :xhigh]

  def new(role, model, reasoning_effort, project_root)
      when role in @roles and is_binary(model) and reasoning_effort in @efforts do
    %{
      role: role,
      model: model,
      reasoning_effort: reasoning_effort,
      project_root: Path.expand(project_root),
      prompt: prompt(role),
      sandbox: sandbox(role),
      capabilities: capabilities(role),
      fresh_context: true
    }
  end

  def update(spec, model, reasoning_effort)
      when is_binary(model) and reasoning_effort in @efforts do
    %{spec | model: model, reasoning_effort: reasoning_effort}
  end

  def validate(%{implementor: implementor, reviewer: reviewer} = specs) do
    warnings = if implementor.model == reviewer.model, do: [:model_diversity_absent], else: []
    {:ok, specs, warnings}
  end

  defp prompt(:implementor),
    do: "/loom-implement — claim and build exactly one Board Change, then exit."

  defp prompt(:reviewer),
    do: "/loom-review — independently review exactly one Board Change, then exit."

  defp sandbox(:implementor), do: :workspace_write
  defp sandbox(:reviewer), do: :workspace_write
  defp capabilities(:implementor), do: [:code_write, :git_write, :forge_present]
  defp capabilities(:reviewer), do: [:code_read, :forge_review]
end
