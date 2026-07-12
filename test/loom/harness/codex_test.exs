defmodule Loom.Harness.CodexTest do
  use ExUnit.Case, async: true

  alias Loom.Harness.Codex

  test "translate a Worker specification without a Codex profile" do
    parent = self()

    runner = fn executable, args, opts ->
      send(parent, {:launch, executable, args, opts})
      {:ok, :worker_handle}
    end

    spec = %{
      role: :implementor,
      model: "gpt-5.3-codex",
      reasoning_effort: :high,
      project_root: "/work/project",
      prompt: "Implement exactly one Board change.",
      sandbox: :workspace_write
    }

    assert {:ok, :worker_handle} =
             Codex.start(spec, self(), executable: "/bin/codex", runner: runner)

    assert_receive {:launch, "/bin/codex", args, opts}
    assert Enum.take(args, 1) == ["exec"]
    assert "--json" in args
    assert "--ephemeral" in args
    assert Enum.chunk_every(args, 2, 1) |> Enum.any?(&(&1 == ["--model", "gpt-5.3-codex"]))
    assert Enum.chunk_every(args, 2, 1) |> Enum.any?(&(&1 == ["--sandbox", "workspace-write"]))
    assert Enum.chunk_every(args, 2, 1) |> Enum.any?(&(&1 == ["--cd", "/work/project"]))
    assert Enum.any?(args, &String.contains?(&1, "model_reasoning_effort=\"high\""))
    refute "--profile" in args
    refute "-p" in args
    assert opts[:owner] == self()
  end
end
