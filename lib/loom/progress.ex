defmodule Loom.Progress do
  @moduledoc "Joins Board stage and repository facts into trustworthy Progress evidence."

  alias Loom.Progress.Repo

  @spec snapshot(Path.t(), %{required(:slug) => binary(), required(:stage) => term()}) :: map()
  def snapshot(project, %{slug: slug, stage: stage}) do
    project
    |> Repo.snapshot(slug)
    |> Map.take([:tasks, :scenarios, :slice_commits])
    |> Map.put(:board_stage, stage)
    |> Map.put(:observed_at, DateTime.utc_now())
  end
end
