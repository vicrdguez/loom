defmodule Loom.CLI do
  @moduledoc "Bare `loom` Worker-console entrypoint."

  alias Loom.{Console, Progress, Store}
  alias Loom.Board.GitHub
  alias Loom.Harness.Codex

  @required_flags ~w(--json --ephemeral --model --sandbox --cd)

  def main(["--" | args]), do: main(args)

  def main(["--version"]) do
    IO.puts("loom #{version()}")
    0
  end

  def main([]) do
    project = discover_project(File.cwd!())

    case preflight(project || File.cwd!()) do
      {:ok, _capabilities} ->
        run(project)

      {:error, diagnostic} ->
        IO.puts(:stderr, diagnostic)
        1
    end
  end

  def main(_args) do
    IO.puts(:stderr, "Usage: loom [--version]")
    2
  end

  def version do
    case Application.spec(:loom, :vsn) do
      nil -> "dev"
      version -> to_string(version)
    end
  end

  def preflight(project, opts \\ []) do
    finder = Keyword.get(opts, :finder, &System.find_executable/1)
    probe = Keyword.get(opts, :probe, &probe/2)
    codex = finder.("codex")
    gh = finder.("gh")

    cond do
      not initialized?(project) ->
        {:error, "Not an initialized Loom project; run /loom-init first."}

      is_nil(codex) ->
        {:error, "Codex executable is unavailable; install Codex or expose it on PATH."}

      is_nil(gh) ->
        {:error, "GitHub CLI executable is unavailable; install or expose gh on PATH."}

      true ->
        {help, status} = probe.(codex, ["exec", "--help"])
        missing = Enum.reject(@required_flags, &String.contains?(help, &1))

        if status == 0 and missing == [] do
          {:ok, %{codex: codex, gh: gh}}
        else
          {:error,
           "Installed Codex lacks required exec capabilities: #{Enum.join(missing, ", ")}."}
        end
    end
  end

  defp run(project) do
    case Store.acquire(project) do
      {:ok, ownership} ->
        try do
          store = Store.open(project)
          board = GitHub.adapter(project)

          harness = %{
            start: &Codex.start/2,
            stop: &Codex.stop/2
          }

          {:ok, console} =
            Console.start_link(
              project: project,
              store: store,
              setup: &first_run_setup/0,
              lane_deps: %{
                board: board,
                harness: harness,
                progress: &Progress.snapshot(project, &1)
              }
            )

          {:ok, ui} = Loom.UI.App.start_link(console: console, name: nil)
          monitor = Process.monitor(ui)
          receive do: ({:DOWN, ^monitor, :process, ^ui, _reason} -> :ok)
          0
        after
          Store.release(ownership)
        end

      {:error, {:owned, owner, path}} ->
        IO.puts(:stderr, "Another Loom console (PID #{owner}) owns this project via #{path}.")
        1
    end
  end

  defp first_run_setup do
    %{
      implementor: ask_policy(:implementor, "gpt-5.3-codex", :high),
      reviewer: ask_policy(:reviewer, "gpt-5.2", :high)
    }
  end

  defp ask_policy(role, default_model, default_effort) do
    model = ask("#{role} model", default_model)

    effort =
      ask("#{role} reasoning effort (low/medium/high/xhigh)", Atom.to_string(default_effort))

    reasoning_effort =
      case effort do
        "low" -> :low
        "medium" -> :medium
        "high" -> :high
        "xhigh" -> :xhigh
        _ -> default_effort
      end

    %{model: model, reasoning_effort: reasoning_effort}
  end

  defp ask(label, default) do
    case IO.gets("#{label} [#{default}]: ") do
      nil -> default
      input -> input |> String.trim() |> then(&if(&1 == "", do: default, else: &1))
    end
  end

  defp probe(executable, args), do: System.cmd(executable, args, stderr_to_stdout: true)

  defp initialized?(project), do: File.regular?(Path.join(project, "docs/loom/project.md"))

  defp discover_project(path) do
    if initialized?(path) do
      path
    else
      parent = Path.dirname(path)
      if parent == path, do: nil, else: discover_project(parent)
    end
  end
end
