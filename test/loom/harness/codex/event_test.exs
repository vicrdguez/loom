defmodule Loom.Harness.Codex.EventTest do
  use ExUnit.Case, async: true

  alias Loom.Harness.Codex.Event

  test "normalize only useful Codex JSONL events" do
    cases = [
      {~s({"type":"item.completed","item":{"type":"agent_message","text":"**Done**"}}),
       {:activity, "**Done**"}},
      {~s({"type":"thread.started","thread_id":"thread-1"}),
       {:lifecycle, :thread_started, %{thread_id: "thread-1"}}},
      {~s({"type":"turn.started"}), {:lifecycle, :turn_started, %{}}},
      {~s({"type":"turn.completed"}), {:lifecycle, :turn_completed, %{}}},
      {~s({"type":"error","message":"boom"}), {:failure, "boom"}},
      {~s({"type":"item.completed","item":{"type":"reasoning","text":"secret"}}), :ignore},
      {~s({"type":"item.completed","item":{"type":"command_execution","command":"pwd"}}),
       :ignore},
      {~s({"type":"item.completed","item":{"type":"file_change"}}), :ignore},
      {~s({"type":"item.completed","item":{"type":"mcp_tool_call"}}), :ignore},
      {~s({"type":"future.event","payload":{}}), :ignore},
      {~s({"type":"thread.started"}), {:error, {:missing_field, "thread_id"}}}
    ]

    for {line, expected} <- cases do
      assert Event.decode(line) == expected
    end
  end

  test "malformed JSON is an adapter error" do
    assert {:error, {:invalid_json, _reason}} = Event.decode("not json")
  end
end
