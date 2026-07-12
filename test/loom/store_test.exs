defmodule Loom.StoreTest do
  use ExUnit.Case, async: true

  alias Loom.Store

  setup do
    state_dir = Path.join(System.tmp_dir!(), "loom-store-#{System.unique_integer([:positive])}")
    project = Path.join(state_dir, "project")
    File.mkdir_p!(project)
    on_exit(fn -> File.rm_rf!(state_dir) end)
    %{project: project, state_dir: state_dir}
  end

  test "enforce exclusive ownership without trapping stale locks", context do
    opts = [state_dir: context.state_dir, owner: "101", alive?: &(&1 == "101")]
    assert {:ok, ownership} = Store.acquire(context.project, opts)

    assert {:error, {:owned, "101", lock_path}} =
             Store.acquire(context.project,
               state_dir: context.state_dir,
               owner: "202",
               alive?: &(&1 == "101")
             )

    assert lock_path == ownership.path
    Store.release(ownership)

    File.write!(ownership.path, "999999\n")

    assert {:ok, recovered} =
             Store.acquire(context.project,
               state_dir: context.state_dir,
               owner: "202",
               alive?: fn _ -> false end
             )

    assert File.read!(recovered.path) == "202\n"
  end

  test "retain only bounded filtered Activity history", context do
    store = Store.open(context.project, state_dir: context.state_dir, history_limit: 3)

    events = [
      {:activity, "one"},
      {:activity, "two"},
      {:lifecycle, :turn_started, %{}},
      {:activity, "three"},
      {:reasoning, "secret"},
      {:tool, "output"},
      {:raw_jsonl, "{}"}
    ]

    Enum.each(events, &Store.append(store, :implementor, &1))
    Store.save(store, %{specs: %{implementor: %{model: "gpt-5"}}, running: %{pid: 123}})

    assert %{specs: %{implementor: %{model: "gpt-5"}}} = Store.load(store).state

    assert Store.load(store).history == [
             %{role: :implementor, event: {:activity, "two"}},
             %{role: :implementor, event: {:lifecycle, :turn_started, %{}}},
             %{role: :implementor, event: {:activity, "three"}}
           ]

    refute Map.has_key?(Store.load(store).state, :running)
  end
end
