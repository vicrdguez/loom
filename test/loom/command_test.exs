defmodule Loom.CommandTest do
  use ExUnit.Case, async: true

  alias Loom.Command

  test "navigate and inspect local and durable state" do
    expected = [
      {"status", {:query, :status}},
      {"tasks", {:query, :tasks}},
      {"log", {:query, :log}},
      {"diff", {:query, :diff}},
      {"board", {:query, :board}},
      {"activity", {:query, :activity}},
      {"refresh", {:query, :refresh}},
      {"focus review", {:focus, :reviewer}},
      {"help", {:query, :help}}
    ]

    for {text, result} <- expected, do: assert(Command.parse(text) == result)

    assert {:inline, "idle"} = Command.run({:query, :status}, %{status: "idle"})

    assert {:inspector, :code, long} =
             Command.run({:query, :diff}, %{diff: String.duplicate("+line\n", 100)},
               max_inline: 20
             )

    assert String.starts_with?(long, "+line")
  end

  test "configure model policy locally without exposing fixed Role policy" do
    assert Command.parse("config implement") == {:config, :implementor}
    assert Command.parse("config review") == {:config, :reviewer}
    assert Command.parse("config prompt") == {:error, {:unsupported_command, "config prompt"}}
  end

  test "parse deterministic lane controls" do
    assert Command.parse("pause implement") == {:lane_action, :implementor, :pause}
    assert Command.parse("resume review") == {:lane_action, :reviewer, :resume}
    assert Command.parse("retry implementor") == {:lane_action, :implementor, :retry}
    assert Command.parse("stop reviewer") == {:lane_action, :reviewer, :stop}
    assert Command.parse("quit") == :quit
  end

  test "reject shell and workflow mutation commands" do
    commands = [
      "! rm -rf .",
      "shell pwd",
      "git commit",
      "issue close 12",
      "pr merge 3",
      "label add loom:done"
    ]

    for command <- commands do
      assert {:error, {:unsupported_command, ^command}} = Command.parse(command)
    end
  end
end
