defmodule Loom.Harness do
  @moduledoc "Harness-neutral Worker process seam."

  @callback start(map(), pid()) :: {:ok, term()} | {:error, term()}
  @callback stop(term(), :graceful | :force) :: :ok | {:error, term()}
end
