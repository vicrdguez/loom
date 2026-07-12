defmodule Loom.Progress.Repo do
  @moduledoc "Reads durable Change evidence without interpreting it as a percentage."

  @spec snapshot(Path.t(), binary()) :: map()
  def snapshot(root, slug) do
    change_path = locate_change!(root, slug)

    %{
      change_path: change_path,
      tasks: read_tasks(Path.join(change_path, "tasks.md")),
      scenarios: count_scenarios(Path.join(change_path, "behavior.md")),
      slice_commits: slice_commits(root)
    }
  end

  defp locate_change!(root, slug) do
    active = Path.join([root, "docs", "loom", "changes", slug])

    cond do
      File.dir?(active) -> active
      archived = List.first(Path.wildcard(Path.join([root, "docs", "loom", "changes", "archive", "*-#{slug}"]))) -> archived
      true -> raise ArgumentError, "Loom change #{inspect(slug)} was not found under #{root}"
    end
  end

  defp read_tasks(path) do
    case File.read(path) do
      {:ok, body} ->
        tasks = Regex.scan(~r/^\s*- \[([ xX])\]/m, body)
        %{checked: Enum.count(tasks, fn [_, mark] -> mark != " " end), total: length(tasks)}

      {:error, :enoent} ->
        :absent

      {:error, reason} ->
        raise File.Error, reason: reason, action: "read", path: path
    end
  end

  defp count_scenarios(path) do
    path
    |> File.read!()
    |> then(&Regex.scan(~r/^\s*Scenario(?: Outline)?:/m, &1))
    |> length()
  end

  defp slice_commits(root) do
    case System.cmd("git", ["-C", root, "log", "--format=%h%x09%s", "--max-count=20"], stderr_to_stdout: true) do
      {output, 0} ->
        output
        |> String.split("\n", trim: true)
        |> Enum.map(fn line ->
          case String.split(line, "\t", parts: 2) do
            [sha, subject] -> %{sha: sha, subject: subject}
            [sha] -> %{sha: sha, subject: ""}
          end
        end)

      _ ->
        []
    end
  end
end
