defmodule Loom.UITest do
  use ExUnit.Case, async: true

  alias Loom.UI

  test "adapt the lane layout to terminal width with a fixed command line" do
    state = dashboard_state()

    wide = UI.render(state, {120, 30})
    assert wide.layout == :wide
    assert Enum.map(wide.lanes, & &1.role) == [:implementor, :reviewer]
    assert wide.command_line.fixed_bottom
    assert wide.command_line.y == 29

    narrow = UI.render(%{state | focus: :reviewer}, {70, 24})
    assert narrow.layout == :narrow
    assert Enum.map(narrow.lanes, & &1.role) == [:reviewer]
    assert narrow.role_switcher == [:implementor, :reviewer]
    assert narrow.command_line.y == 23
  end

  test "separate status, evidence, and Markdown Activity in each lane" do
    [lane | _] = UI.render(dashboard_state(), {120, 30}).lanes

    assert lane.header =~ "IMPLEMENTOR · running · gpt-5.3-codex"
    assert lane.header =~ "add-worker-console"
    assert lane.header =~ "last event"
    assert lane.evidence =~ "Board: ready"
    assert lane.evidence =~ "Tasks: 4/8"
    assert lane.evidence =~ "Scenarios: 7"
    assert lane.evidence =~ "Commits: 3"
    assert lane.evidence =~ "Retry: 1/3"
    assert lane.activity_markdown =~ "**Implemented**"
    assert lane.activity_markdown =~ "transient"
  end

  test "render dashboard through ExRatatui's headless backend" do
    frame = UI.render(dashboard_state(), {120, 30})
    terminal = ExRatatui.init_test_terminal(120, 30)
    on_exit(fn -> ExRatatui.safe_restore_terminal(terminal) end)

    assert :ok = ExRatatui.draw(terminal, UI.widgets(frame))
    buffer = ExRatatui.get_buffer_content(terminal)
    assert buffer =~ "IMPLEMENTOR"
    assert buffer =~ "REVIEWER"
    assert buffer =~ "loom>"
  end

  test "open long results in an inspector and Esc returns to the unchanged dashboard" do
    state = dashboard_state()
    inspected = UI.present_result(state, {:inspector, :code, String.duplicate("+line\n", 100)})
    frame = UI.render(inspected, {100, 25})

    assert frame.inspector.format == :code
    assert frame.inspector.content =~ "+line"
    assert UI.dismiss_inspector(inspected) == state
  end

  defp dashboard_state do
    lane = fn role, model ->
      %{
        role: role,
        status: :running,
        spec: %{model: model},
        current: %{slug: "add-worker-console"},
        worker_started_at: DateTime.add(DateTime.utc_now(), -12, :second),
        last_event_at: DateTime.add(DateTime.utc_now(), -3, :second),
        retry_count: 1,
        progress: %{
          board_stage: :ready,
          tasks: %{checked: 4, total: 8},
          scenarios: 7,
          slice_commits: [%{}, %{}, %{}]
        },
        activity: [{:activity, "**Implemented** slice"}, {:failure, "transient"}]
      }
    end

    %{
      focus: :implementor,
      command: "",
      inspector: nil,
      lanes: %{
        implementor: lane.(:implementor, "gpt-5.3-codex"),
        reviewer: lane.(:reviewer, "gpt-5.2")
      }
    }
  end
end
