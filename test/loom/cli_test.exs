defmodule Loom.CLITest do
  use ExUnit.Case, async: true

  alias Loom.CLI

  test "fail preflight with an actionable diagnostic" do
    root = temporary_project()

    cases = [
      {"an initialized project", root <> "-missing",
       %{"codex" => "/bin/codex", "gh" => "/bin/gh"}, "run /loom-init"},
      {"the Codex executable", root, %{"gh" => "/bin/gh"}, "install Codex"},
      {"the GitHub CLI executable", root, %{"codex" => "/bin/codex"}, "install or expose gh"},
      {"required Codex exec flags", root, %{"codex" => "/bin/codex", "gh" => "/bin/gh"},
       "lacks required exec capabilities"}
    ]

    for {requirement, project, executables, remedy} <- cases do
      finder = &Map.get(executables, &1)

      probe = fn _executable, _args ->
        {if(requirement == "required Codex exec flags", do: "Usage", else: required_help()), 0}
      end

      assert {:error, diagnostic} = CLI.preflight(project, finder: finder, probe: probe)
      assert diagnostic =~ remedy
      refute_receive {:worker_started, _}
    end
  end

  test "pass preflight for an initialized project with capable Codex and GitHub CLIs" do
    root = temporary_project()
    finder = fn executable -> "/bin/#{executable}" end
    probe = fn _executable, _args -> {required_help(), 0} end

    assert {:ok, %{codex: "/bin/codex", gh: "/bin/gh"}} =
             CLI.preflight(root, finder: finder, probe: probe)
  end

  test "version entrypoint is local and non-interactive" do
    assert CLI.main(["--version"]) == 0
  end

  defp temporary_project do
    root = Path.join(System.tmp_dir!(), "loom-cli-#{System.unique_integer([:positive])}")
    File.mkdir_p!(Path.join(root, "docs/loom"))
    File.write!(Path.join(root, "docs/loom/project.md"), "# Project\n")
    on_exit(fn -> File.rm_rf!(root) end)
    root
  end

  defp required_help do
    "--json --ephemeral --model --sandbox --cd"
  end
end
