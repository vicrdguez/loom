defmodule Loom.Progress.RepoTest do
  use ExUnit.Case, async: true

  alias Loom.Progress.Repo

  test "reads active and archived change evidence through one interface" do
    root = Path.join(System.tmp_dir!(), "loom-repo-#{System.unique_integer([:positive])}")
    archived = Path.join(root, "docs/loom/changes/archive/2026-07-12-example")
    File.mkdir_p!(archived)
    File.write!(Path.join(archived, "behavior.md"), "Scenario: A\n\nScenario Outline: B\n")
    File.write!(Path.join(archived, "tasks.md"), "- [x] A\n- [ ] B\n")
    on_exit(fn -> File.rm_rf!(root) end)

    assert %{tasks: %{checked: 1, total: 2}, scenarios: 2, change_path: ^archived} =
             Repo.snapshot(root, "example")
  end
end
