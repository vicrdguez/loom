defmodule Loom.MixProject do
  use Mix.Project

  def project do
    [
      app: :loom,
      version: System.get_env("LOOM_VERSION", "0.1.0"),
      elixir: "~> 1.19",
      start_permanent: Mix.env() == :prod,
      test_ignore_filters: [~r{test/support/}],
      deps: deps(),
      escript: [main_module: Loom.CLI],
      releases: [loom_console: [include_erts: true, include_executables_for: [:unix]]]
    ]
  end

  def application do
    [extra_applications: [:logger], mod: {Loom.Application, []}]
  end

  defp deps do
    [{:ex_ratatui, "~> 0.11"}]
  end
end
