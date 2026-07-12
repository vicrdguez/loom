defmodule Loom.ProgressTest do
  use ExUnit.Case, async: true

  alias Loom.Progress

  test "describe progress with checked tasks without inventing completion" do
    root = project_fixture!("with-tasks")

    snapshot = Progress.snapshot(root, %{slug: "example", stage: :ready})

    assert snapshot.board_stage == :ready
    assert snapshot.tasks == %{checked: 1, total: 2}
    assert snapshot.scenarios == 2
    assert is_list(snapshot.slice_commits)
    refute Map.has_key?(snapshot, :completion_percentage)
  end

  test "describe progress explicitly when no task ledger exists" do
    root = project_fixture!("without-tasks")

    snapshot = Progress.snapshot(root, %{slug: "example", stage: :review})

    assert snapshot.tasks == :absent
    assert snapshot.board_stage == :review
    assert snapshot.scenarios == 1
  end

  defp project_fixture!(kind) do
    root =
      Path.join(System.tmp_dir!(), "loom-progress-#{kind}-#{System.unique_integer([:positive])}")

    change = Path.join(root, "docs/loom/changes/example")
    File.mkdir_p!(change)

    scenarios =
      if kind == "with-tasks", do: "Scenario: One\nScenario: Two\n", else: "Scenario: One\n"

    File.write!(Path.join(change, "behavior.md"), scenarios)

    if kind == "with-tasks" do
      File.write!(Path.join(change, "tasks.md"), "- [x] first\n- [ ] second\n")
    end

    on_exit(fn -> File.rm_rf!(root) end)
    root
  end
end
