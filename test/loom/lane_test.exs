defmodule Loom.LaneTest do
  use ExUnit.Case, async: true

  alias Loom.Lane
  alias Loom.Test.{FakeBoard, FakeHarness}

  setup do
    {:ok, board} = FakeBoard.start_link([])
    {:ok, harness} = FakeHarness.start_link()

    deps = %{
      board: FakeBoard.adapter(board),
      harness: FakeHarness.adapter(harness),
      backoffs: [0, 0, 0]
    }

    %{board: board, harness: harness, deps: deps}
  end

  test "launch a fresh Worker for claimable Board work and never a second active Worker",
       context do
    item = item(:ready)
    FakeBoard.push_claimable(context.board, {:ok, item})
    FakeBoard.push_claimable(context.board, {:ok, item})
    lane = start_lane(:implementor, context.deps)

    Lane.poll(lane)
    assert_eventually(fn -> Lane.snapshot(lane).status == :running end)
    Lane.poll(lane)

    assert [{spec, _owner, _handle}] = FakeHarness.starts(context.harness)
    assert spec.fresh_context
    assert spec.change.id == item.id
  end

  test "remain visible and idle without claimable work", context do
    lane = start_lane(:reviewer, context.deps)
    Lane.poll(lane)

    assert_eventually(fn ->
      snapshot = Lane.snapshot(lane)
      snapshot.status == :idle and snapshot.worker == nil and snapshot.next_poll_at != nil
    end)
  end

  test "re-arm automatic polling while idle" do
    parent = self()

    board = %{
      claimable: fn role ->
        send(parent, {:polled, role})
        :none
      end,
      state: fn item -> {:ok, item.stage} end
    }

    {:ok, harness} = FakeHarness.start_link()

    lane =
      start_supervised!(
        {Lane,
         role: :reviewer,
         spec: %{model: "gpt-5.3-codex"},
         deps: %{board: board, harness: FakeHarness.adapter(harness), poll_interval: 5}},
        id: make_ref()
      )

    assert_receive {:polled, :reviewer}, 100
    assert_receive {:polled, :reviewer}, 100
    assert Lane.snapshot(lane).status == :idle
  end

  test "refresh Progress through the lane's evidence seam", context do
    item = item(:ready)
    {:ok, evidence} = Agent.start_link(fn -> :ready end)

    progress = fn board_item ->
      %{board_stage: Agent.get(evidence, & &1), slug: board_item.slug}
    end

    deps = Map.put(context.deps, :progress, progress)
    FakeBoard.push_claimable(context.board, {:ok, item})
    lane = start_lane(:implementor, deps)

    Lane.poll(lane)
    assert_eventually(fn -> Lane.snapshot(lane).progress.board_stage == :ready end)
    Agent.update(evidence, fn _ -> :review end)
    assert %{board_stage: :review} = Lane.refresh(lane)
    assert Lane.snapshot(lane).progress.board_stage == :review
  end

  test "prefer rework before new implementation" do
    items = [item(:ready, 1), item(:rework, 2)]
    assert Loom.Board.choose(:implementor, items).stage == :rework
  end

  test "reconcile Worker exit against Board truth", context do
    item = item(:ready)
    {lane, handle} = running_lane(context, item)

    FakeBoard.set_state(context.board, item.id, {:ok, :review})
    send(lane, {:harness_exit, handle, 0})
    assert_eventually(fn -> Lane.snapshot(lane).status == :cooldown end)
    assert Lane.snapshot(lane).retry_count == 0

    FakeBoard.push_claimable(context.board, {:ok, item})
    Lane.poll(lane)
    assert_eventually(fn -> Lane.snapshot(lane).status == :running end)
    handle = Lane.snapshot(lane).worker
    FakeBoard.set_state(context.board, item.id, {:ok, :ready})
    send(lane, {:harness_exit, handle, 1})
    assert_eventually(fn -> Lane.snapshot(lane).status == :backoff end)
    assert Lane.snapshot(lane).retry_count == 1

    FakeBoard.push_claimable(context.board, {:ok, item})
    Lane.poll(lane)
    assert_eventually(fn -> Lane.snapshot(lane).status == :running end)
    handle = Lane.snapshot(lane).worker
    FakeBoard.set_state(context.board, item.id, {:error, :unavailable})
    send(lane, {:harness_exit, handle, 1})
    assert_eventually(fn -> Lane.snapshot(lane).status == :degraded end)
    assert Lane.snapshot(lane).retry_count == 1
  end

  test "pause after three consecutive Worker failures", context do
    item = item(:ready)
    lane = start_lane(:implementor, context.deps)

    for expected <- 1..3 do
      FakeBoard.push_claimable(context.board, {:ok, item})
      Lane.poll(lane)
      assert_eventually(fn -> Lane.snapshot(lane).status == :running end)
      handle = Lane.snapshot(lane).worker
      FakeBoard.set_state(context.board, item.id, {:ok, :ready})
      send(lane, {:harness_exit, handle, 1})
      target = if expected == 3, do: :paused, else: :backoff
      assert_eventually(fn -> Lane.snapshot(lane).status == target end)
    end

    assert Lane.snapshot(lane).retry_count == 3
    assert length(Lane.snapshot(lane).failures) == 3

    {:ok, launch_board} = FakeBoard.start_link(List.duplicate({:ok, item}, 3))

    failing_harness = %{
      start: fn _spec, _owner -> {:error, :enoent} end,
      stop: fn _handle, _mode -> :ok end
    }

    deps = %{context.deps | board: FakeBoard.adapter(launch_board), harness: failing_harness}
    launch_lane = start_lane(:implementor, deps)
    for _ <- 1..3, do: Lane.poll(launch_lane)
    assert_eventually(fn -> Lane.snapshot(launch_lane).status == :paused end)
    assert Lane.snapshot(launch_lane).retry_count == 3
  end

  test "recover automatically when the Board returns without spending retry", context do
    FakeBoard.push_claimable(context.board, {:error, :unavailable})
    FakeBoard.push_claimable(context.board, :none)
    lane = start_lane(:reviewer, context.deps)

    Lane.poll(lane)
    assert_eventually(fn -> Lane.snapshot(lane).status == :degraded end)
    Lane.poll(lane)
    assert_eventually(fn -> Lane.snapshot(lane).status == :idle end)
    assert Lane.snapshot(lane).retry_count == 0
  end

  test "do not terminate a silent Worker automatically", context do
    {_lane, _handle} = running_lane(context, item(:review))
    Process.sleep(5)
    assert FakeHarness.stops(context.harness) == []
  end

  test "apply deterministic lane-control commands", context do
    implementor = start_lane(:implementor, context.deps)
    assert :ok = Lane.command(implementor, :pause)
    assert Lane.snapshot(implementor).status == :paused
    assert :ok = Lane.command(implementor, :resume)
    assert_eventually(fn -> Lane.snapshot(implementor).status in [:idle, :degraded] end)

    {reviewer, handle} = running_lane(context, item(:review, 9), :reviewer)
    assert :ok = Lane.command(reviewer, :stop)
    assert Lane.snapshot(reviewer).status == :paused
    assert FakeHarness.stops(context.harness) == [{handle, :graceful}]
  end

  defp running_lane(context, item, role \\ :implementor) do
    FakeBoard.push_claimable(context.board, {:ok, item})
    lane = start_lane(role, context.deps)
    Lane.poll(lane)
    assert_eventually(fn -> Lane.snapshot(lane).status == :running end)
    {lane, Lane.snapshot(lane).worker}
  end

  defp start_lane(role, deps) do
    start_supervised!(
      {Lane, role: role, spec: %{model: "gpt-5.3-codex"}, deps: deps, auto_poll: false},
      id: make_ref()
    )
  end

  defp item(stage, id \\ 1), do: %{id: id, slug: "change-#{id}", stage: stage}

  defp assert_eventually(fun, attempts \\ 50)
  defp assert_eventually(fun, 0), do: assert(fun.())

  defp assert_eventually(fun, attempts) do
    if fun.() do
      :ok
    else
      Process.sleep(2)
      assert_eventually(fun, attempts - 1)
    end
  end
end
