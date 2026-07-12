defmodule Loom.Store do
  @moduledoc """
  Owns per-project console state, process ownership, and filtered history.

  Runtime Worker handles are intentionally removed at this seam: they cannot be
  made true again after the owning BEAM exits.
  """

  defstruct [:dir, :state_path, :history_path, :lock_path, history_limit: 200]

  @allowed_events [:activity, :lifecycle, :failure]

  def open(project, opts \\ []) do
    root = Keyword.get(opts, :state_dir, default_state_dir())

    key =
      project |> canonical() |> then(&:crypto.hash(:sha256, &1)) |> Base.encode16(case: :lower)

    dir = Path.join(root, key)
    File.mkdir_p!(dir)

    %__MODULE__{
      dir: dir,
      state_path: Path.join(dir, "state.term"),
      history_path: Path.join(dir, "activity.term"),
      lock_path: Path.join(dir, "owner.lock"),
      history_limit: Keyword.get(opts, :history_limit, 200)
    }
  end

  def acquire(project, opts \\ []) do
    store = open(project, opts)
    owner = Keyword.get(opts, :owner, System.pid())
    alive? = Keyword.get(opts, :alive?, &owner_alive?/1)

    case File.open(store.lock_path, [:write, :exclusive]) do
      {:ok, io} ->
        IO.write(io, owner <> "\n")
        File.close(io)
        {:ok, %{path: store.lock_path, owner: owner}}

      {:error, :eexist} ->
        existing = store.lock_path |> File.read!() |> String.trim()

        if alive?.(existing) do
          {:error, {:owned, existing, store.lock_path}}
        else
          File.rm!(store.lock_path)
          acquire(project, Keyword.put(opts, :owner, owner))
        end

      {:error, reason} ->
        {:error, {:ownership, reason}}
    end
  end

  def release(%{path: path}), do: File.rm(path)

  def save(%__MODULE__{} = store, state) when is_map(state) do
    state
    |> Map.drop([:running, :worker, :worker_handle, :pid])
    |> write_term(store.state_path)
  end

  def append(%__MODULE__{} = store, role, event) do
    if allowed?(event) do
      retained =
        (read_term(store.history_path, []) ++ [%{role: role, event: event}])
        |> Enum.take(-store.history_limit)

      write_term(retained, store.history_path)
    else
      :ignored
    end
  end

  def load(%__MODULE__{} = store) do
    %{state: read_term(store.state_path, %{}), history: read_term(store.history_path, [])}
  end

  defp allowed?(event) when is_tuple(event), do: elem(event, 0) in @allowed_events
  defp allowed?(_event), do: false

  defp write_term(value, path) do
    temporary = path <> ".#{System.unique_integer([:positive])}.tmp"
    File.write!(temporary, :erlang.term_to_binary(value, compressed: 6), [:binary])
    File.rename!(temporary, path)
    :ok
  end

  defp read_term(path, default) do
    case File.read(path) do
      {:ok, encoded} -> :erlang.binary_to_term(encoded, [:safe])
      {:error, :enoent} -> default
      {:error, reason} -> raise File.Error, reason: reason, action: "read", path: path
    end
  end

  defp canonical(project), do: project |> Path.expand() |> String.trim_trailing("/")

  defp default_state_dir do
    Path.join(
      System.get_env("XDG_STATE_HOME") || Path.join(System.user_home!(), ".local/state"),
      "loom"
    )
  end

  defp owner_alive?(owner) do
    match?({_output, 0}, System.cmd("kill", ["-0", owner], stderr_to_stdout: true))
  end
end
