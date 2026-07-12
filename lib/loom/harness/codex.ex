defmodule Loom.Harness.Codex do
  @moduledoc "Codex CLI adapter for fresh, ephemeral, non-interactive Workers."

  @behaviour Loom.Harness

  alias Loom.Harness.Codex.Worker

  @impl true
  def start(spec, owner), do: start(spec, owner, [])

  def start(spec, owner, opts) do
    executable = Keyword.get_lazy(opts, :executable, fn -> System.find_executable("codex") end)
    runner = Keyword.get(opts, :runner, &run_worker/3)

    if executable do
      runner.(executable, arguments(spec), owner: owner)
    else
      {:error, :codex_not_found}
    end
  end

  @impl true
  def stop(handle, mode), do: Worker.stop(handle, mode)

  def arguments(spec) do
    [
      "exec",
      "--json",
      "--ephemeral",
      "--color",
      "never",
      "--model",
      spec.model,
      "--config",
      ~s(model_reasoning_effort="#{spec.reasoning_effort}"),
      "--sandbox",
      sandbox(spec.sandbox),
      "--cd",
      spec.project_root,
      spec.prompt
    ]
  end

  defp run_worker(executable, args, opts), do: Worker.start_link(executable, args, opts)

  defp sandbox(:workspace_write), do: "workspace-write"
  defp sandbox(:read_only), do: "read-only"
  defp sandbox(value) when is_binary(value), do: value
end
