defmodule Loom.Board do
  @moduledoc "Read-only Board selection rules shared by adapters."

  @callback claimable(:implementor | :reviewer) :: {:ok, map()} | :none | {:error, term()}
  @callback state(map()) :: {:ok, term()} | {:error, term()}

  def choose(:implementor, items) do
    Enum.find(items, &(&1.stage == :rework)) || Enum.find(items, &(&1.stage == :ready))
  end

  def choose(:reviewer, items), do: Enum.find(items, &(&1.stage == :review))
end
