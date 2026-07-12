defmodule Loom.Board.GitHub do
  @moduledoc "Read-only GitHub CLI adapter for Board labels and item state."

  alias Loom.Board

  def adapter(root, opts \\ []) do
    runner = Keyword.get(opts, :runner, &System.cmd/3)

    %{
      claimable: &claimable(root, &1, runner),
      state: &state(root, &1, runner)
    }
  end

  defp claimable(root, :implementor, runner) do
    with {:ok, rework} <- list(root, "pr", "loom:rework", runner),
         {:ok, ready} <- list(root, "issue", "loom:ready", runner) do
      case Board.choose(:implementor, rework ++ ready) do
        nil -> :none
        item -> {:ok, item}
      end
    end
  end

  defp claimable(root, :reviewer, runner) do
    with {:ok, items} <- list(root, "pr", "loom:review", runner) do
      case Board.choose(:reviewer, items) do
        nil -> :none
        item -> {:ok, item}
      end
    end
  end

  defp state(root, item, runner) do
    kind = if item.kind == :issue, do: "issue", else: "pr"

    case runner.("gh", [kind, "view", to_string(item.id), "--json", "labels,state"],
           cd: root,
           stderr_to_stdout: true
         ) do
      {output, 0} ->
        decoded = :json.decode(output)
        {:ok, stage(decoded["labels"] || [])}

      {output, _status} ->
        {:error, {:github, String.trim(output)}}
    end
  rescue
    error -> {:error, {:decode, Exception.message(error)}}
  end

  defp list(root, kind, label, runner) do
    fields =
      if kind == "pr", do: "number,title,url,labels,headRefName", else: "number,title,url,labels"

    case runner.(
           "gh",
           [
             kind,
             "list",
             "--label",
             label,
             "--state",
             "open",
             "--json",
             fields,
             "--limit",
             "100"
           ],
           cd: root,
           stderr_to_stdout: true
         ) do
      {output, 0} ->
        items =
          output
          |> :json.decode()
          |> Enum.map(&normalize(&1, kind, label))

        {:ok, items}

      {output, _status} ->
        {:error, {:github, String.trim(output)}}
    end
  rescue
    error -> {:error, {:decode, Exception.message(error)}}
  end

  defp normalize(item, kind, label) do
    %{
      id: item["number"],
      kind: if(kind == "pr", do: :pr, else: :issue),
      title: item["title"],
      url: item["url"],
      slug: item["headRefName"] || slug(item["title"]),
      stage: label_stage(label)
    }
  end

  defp stage(labels) do
    names = Enum.map(labels, & &1["name"])

    cond do
      "loom:rework" in names -> :rework
      "loom:ready" in names -> :ready
      "loom:review" in names -> :review
      "loom:done" in names -> :done
      true -> :untracked
    end
  end

  defp label_stage("loom:rework"), do: :rework
  defp label_stage("loom:ready"), do: :ready
  defp label_stage("loom:review"), do: :review

  defp slug(title) do
    title
    |> String.downcase()
    |> String.replace(~r/[^a-z0-9]+/, "-")
    |> String.trim("-")
  end
end
