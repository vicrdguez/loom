defmodule Loom.MixProject do
  use Mix.Project

  def project do
    [
      app: :loom,
      version: "0.1.0",
      elixir: "~> 1.19",
      start_permanent: Mix.env() == :prod,
      deps: deps(),
      escript: [main_module: Loom.CLI],
      releases: [loom: [include_executables_for: [:unix]]]
    ]
  end

  def application do
    [extra_applications: [:logger], mod: {Loom.Application, []}]
  end

  defp deps do
    [{:ex_ratatui, "~> 0.11"}]
  end
end
