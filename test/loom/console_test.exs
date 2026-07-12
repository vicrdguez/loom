defmodule Loom.ConsoleTest do
  use ExUnit.Case, async: true

  alias Loom.{Console, Lane, Store, WorkerSpec}
  alias Loom.Test.{FakeBoard, FakeHarness}

  setup do
    root = Path.join(System.tmp_dir!(), "loom-console-#{System.unique_integer([:positive])}")
    File.mkdir_p!(Path.join(root, "docs/loom"))
    store = Store.open(root, state_dir: Path.join(root, "state"))
    {:ok, board} = FakeBoard.start_link([])
    {:ok, harness} = FakeHarness.start_link()

    deps = %{
      board: FakeBoard.adapter(board),
      harness: FakeHarness.adapter(harness),
      backoffs: [0, 0, 0]
    }

    on_exit(fn -> File.rm_rf!(root) end)
    %{root: root, store: store, board: board, harness: harness, deps: deps}
  end

  test "configure Worker specifications on first launch and open persistent Role lanes",
       context do
    setup = fn ->
      %{
        implementor: %{model: "gpt-5.3-codex", reasoning_effort: :high},
        reviewer: %{model: "gpt-5.2", reasoning_effort: :medium}
      }
    end

    console = start_console(context, setup: setup)
    snapshot = Console.snapshot(console)

    assert %{implementor: implementor, reviewer: reviewer} = snapshot.lanes
    assert Process.alive?(implementor)
    assert Process.alive?(reviewer)
    assert Store.load(context.store).state.specs.implementor.model == "gpt-5.3-codex"
    assert Store.load(context.store).state.specs.reviewer.reasoning_effort == :medium
  end

  test "allow matching models with a Model diversity warning" do
    specs = %{
      implementor: WorkerSpec.new(:implementor, "gpt-5.3-codex", :high, "/project"),
      reviewer: WorkerSpec.new(:reviewer, "gpt-5.3-codex", :high, "/project")
    }

    assert {:ok, ^specs, [:model_diversity_absent]} = WorkerSpec.validate(specs)
    assert specs.implementor.fresh_context
    assert specs.reviewer.fresh_context
  end

  test "reconstruct lanes after restart without restoring a running claim", context do
    specs = default_specs(context.root)

    Store.save(context.store, %{
      specs: specs,
      preferences: %{focus: :reviewer},
      pauses: %{implementor: true},
      failures: %{reviewer: %{item: 7, count: 2}},
      running: %{implementor: %{pid: 123}}
    })

    parent = self()

    progress = fn role ->
      send(parent, {:progress_read, role})
      %{board_stage: :ready}
    end

    console = start_console(context, progress: progress)
    snapshot = Console.snapshot(console)

    assert_receive {:progress_read, :implementor}
    assert_receive {:progress_read, :reviewer}
    assert Lane.snapshot(snapshot.lanes.implementor).worker == nil
    assert Lane.snapshot(snapshot.lanes.implementor).status == :paused
    assert snapshot.preferences.focus == :reviewer
  end

  test "configure model policy locally while fixed Role policy remains unchanged", context do
    console = start_console(context, setup: fn -> choices() end)
    before = Console.snapshot(console).specs.implementor

    assert :ok = Console.config(console, :implementor, "gpt-5.2", :xhigh)
    after_spec = Console.snapshot(console).specs.implementor

    assert after_spec.model == "gpt-5.2"
    assert after_spec.reasoning_effort == :xhigh
    assert after_spec.prompt == before.prompt
    assert after_spec.sandbox == before.sandbox
    assert after_spec.capabilities == before.capabilities
    assert Store.load(context.store).state.specs.implementor == after_spec
  end

  test "quit safely while a Worker is active", context do
    FakeBoard.push_claimable(context.board, {:ok, %{id: 1, slug: "change", stage: :ready}})
    console = start_console(context, setup: fn -> choices() end)
    lane = Console.snapshot(console).lanes.implementor
    Lane.poll(lane)
    assert_eventually(fn -> Lane.snapshot(lane).status == :running end)
    handle = Lane.snapshot(lane).worker

    assert {:confirmation_required, [:implementor]} = Console.quit(console)
    monitor = Process.monitor(console)
    assert :ok = Console.quit(console, confirm: true)
    assert_receive {:DOWN, ^monitor, :process, ^console, :normal}
    assert FakeHarness.stops(context.harness) == [{handle, :graceful}]
  end

  test "offer explicit force termination after graceful shutdown fails", context do
    parent = self()

    harness = %{
      start: fn _spec, _owner -> {:ok, :stubborn_worker} end,
      stop: fn handle, mode ->
        send(parent, {:stop_attempt, handle, mode})
        if mode == :graceful, do: {:error, :timeout}, else: :ok
      end
    }

    deps = %{context.deps | harness: harness}
    FakeBoard.push_claimable(context.board, {:ok, %{id: 2, slug: "stubborn", stage: :ready}})

    console =
      start_supervised!(
        {Console,
         project: context.root,
         store: context.store,
         lane_deps: deps,
         setup: fn -> choices() end,
         auto_poll: false},
        id: make_ref()
      )

    lane = Console.snapshot(console).lanes.implementor
    Lane.poll(lane)
    assert_eventually(fn -> Lane.snapshot(lane).status == :running end)

    assert {:force_required, [{:implementor, :timeout}]} = Console.quit(console, confirm: true)
    assert_receive {:stop_attempt, :stubborn_worker, :graceful}
    assert :ok = Console.quit(console, confirm: true, force: true)
    assert_receive {:stop_attempt, :stubborn_worker, :force}
  end

  defp start_console(context, opts) do
    start_supervised!(
      {Console,
       Keyword.merge(
         [project: context.root, store: context.store, lane_deps: context.deps, auto_poll: false],
         opts
       )},
      id: make_ref()
    )
  end

  defp default_specs(root) do
    %{
      implementor: WorkerSpec.new(:implementor, "gpt-5.3-codex", :high, root),
      reviewer: WorkerSpec.new(:reviewer, "gpt-5.2", :medium, root)
    }
  end

  defp choices do
    %{
      implementor: %{model: "gpt-5.3-codex", reasoning_effort: :high},
      reviewer: %{model: "gpt-5.2", reasoning_effort: :medium}
    }
  end

  defp assert_eventually(fun, attempts \\ 50)
  defp assert_eventually(fun, 0), do: assert(fun.())

  defp assert_eventually(fun, attempts) do
    if fun.(),
      do: :ok,
      else:
        (
          Process.sleep(2)
          assert_eventually(fun, attempts - 1)
        )
  end
end
